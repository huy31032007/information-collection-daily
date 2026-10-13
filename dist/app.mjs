import { TOPICS, TIMEZONE, validateNewsletter, parseSections, extractSources, formatTime, reportFreshness, filterSections, vietnamDate } from './lib.mjs';
import { renderMarkdown } from './markdown.mjs';
import { renderDashboard } from './dashboard.mjs';
import { validDate, addDays, dateLabel, weekRange, validateArchiveIndex, validateArchivedReport } from './history.mjs';
import { renderCalendar, renderWeek } from './history-ui.mjs';

const byId = id => document.getElementById(id);
const initialDate = new URL(location.href).searchParams.get('date');
const state = { report: null, sections: [], latest: null, index: null, indexError: '', busy: false, date: validDate(initialDate) ? initialDate : vietnamDate(), mode: new URL(location.href).searchParams.get('view') === 'week' ? 'week' : 'day', followingLatest: !validDate(initialDate), month: '', selectionRequest: 0, weekReports: [], weekKey: '', weekFailures: [], filters: { topic: 'all', source: '', period: 'any', query: '' } };
state.month = state.date.slice(0, 7);
const archiveCache = new Map();
const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
function status(text, kind = '') { const node = byId('status'); node.textContent = text; node.className = 'status ' + kind; }

function setHistoryExpanded(expanded) {
  byId('history-body').hidden = !expanded;
  byId('history-panel').classList.toggle('is-collapsed', !expanded);
  byId('toggle-history').setAttribute('aria-expanded', String(expanded));
  byId('toggle-history-label').textContent = expanded ? 'Thu gọn' : 'Mở lịch';
}
byId('toggle-history').addEventListener('click', () => setHistoryExpanded(byId('history-body').hidden));

const mobileNavigation = window.matchMedia('(max-width: 1023px)');
let desktopNavigationCollapsed = false;
function syncNavigation() {
  const expanded = mobileNavigation.matches ? document.body.classList.contains('sidebar-open') : !desktopNavigationCollapsed;
  document.body.classList.toggle('sidebar-collapsed', !mobileNavigation.matches && desktopNavigationCollapsed);
  byId('sidebar').inert = !expanded;
  document.querySelector('.app-frame').inert = mobileNavigation.matches && expanded;
  byId('sidebar-overlay').hidden = !(mobileNavigation.matches && expanded);
  const label = expanded ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng';
  byId('toggle-sidebar').setAttribute('aria-expanded', String(expanded));
  byId('toggle-sidebar').hidden = expanded;
  byId('toggle-sidebar').setAttribute('aria-label', label);
  byId('toggle-sidebar').title = label + ' (⌘/Ctrl+B)';
}
function closeNavigation({ focus = false } = {}) {
  if (mobileNavigation.matches) document.body.classList.remove('sidebar-open');
  else desktopNavigationCollapsed = true;
  syncNavigation();
  if (focus) byId('toggle-sidebar').focus();
}
function toggleNavigation() {
  if (byId('toggle-sidebar').getAttribute('aria-expanded') === 'true') { closeNavigation({ focus: true }); return; }
  if (mobileNavigation.matches) document.body.classList.add('sidebar-open');
  else desktopNavigationCollapsed = false;
  syncNavigation();
  requestAnimationFrame(() => {
    if (byId('toggle-sidebar').getAttribute('aria-expanded') === 'true') byId('sidebar-close').focus();
  });
}
byId('toggle-sidebar').addEventListener('click', toggleNavigation);
byId('sidebar-close').addEventListener('click', () => closeNavigation({ focus: true }));
byId('sidebar-overlay').addEventListener('click', () => closeNavigation({ focus: true }));
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'b' && !event.repeat && !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault(); toggleNavigation();
  }
  if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeNavigation({ focus: true });
  if (event.key === 'Tab' && document.body.classList.contains('sidebar-open')) {
    const controls = [...byId('sidebar').querySelectorAll('a, button')]; const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobileNavigation.addEventListener('change', () => {
  document.body.classList.remove('sidebar-open'); syncNavigation();
  if (byId('sidebar').inert && byId('sidebar').contains(document.activeElement)) byId('toggle-sidebar').focus();
}); syncNavigation();
for (const anchor of document.querySelectorAll('[data-dashboard-nav]')) anchor.addEventListener('click', event => {
  event.preventDefault(); resetFilters(); if (mobileNavigation.matches) closeNavigation();
  if (anchor.hash === '#history-panel') setHistoryExpanded(true);
  const targetHash = state.mode === 'week' ? anchor.hash === '#market-overview' ? '#weekly-content' : anchor.hash.replace('#section-', '#week-topic-') : anchor.hash;
  const target = document.querySelector(targetHash); if (target?.tagName === 'DETAILS') target.open = true; target?.scrollIntoView({ block: 'start' });
  const focusTarget = target?.querySelector('summary') || target;
  if (focusTarget && !focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1;
  focusTarget?.focus({ preventScroll: true });
  history.replaceState(null, '', anchor.hash);
  for (const link of document.querySelectorAll('[data-dashboard-nav]')) { if (link === anchor) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }
});
byId('market-overview').addEventListener('click', event => {
  if (!event.target.closest('a[href="#section-2"]')) return;
  event.preventDefault(); resetFilters(); byId('section-2')?.scrollIntoView({ block: 'start' }); history.replaceState(null, '', '#section-2');
});

for (const topic of TOPICS) {
  const button = make('button', topic.label); button.type = 'button'; button.dataset.topic = topic.id; button.setAttribute('aria-pressed', topic.id === 'all' ? 'true' : 'false');
  button.addEventListener('click', () => { state.filters.topic = topic.id; render(); }); byId('topics').append(button);
}
function resetFilters() {
  state.filters = { topic: 'all', source: '', period: 'any', query: '' };
  byId('search').value = ''; byId('source-filter').value = ''; byId('period-filter').value = 'any'; render();
}
byId('search').addEventListener('input', event => { state.filters.query = event.target.value; render(); });
byId('source-filter').addEventListener('change', event => { state.filters.source = event.target.value; render(); });
byId('period-filter').addEventListener('change', event => { state.filters.period = event.target.value; render(); });
byId('clear-filters').addEventListener('click', resetFilters);
byId('reset-empty').addEventListener('click', () => { if (!state.report) { if (!state.followingLatest) goLatest(); else void loadReport(); return; } resetFilters(); byId('search').focus(); });
byId('refresh').addEventListener('click', () => loadReport());

function render() {
  if (state.mode === 'week') {
    if (state.selectionLoading && state.weekKey !== weekRange(state.date).start) return;
    for (const button of byId('topics').children) button.setAttribute('aria-pressed', String(button.dataset.topic === state.filters.topic));
    const week = renderWeek(byId('weekly-content'), state.weekReports, state.date, { filters: state.filters, failures: state.weekFailures, availabilityKnown: Boolean(state.index) && !state.indexError, onReadDay: date => selectDate(date, 'day') });
    byId('result-count').textContent = `${week.reports.length} bản tin trong tuần · bộ lọc áp dụng cho phân tích theo chủ đề`;
    return;
  }
  const content = byId('report-content'); content.replaceChildren();
  for (const button of byId('topics').children) button.setAttribute('aria-pressed', String(button.dataset.topic === state.filters.topic));
  if (!state.report) return;
  const sections = filterSections(state.sections, state.report, state.filters);
  byId('no-results').hidden = sections.length !== 0;
  const count = sections.filter(s => s.id !== 'glossary').length;
  byId('result-count').textContent = `${count} / 9 chuyên mục${sections.some(s => s.id === 'glossary') ? ' · kèm giải thích thuật ngữ' : ''}`;
  for (const section of sections) {
    const article = make('section', null, 'report-section'); article.id = 'section-' + section.id;
    const header = make('div', null, 'section-header'); header.append(make('span', section.id === 'glossary' ? 'Aa' : section.id.padStart(2, '0'), 'section-number'));
    const heading = make('h2', section.title); heading.id = article.id + '-heading'; article.setAttribute('aria-labelledby', heading.id); header.append(heading); article.append(header);
    const body = make('div', null, 'section-body'); body.append(renderMarkdown(section.body)); article.append(body); content.append(article);
  }
}
function setDayMetadata(report) {
  byId('report-date').textContent = new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(report.cutoffAt));
  byId('cutoff-time').textContent = 'Chốt ' + new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(report.cutoffAt));
  byId('coverage').textContent = formatTime(report.coverageStart, { year: undefined, second: undefined }) + ' → ' + formatTime(report.coverageEnd, { year: undefined, second: undefined });
  const sources = [...new Set(extractSources(report.markdown).map(source => source.name))].sort((a, b) => a.localeCompare(b, 'vi'));
  byId('source-count').textContent = String(sources.length); byId('section-count').textContent = '09';
  const options = [new Option('Tất cả nguồn', ''), ...sources.map(source => new Option(source, source))]; byId('source-filter').replaceChildren(...options);
  if (!sources.includes(state.filters.source)) state.filters.source = ''; byId('source-filter').value = state.filters.source;
}
function installReport(report) {
  state.report = report; const parsed = parseSections(report.markdown); state.sections = parsed.sections;
  renderDashboard(byId('market-overview'), state.sections, report);
  setDayMetadata(report);
  byId('report-context').replaceChildren(renderMarkdown(parsed.intro));
  render();
}
function freshStatus(report) {
  if (!state.followingLatest) { status(`Đang xem bản tin đã lưu ngày ${dateLabel(report.reportDate)}, chốt ${formatTime(report.cutoffAt)} giờ Việt Nam. Giá giữ đúng thời điểm nguồn.`, 'warning'); return; }
  if (reportFreshness(report) === 'older') status(`Chưa có bản tin hôm nay. Bản gần nhất chốt ${formatTime(report.cutoffAt)} giờ Việt Nam; giá giữ theo thời điểm trong nguồn.`, 'warning');
  else status(`Bản tin ngày ${byId('report-date').textContent} · chốt ${byId('cutoff-time').textContent.replace('Chốt ', '')} giờ Việt Nam. Giá là dữ liệu tại thời điểm nguồn, không phải báo giá trực tiếp.`);
}
async function fetchJSON(url, limit = 600_000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-cache', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Không tải được dữ liệu đã xuất bản.');
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Dữ liệu vượt giới hạn kích thước.');
    const raw = await response.text(); if (raw.length > limit) throw new Error('Dữ liệu vượt giới hạn kích thước.');
    try { return JSON.parse(raw); } catch { throw new Error('Dữ liệu bản tin chưa đọc được.'); }
  } finally { clearTimeout(timer); }
}
function knownEntries() {
  const entries = [...(state.index?.reports || [])];
  if (state.latest) { const i = entries.findIndex(entry => entry.reportDate === state.latest.reportDate); const row = { reportDate: state.latest.reportDate, cutoffAt: state.latest.cutoffAt, title: state.latest.title }; if (i < 0) entries.push(row); else if (Date.parse(state.latest.cutoffAt) > Date.parse(entries[i].cutoffAt)) entries[i] = row; }
  return entries;
}
function refreshCalendar() {
  renderCalendar(byId('calendar-grid'), { month: state.month, date: state.date, mode: state.mode, index: { reports: knownEntries() }, availabilityKnown: Boolean(state.index) && !state.indexError, onSelect: date => selectDate(date), onMove: moveCalendarFocus });
  const range = weekRange(state.date);
  byId('history-selection').textContent = state.mode === 'week' ? 'Tuần ' + dateLabel(range.start) + ' – ' + dateLabel(range.end) : 'Ngày ' + dateLabel(state.date);
  byId('view-day').setAttribute('aria-pressed', String(state.mode === 'day')); byId('view-week').setAttribute('aria-pressed', String(state.mode === 'week'));
  const entries = knownEntries(); const entry = entries.find(row => row.reportDate === state.date);
  byId('history-detail').textContent = state.mode === 'week' ? `Có ${entries.filter(row => range.dates.includes(row.reportDate)).length} bản tin đã biết trong tuần. Những ngày thiếu sẽ được ghi rõ.` : entry ? entry.title + ' · chốt ' + formatTime(entry.cutoffAt) : state.index ? 'Chưa có bản tin được lưu cho ngày này.' : 'Chưa tải đủ lịch sử để xác nhận dữ liệu của ngày này.';
  byId('history-status').textContent = state.indexError || (state.index ? `Đã lưu ${state.index.reports.length} ngày · Giờ Việt Nam` : 'Đang tải lịch bản tin…');
  byId('history-status').classList.toggle('history-error', Boolean(state.indexError)); byId('latest-button').disabled = !state.latest;
}
function showMode() {
  const weekly = state.mode === 'week';
  byId('market-overview').hidden = weekly; byId('daily-overview').hidden = weekly; byId('daily-reader').hidden = weekly; byId('weekly-content').hidden = !weekly;
  byId('page-title').textContent = weekly ? 'Tổng hợp thông tin tuần' : 'Toàn cảnh thị trường';
  byId('edition-kicker').textContent = weekly ? 'TUẦN ĐƯỢC CHỌN' : state.followingLatest ? 'BẢN TIN GẦN NHẤT' : 'BẢN TIN ĐƯỢC CHỌN';
  byId('reading-title').textContent = weekly ? 'Tổng hợp & phân tích theo tuần' : 'Bản tin & phân tích đầy đủ';
  byId('period-filter').closest('div').hidden = weekly;
  if (weekly) { const range = weekRange(state.date); byId('report-date').textContent = dateLabel(range.start, { year: undefined }) + ' – ' + dateLabel(range.end); }
}
function clearDay(message) {
  state.report = null; state.sections = []; byId('report-content').replaceChildren(); byId('report-context').replaceChildren();
  renderDashboard(byId('market-overview'), [], null); byId('report-date').textContent = dateLabel(state.date); byId('cutoff-time').textContent = 'Chưa có mốc chốt dữ liệu';
  byId('coverage').textContent = '—'; byId('source-count').textContent = '—'; byId('section-count').textContent = '—'; byId('source-filter').replaceChildren(new Option('Tất cả nguồn', ''));
  byId('result-count').textContent = 'Chưa có nội dung cho ngày được chọn'; byId('no-results').hidden = false; byId('no-results').querySelector('h2').textContent = 'Chưa có bản tin ngày ' + dateLabel(state.date); byId('no-results').querySelector('p').textContent = message;
  byId('reset-empty').textContent = 'Xem bản tin gần nhất';
}
async function archivedReport(date) {
  const entry = knownEntries().find(row => row.reportDate === date); if (!entry) return null;
  if (state.latest?.reportDate === date && state.latest.cutoffAt === entry.cutoffAt) return state.latest;
  const cached = archiveCache.get(date); if (cached?.cutoffAt === entry.cutoffAt) return cached;
  const report = validateArchivedReport(await fetchJSON('./data/archive/' + date + '.json'), entry);
  if (state.latest && state.latest.sourceThreadId !== report.sourceThreadId) throw new Error('Bản tin thuộc quy trình khác.');
  archiveCache.set(date, report); return report;
}
async function loadSelection({ quiet = false } = {}) {
  const request = ++state.selectionRequest; state.selectionLoading = true; const date = state.date; const mode = state.mode; showMode(); refreshCalendar();
  if (mode === 'week') {
    const range = weekRange(date);
    if (!state.index) { state.selectionLoading = false; byId('weekly-content').setAttribute('aria-busy', 'false'); byId('cutoff-time').textContent = 'Lịch sử chưa xác minh'; byId('weekly-content').replaceChildren(make('p', 'Chưa tải được lịch bản tin để tổng hợp tuần. Hãy làm mới để thử lại.', 'weekly-empty')); status('Chưa xác nhận được đầy đủ danh sách bản tin trong tuần.', 'error'); return; }
    if (state.weekKey !== range.start) { state.weekReports = []; state.weekFailures = []; byId('weekly-content').replaceChildren(make('p', 'Đang tải các bản tin trong tuần…', 'weekly-loading')); }
    byId('weekly-content').setAttribute('aria-busy', 'true'); byId('cutoff-time').textContent = 'Đang tổng hợp bản tin đã lưu';
    const entries = knownEntries().filter(entry => range.dates.includes(entry.reportDate));
    const results = await Promise.allSettled(entries.map(entry => archivedReport(entry.reportDate)));
    if (request !== state.selectionRequest) return;
    const reports = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
    const failures = entries.filter((_, i) => results[i].status === 'rejected').map(entry => entry.reportDate);
    const changed = state.weekKey !== range.start || JSON.stringify(state.weekFailures) !== JSON.stringify(failures) || JSON.stringify(state.weekReports) !== JSON.stringify(reports);
    state.selectionLoading = false; state.weekReports = reports; state.weekFailures = failures; state.weekKey = range.start;
    const sources = [...new Set(reports.flatMap(report => extractSources(report.markdown).map(source => source.name)))].sort((a, b) => a.localeCompare(b, 'vi'));
    byId('source-filter').replaceChildren(new Option('Tất cả nguồn', ''), ...sources.map(source => new Option(source, source))); if (!sources.includes(state.filters.source)) state.filters.source = ''; byId('source-filter').value = state.filters.source;
    if (changed || !quiet) render(); byId('weekly-content').setAttribute('aria-busy', 'false');
    byId('cutoff-time').textContent = `${reports.length} / 7 ngày có bản tin`;
    status(`Tổng hợp tuần ${dateLabel(range.start)} – ${dateLabel(range.end)} từ ${reports.length} ngày đã lưu.${failures.length ? ' Có bản tin tải lỗi; dữ liệu tuần chưa đầy đủ.' : reports.length < 7 ? ' Chưa đủ dữ liệu cả tuần.' : ''} Giá và nhận định giữ mốc của từng bản tin.`, failures.length ? 'error' : reports.length < 7 ? 'warning' : '');
    return;
  }
  if (state.report && state.report.reportDate !== date) clearDay('Đang tải bản tin đúng ngày bạn chọn…');
  byId('report-content').setAttribute('aria-busy', 'true');
  if (!quiet) status('Đang tải bản tin ngày ' + dateLabel(date) + '…', 'loading');
  try {
    const report = await archivedReport(date); if (request !== state.selectionRequest) return;
    if (!report) {
      const message = state.index && !state.indexError ? 'Ngày này chưa có bản tin được lưu. Bạn có thể chọn ngày có dấu chấm hoặc xem bản tin gần nhất.' : 'Lịch sử chưa tải được; chưa thể xác nhận bản tin ngày này. Hãy thử làm mới.';
      clearDay(message); status(message, state.index && !state.indexError ? 'warning' : 'error'); return;
    }
    const previous = state.report; const changed = !previous || ['markdown','cutoffAt','title','reportDate','coverageStart','coverageEnd'].some(key => report[key] !== previous[key]);
    if (changed) installReport(report); else { state.report = report; setDayMetadata(report); }
    byId('no-results').querySelector('h2').textContent = 'Không có mục phù hợp'; byId('no-results').querySelector('p').textContent = 'Thử đổi từ khóa, nguồn hoặc khoảng thời gian. Bộ lọc thời gian áp dụng cho ngày bản tin, không đổi thời điểm của từng giá.'; byId('reset-empty').textContent = 'Xem bản tin gần nhất'; freshStatus(report);
  } catch (error) {
    if (request !== state.selectionRequest) return;
    if (!state.report || state.report.reportDate !== date) clearDay('Không tải được bản tin đúng ngày bạn chọn. Hãy thử làm mới.');
    status('Không tải được bản tin ngày ' + dateLabel(date) + '.' + (state.report ? ' Giữ bản đang đọc với mốc gốc.' : ' Hãy thử làm mới.'), 'error');
  } finally { if (request === state.selectionRequest) { state.selectionLoading = false; byId('report-content').setAttribute('aria-busy', 'false'); } }
}
async function loadReport({ quiet = false } = {}) {
  if (state.busy) return; state.busy = true; const button = byId('refresh'); button.disabled = true; button.classList.add('is-loading');
  byId('report-content').setAttribute('aria-busy', 'true');
  if (!quiet) status(state.report ? 'Đang kiểm tra bản tin đã xuất bản. Nội dung đang đọc vẫn được giữ nguyên…' : 'Đang tải bản tin đã xuất bản…', 'loading');
  let latestError = null;
  try {
    try {
      const report = validateNewsletter(await fetchJSON('./data/latest.json'));
      if (!report) {
        if (!state.latest && state.followingLatest && state.mode === 'day') { clearDay('Bản tin sẽ xuất hiện sau khi quy trình hằng ngày hoàn tất việc tổng hợp và xuất bản.'); byId('report-date').textContent = 'Chưa có bản tin'; byId('no-results').querySelector('h2').textContent = 'Chưa có bản tin'; byId('reset-empty').textContent = 'Thử tải lại'; }
        latestError = Object.assign(new Error('Chưa có bản tin mới trong dữ liệu đã xuất bản.'), { warning: true });
      } else if (state.latest && Date.parse(report.cutoffAt) < Date.parse(state.latest.cutoffAt)) latestError = Object.assign(new Error('Dữ liệu vừa tải về cũ hơn bản đã xác nhận.'), { warning: true });
      else { state.latest = report; if (state.followingLatest && state.mode === 'day') { state.date = report.reportDate; if (!quiet) state.month = state.date.slice(0, 7); await loadSelection({ quiet }); } }
    } catch (error) { latestError = error; }
    try { state.index = validateArchiveIndex(await fetchJSON('./data/archive/index.json', 8_000_000)); state.indexError = ''; }
    catch (error) { state.indexError = 'Chưa tải được lịch bản tin. Ngày chưa xác nhận không được coi là đã có dữ liệu.'; }
    const newest = state.index?.reports[0];
    if (newest && state.latest && Date.parse(newest.cutoffAt) > Date.parse(state.latest.cutoffAt)) {
      try {
        const newer = validateArchivedReport(await fetchJSON('./data/archive/' + newest.reportDate + '.json'), newest);
        if (newer.sourceThreadId !== state.latest.sourceThreadId) throw new Error('Bản tin thuộc quy trình khác.');
        state.latest = newer; archiveCache.set(newer.reportDate, newer); latestError = null;
        if (state.followingLatest && state.mode === 'day') { state.date = newer.reportDate; if (!quiet) state.month = state.date.slice(0, 7); }
      } catch { latestError = new Error('Lịch có bản tin mới hơn nhưng chưa tải được nội dung để xác nhận.'); }
    }
    refreshCalendar();
    if (((state.followingLatest && state.mode === 'day' && state.latest) || !state.followingLatest || state.mode === 'week') && !(latestError && state.followingLatest && state.mode === 'day' && state.report)) await loadSelection({ quiet });
    if (latestError && state.followingLatest && state.mode === 'day') {
      status(latestError.message + (state.report ? ` Đang giữ bản chốt ${formatTime(state.report.cutoffAt)} giờ Việt Nam; chưa xác nhận cập nhật mới.` : ' Hãy thử nút Làm mới bản tin.'), latestError.warning ? 'warning' : 'error');
      if (!state.latest && latestError.message !== 'Chưa có bản tin mới trong dữ liệu đã xuất bản.') { renderDashboard(byId('market-overview'), [], null); byId('report-date').textContent = 'Chưa tải được'; byId('cutoff-time').textContent = 'Thời điểm bản tin chưa xác minh'; }
    }
    byId('last-loaded').textContent = 'Kiểm tra bản đã xuất bản lúc ' + formatTime(new Date().toISOString()) + ' · giờ Việt Nam';
  } finally { state.busy = false; button.disabled = false; button.classList.remove('is-loading'); byId('report-content').setAttribute('aria-busy', 'false'); }
}
function updateURL() {
  const url = new URL(location.href); if (state.followingLatest && state.mode === 'day') { url.searchParams.delete('date'); url.searchParams.delete('view'); }
  else { url.searchParams.set('date', state.date); url.searchParams.set('view', state.mode); }
  history.pushState(null, '', url.pathname + url.search + url.hash);
}
function selectDate(date, mode = state.mode) {
  if (!validDate(date)) return; state.date = date; state.mode = mode; state.followingLatest = false; state.month = date.slice(0, 7);
  state.filters = { topic: 'all', source: '', period: 'any', query: '' }; byId('search').value = ''; byId('source-filter').value = ''; byId('period-filter').value = 'any';
  updateURL(); void loadSelection();
}
function goLatest() {
  if (!state.latest) { void loadReport(); return; } state.mode = 'day'; state.followingLatest = true; state.date = state.latest.reportDate; state.month = state.date.slice(0, 7);
  state.filters = { topic: 'all', source: '', period: 'any', query: '' }; byId('search').value = ''; byId('source-filter').value = ''; byId('period-filter').value = 'any'; updateURL(); void loadSelection();
}
function moveMonth(delta) { const date = new Date(state.month + '-01T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() + delta); state.month = date.toISOString().slice(0, 7); refreshCalendar(); }
function moveCalendarFocus(date, days) { const target = addDays(date, days); state.month = target.slice(0, 7); refreshCalendar(); for (const button of byId('calendar-grid').children) button.tabIndex = button.dataset.calendarDate === target ? 0 : -1; byId('calendar-grid').querySelector('[data-calendar-date="' + target + '"]')?.focus(); }
byId('calendar-prev').addEventListener('click', () => moveMonth(-1)); byId('calendar-next').addEventListener('click', () => moveMonth(1));
byId('view-day').addEventListener('click', () => selectDate(state.date, 'day')); byId('view-week').addEventListener('click', () => selectDate(state.date, 'week'));
byId('latest-button').addEventListener('click', goLatest);
window.addEventListener('popstate', () => { const url = new URL(location.href); const date = url.searchParams.get('date'); state.followingLatest = !validDate(date); state.date = validDate(date) ? date : state.latest?.reportDate || state.date; state.month = state.date.slice(0, 7); state.mode = url.searchParams.get('view') === 'week' ? 'week' : 'day'; void loadSelection(); });
refreshCalendar(); showMode(); void loadReport();
setInterval(() => { if (!document.hidden) void loadReport({ quiet: true }); }, 5 * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadReport({ quiet: true }); });
