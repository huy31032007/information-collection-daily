import { TOPICS, TIMEZONE, validateNewsletter, parseSections, extractSources, formatTime, reportFreshness, filterSections } from './lib.mjs';
import { renderMarkdown } from './markdown.mjs';

const byId = id => document.getElementById(id);
const state = { report: null, sections: [], busy: false, filters: { topic: 'all', source: '', period: 'any', query: '' } };
const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
function status(text, kind = '') { const node = byId('status'); node.textContent = text; node.className = 'status ' + kind; }

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
byId('reset-empty').addEventListener('click', () => { if (!state.report) { void loadReport(); return; } resetFilters(); byId('search').focus(); });
byId('refresh').addEventListener('click', () => loadReport());

function render() {
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
function installReport(report) {
  state.report = report; const parsed = parseSections(report.markdown); state.sections = parsed.sections;
  byId('report-date').textContent = new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(report.cutoffAt));
  byId('cutoff-time').textContent = 'Chốt ' + new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(report.cutoffAt));
  byId('coverage').textContent = formatTime(report.coverageStart, { year: undefined, second: undefined }) + ' → ' + formatTime(report.coverageEnd, { year: undefined, second: undefined });
  const sources = [...new Set(extractSources(report.markdown).map(source => source.name))].sort((a, b) => a.localeCompare(b, 'vi'));
  byId('source-count').textContent = String(sources.length); byId('section-count').textContent = '09';
  const options = [new Option('Tất cả nguồn', ''), ...sources.map(source => new Option(source, source))]; byId('source-filter').replaceChildren(...options);
  if (!sources.includes(state.filters.source)) state.filters.source = ''; byId('source-filter').value = state.filters.source;
  byId('report-context').replaceChildren(renderMarkdown(parsed.intro));
  const nav = byId('contents-nav'); nav.replaceChildren();
  for (const section of state.sections) {
    const anchor = make('a'); anchor.href = '#section-' + section.id; anchor.append(make('span', section.id === 'glossary' ? 'Aa' : section.id.padStart(2, '0'), 'nav-number'), make('span', section.title));
    anchor.addEventListener('click', event => { event.preventDefault(); resetFilters(); byId('section-' + section.id)?.scrollIntoView({ block: 'start' }); history.replaceState(null, '', anchor.hash); }); nav.append(anchor);
  }
  render();
}
function freshStatus(report) {
  if (reportFreshness(report) === 'older') status(`Chưa có bản tin hôm nay. Bản gần nhất chốt ${formatTime(report.cutoffAt)} giờ Việt Nam; giá giữ theo thời điểm trong nguồn.`, 'warning');
  else status(`Bản tin ngày ${byId('report-date').textContent} · chốt ${byId('cutoff-time').textContent.replace('Chốt ', '')} giờ Việt Nam. Giá là dữ liệu tại thời điểm nguồn, không phải báo giá trực tiếp.`);
}
async function loadReport({ quiet = false } = {}) {
  if (state.busy) return; state.busy = true; const button = byId('refresh'); button.disabled = true; button.classList.add('is-loading');
  byId('report-content').setAttribute('aria-busy', 'true');
  if (!quiet) status(state.report ? 'Đang kiểm tra bản tin đã xuất bản. Nội dung đang đọc vẫn được giữ nguyên…' : 'Đang tải bản tin đã xuất bản…', 'loading');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('./data/latest.json', { signal: controller.signal, cache: 'no-cache', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Không tải được bản tin đã xuất bản.');
    if (Number(response.headers.get('content-length')) > 600_000) throw new Error('Bản tin vượt giới hạn kích thước.');
    const raw = await response.text(); if (raw.length > 600_000) throw new Error('Bản tin vượt giới hạn kích thước.');
    let report; try { report = validateNewsletter(JSON.parse(raw)); } catch (error) { throw new Error(error instanceof SyntaxError ? 'Dữ liệu bản tin chưa đọc được.' : error.message); }
    if (!report) {
      if (state.report) status('Chưa có bản tin mới trong dữ liệu đã xuất bản. Đang giữ bản gần nhất và thời điểm gốc.', 'warning');
      else { status('Chưa có bản tin được xuất bản. Nội dung sẽ xuất hiện sau lần tổng hợp và xuất bản thành công.', 'warning'); byId('report-date').textContent = 'Chưa có bản tin'; byId('cutoff-time').textContent = 'Chưa có mốc chốt dữ liệu'; byId('result-count').textContent = 'Chưa có nội dung để lọc'; byId('no-results').hidden = false; byId('no-results').querySelector('h2').textContent = 'Chưa có bản tin'; byId('no-results').querySelector('p').textContent = 'Bản tin sẽ xuất hiện sau khi quy trình hằng ngày hoàn tất việc tổng hợp và xuất bản. Bạn có thể thử tải lại.'; byId('reset-empty').textContent = 'Thử tải lại'; }
      return;
    }
    if (state.report && Date.parse(report.cutoffAt) < Date.parse(state.report.cutoffAt)) { status('Dữ liệu vừa tải về cũ hơn bản đang đọc. Đang giữ bản gần nhất và thời điểm gốc.', 'warning'); return; }
    const previous = state.report;
    const changed = !previous || ['markdown', 'cutoffAt', 'title', 'reportDate', 'coverageStart', 'coverageEnd'].some(key => report[key] !== previous[key]);
    if (changed) installReport(report); else state.report = report;
    byId('no-results').querySelector('h2').textContent = 'Không có mục phù hợp'; byId('no-results').querySelector('p').textContent = 'Thử đổi từ khóa, nguồn hoặc khoảng thời gian. Bộ lọc thời gian áp dụng cho ngày bản tin, không đổi thời điểm của từng giá.'; byId('reset-empty').textContent = 'Xem bản tin gần nhất'; freshStatus(report);
    byId('last-loaded').textContent = 'Kiểm tra bản đã xuất bản lúc ' + formatTime(new Date().toISOString()) + ' · giờ Việt Nam';
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Tải bản tin quá thời gian chờ.' : error.message;
    status(message + (state.report ? ` Đang giữ bản chốt ${formatTime(state.report.cutoffAt)} giờ Việt Nam; chưa xác nhận cập nhật mới.` : ' Hãy thử nút Làm mới bản tin.'), 'error');
    if (!state.report) { byId('report-date').textContent = 'Chưa tải được'; byId('cutoff-time').textContent = 'Thời điểm bản tin chưa xác minh'; }
  } finally { clearTimeout(timer); state.busy = false; button.disabled = false; button.classList.remove('is-loading'); byId('report-content').setAttribute('aria-busy', 'false'); }
}
void loadReport();
setInterval(() => { if (!document.hidden) void loadReport({ quiet: true }); }, 5 * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadReport({ quiet: true }); });
