import { enhanceSourceLinks } from './source-ui.mjs';
import { validateEconomicCalendar, assertCalendarUpdate, calendarDate, eventStatus, eventRange, selectEvents, formatEventValue, surprise } from './economic-calendar.mjs';
import { formatTime, safeLink } from './lib.mjs';
import { dateLabel } from './history.mjs';
import { eventLearning, metricLearning } from './learning-ui.mjs';

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const impactLabels = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };
function link(source, label = source.name) {
  const node = make('a', label); node.href = safeLink(source.url); node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
}
function datum(value, metric, label) {
  const cell = make('div', null, 'event-datum'); cell.append(make('span', label, 'event-datum-label'));
  if (value == null) { cell.append(make('span', label === 'Dự báo' ? 'Chưa có dự báo xác minh' : 'Chưa có dữ liệu', 'event-missing')); return cell; }
  cell.append(make('strong', formatEventValue(value.value) + ' ' + metric.unit));
  if (value.revisedFrom != null) cell.append(make('span', 'Điều chỉnh từ ' + formatEventValue(value.revisedFrom) + ' ' + metric.unit, 'event-revision'));
  return cell;
}
export function renderEconomicEvents(container, events, referenceTime) {
  const renderKey = JSON.stringify([events, events.map(event => eventStatus(event, referenceTime))]);
  if (container.dataset.renderKey === renderKey) return;
  container.dataset.renderKey = renderKey;
  const openIds = new Set([...container.querySelectorAll('details[open]')].map(node => node.dataset.eventId));
  container.replaceChildren();
  for (const event of events) {
    const card = make('details', null, 'economic-event'); card.dataset.eventId = event.id; card.open = openIds.has(event.id);
    const summary = make('summary');
    const time = make('div', null, 'event-clock');
    time.append(make('span', dateLabel(event.scheduledDate, { year: undefined })), make('strong', event.scheduledAt ? formatTime(event.scheduledAt, { day: undefined, month: undefined, year: undefined, second: undefined }) : 'Chưa rõ giờ'));
    const title = make('div', null, 'event-heading'); title.append(make('strong', event.title), make('span', event.country + ' · ' + event.currency + ' · Kỳ ' + event.period));
    const badges = make('div', null, 'event-badges'); badges.append(make('span', 'Theo dõi: ' + impactLabels[event.impact], 'event-impact impact-' + event.impact), make('span', eventStatus(event, referenceTime), 'event-state'));
    summary.append(time, title, badges);
    if (event.metrics[0]) {
      const metric = event.metrics[0], preview = make('div', null, 'event-preview');
      preview.append(make('span', metric.label, 'event-preview-label'));
      for (const [key, label] of [['actual', 'Thực tế'], ['forecast', 'Dự báo'], ['previous', 'Kỳ trước']]) {
        const value = metric[key], cell = make('div'); cell.append(make('span', label), make('strong', value ? formatEventValue(value.value) + ' ' + metric.unit : 'Chưa có'));
        if (value?.revisedFrom != null) cell.append(make('small', 'Đã điều chỉnh'));
        preview.append(cell);
      }
      summary.append(preview);
    }
    summary.append(make('span', 'Chi tiết & nguồn', 'event-disclosure')); card.append(summary);
    const body = make('div', null, 'event-body');
    body.append(make('p', event.description), eventLearning(event));
    if (event.outcome) body.append(make('p', event.outcome, 'event-outcome'));
    for (const metric of event.metrics) {
      const row = make('section', null, 'event-metric'); row.append(make('h4', metric.label), make('p', metric.basis, 'event-basis'));
      const values = make('div', null, 'event-values'); values.append(datum(metric.actual, metric, 'Thực tế'), datum(metric.forecast, metric, 'Dự báo'), datum(metric.previous, metric, 'Kỳ trước')); row.append(values);
      row.append(metricLearning(metric, metric === event.metrics[0] && Boolean(metric.actual)));
      const delta = surprise(metric); if (delta != null) row.append(make('p', 'Thực tế − dự báo: ' + delta + '. Chênh lệch này không tự xác định chiều biến động tài sản.', 'event-surprise'));
      const sources = make('div', null, 'event-metric-sources');
      for (const [key, label] of [['actual', 'Thực tế'], ['forecast', 'Dự báo'], ['previous', 'Kỳ trước']]) {
        const value = metric[key]; if (!value) continue;
        const line = make('p', label + ' · kỳ ' + value.period + ' · công bố ' + formatTime(value.publishedAt) + ' giờ Việt Nam · '); line.append(link(value.source)); sources.append(line);
      }
      row.append(sources); body.append(row);
    }
    const interpretation = make('div', null, 'event-interpretation'); interpretation.append(make('p', 'Nhận định · cơ chế và điều kiện', 'eyebrow'));
    for (const [key, label] of [['mechanism', 'Kênh tác động'], ['vietnam', 'Liên hệ Việt Nam'], ['conditions', 'Điều cần kiểm chứng']]) { const p = make('p'); p.append(make('strong', label + ': '), document.createTextNode(event.analysis[key])); interpretation.append(p); }
    body.append(interpretation, make('p', 'Mức theo dõi do bản tin đánh giá: ' + event.impactReason, 'event-basis'));
    const sources = make('div', null, 'event-source-links'); sources.append(link(event.scheduleSource, 'Lịch chính thức · ' + event.scheduleSource.name));
    if (event.resultSource) sources.append(link(event.resultSource, 'Kết quả · ' + event.resultSource.name));
    const originalTime = event.scheduledAt ? ' · Giờ tại nguồn: ' + new Intl.DateTimeFormat('vi-VN', { timeZone: event.sourceTimezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.scheduledAt)) + ' (' + event.sourceTimezone + ')' : '';
    body.append(sources, make('p', 'Giờ trên lịch: Asia/Ho_Chi_Minh (UTC+7)' + originalTime, 'event-basis')); card.append(body); container.append(card);
  }
  enhanceSourceLinks(container);
}

export function createEconomicCalendar({ fetchJSON, getReport, getSelection, onSelect, onChange }) {
  const byId = id => document.getElementById(id);
  const state = { snapshot: null, loading: false, error: '', nextDays: false, origin: 'latest', country: '', impact: '', query: '' };
  const currentSnapshot = () => state.origin === 'report' ? getReport()?.economic_calendar || null : state.snapshot;
  function render() {
    const selection = getSelection();
    const rangeMode = selection.mode === 'week' ? 'week' : state.nextDays ? 'next' : 'day';
    const snapshot = currentSnapshot(), referenceTime = state.origin === 'report' ? snapshot?.checkedAt : new Date();
    const range = eventRange(selection.date, rangeMode);
    byId('economic-selection').textContent = rangeMode === 'day' ? 'Sự kiện ngày ' + dateLabel(selection.date) : 'Sự kiện ' + dateLabel(range.start) + ' – ' + dateLabel(range.end);
    byId('economic-content').setAttribute('aria-busy', String(state.loading || (state.origin === 'report' && selection.loading)));
    byId('economic-next-days').disabled = selection.mode === 'week';
    byId('economic-next-days').checked = state.nextDays && selection.mode !== 'week';
    const countries = [...new Set(snapshot?.events.map(event => event.country) || [])].sort();
    const country = byId('economic-country'); country.replaceChildren(new Option('Tất cả quốc gia', ''), ...countries.map(code => new Option(code === 'US' ? 'Mỹ · USD' : code, code)));
    if (!countries.includes(state.country)) state.country = ''; country.value = state.country;
    const status = byId('economic-status'); status.className = 'economic-status';
    if (state.origin === 'report') status.textContent = snapshot ? 'Lịch theo mốc bản tin · kiểm tra ' + formatTime(snapshot.checkedAt) + '. Không dùng kết quả biết sau mốc này.' : selection.mode === 'week' ? 'Mốc theo bản tin chỉ áp dụng khi chọn một ngày. Chọn “Lịch mới nhất” để xem sự kiện của cả tuần.' : selection.loading ? 'Đang kiểm tra lịch lưu trong bản tin đúng ngày được chọn…' : 'Ngày đang chọn chưa có bản tin kèm lịch sự kiện. Chọn “Lịch mới nhất” để xem dữ liệu đã xác minh gần đây.';
    else if (state.error) { status.textContent = state.error + (snapshot ? ' Giữ lịch kiểm tra ' + formatTime(snapshot.checkedAt) + '.' : ' Hãy bấm Làm mới lịch để thử lại.'); status.classList.add('has-error'); }
    else if (snapshot) {
      status.textContent = 'Kiểm tra nguồn: ' + formatTime(snapshot.checkedAt) + ' giờ Việt Nam · Phạm vi ' + dateLabel(snapshot.coverageStart) + ' – ' + dateLabel(snapshot.coverageEnd) + '. Danh sách gồm các sự kiện được chọn, không phải toàn bộ lịch quốc tế.';
      if (calendarDate(snapshot.checkedAt) !== calendarDate(Date.now())) { status.textContent += ' Lịch chưa được kiểm tra lại hôm nay.'; status.classList.add('is-stale'); }
    } else status.textContent = state.loading ? 'Đang tải lịch đã xuất bản…' : 'Chưa có lịch sự kiện đã xác minh.';
    byId('economic-skeleton').hidden = !state.loading || Boolean(snapshot);
    byId('economic-refresh').disabled = state.loading;
    const events = selectEvents(snapshot, { ...state, date: selection.date, range: rangeMode }); renderEconomicEvents(byId('economic-events-list'), events, referenceTime);
    byId('economic-count').textContent = events.length + ' sự kiện trong phạm vi chọn';
    const empty = byId('economic-empty'); empty.hidden = events.length > 0 || state.loading;
    empty.textContent = !snapshot ? 'Chưa có dữ liệu lịch cho chế độ này.' : range.end < snapshot.coverageStart || range.start > snapshot.coverageEnd ? 'Ngày được chọn nằm ngoài phạm vi lịch đã kiểm tra. Chưa xác minh sự kiện của ngày này.' : 'Chưa có sự kiện phù hợp trong danh sách đã xác minh. Không đồng nghĩa ngày này không có công bố kinh tế.';
    if (snapshot && (range.start < snapshot.coverageStart || range.end > snapshot.coverageEnd)) { status.textContent += ' Phạm vi đang chọn chưa được lịch bao phủ đầy đủ.'; status.classList.add('is-stale'); }
  }
  async function refresh() {
    if (state.loading) return; state.loading = true; render();
    try {
      const snapshot = validateEconomicCalendar(await fetchJSON('./data/economic-calendar.json'));
      if (!snapshot) throw new Error('Chưa có lịch đã xác minh.');
      if (getReport() && snapshot.sourceThreadId !== getReport().sourceThreadId) throw new Error('Lịch khác quy trình bản tin.');
      assertCalendarUpdate(state.snapshot, snapshot); state.snapshot = snapshot; state.error = '';
    } catch { state.error = 'Không xác minh được bản lịch mới nhất.'; }
    finally { state.loading = false; onChange(); }
  }
  byId('economic-today').addEventListener('click', () => onSelect(calendarDate(Date.now())));
  byId('economic-refresh').addEventListener('click', refresh);
  byId('economic-origin').addEventListener('change', event => { state.origin = event.target.value; onChange(); });
  byId('economic-country').addEventListener('change', event => { state.country = event.target.value; render(); });
  byId('economic-impact').addEventListener('change', event => { state.impact = event.target.value; render(); });
  byId('economic-search').addEventListener('input', event => { state.query = event.target.value; render(); });
  byId('economic-next-days').addEventListener('change', event => { state.nextDays = event.target.checked; render(); });
  return { render, refresh, get eventDates() { return [...new Set((currentSnapshot()?.events || []).map(event => event.scheduledDate))]; } };
}
