import { renderTrendPanel } from './trend-chart.mjs';
import { createEconomicCalendar } from './economic-calendar-ui.mjs';
import { enhanceMarketLearning, enhanceReportLearning } from './learning-ui.mjs';
import { TOPICS, TIMEZONE, PUBLICATION_TIME, validateNewsletter, parseSections, extractSources, formatTime, editionStatus, filterSections, normalizeText, vietnamDate } from './lib.mjs';
import { renderMarkdown } from './markdown.mjs';
import { renderDashboard, renderReportList } from './dashboard.mjs';
import { validDate, addDays, dateLabel, weekRange, validateArchiveIndex, validateArchivedReport } from './history.mjs';
import { renderCalendar, renderWeek } from './history-ui.mjs';

const byId = id => document.getElementById(id);
const initialDate = new URL(location.href).searchParams.get('date');
const state = { report: null, sections: [], latest: null, index: null, indexError: '', busy: false, date: validDate(initialDate) ? initialDate : vietnamDate(), mode: new URL(location.href).searchParams.get('view') === 'week' ? 'week' : 'day', followingLatest: !validDate(initialDate), month: '', selectionRequest: 0, weekReports: [], weekKey: '', weekFailures: [], filters: { topic: 'all', source: '', period: 'any', query: '' } };
state.month = state.date.slice(0, 7);
const archiveCache = new Map();
const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
function status(text, kind = '') { const node = byId('status'); node.textContent = text; node.className = 'status ' + kind; }
// Preferences are conveniences only; private windows or blocked storage fall back to defaults.
const prefs = {
  get(key) { try { return localStorage.getItem('ban-tin:' + key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem('ban-tin:' + key, value); } catch { /* ignore */ } },
};
const shortTime = value => formatTime(value, { year: undefined, second: undefined });

function setHistoryExpanded(expanded, { remember = false } = {}) {
  byId('history-body').hidden = !expanded;
  byId('history-panel').classList.toggle('is-collapsed', !expanded);
  byId('toggle-history').setAttribute('aria-expanded', String(expanded));
  byId('toggle-history-label').textContent = expanded ? 'Thu gọn lịch' : 'Mở lịch';
  if (remember) prefs.set('history-expanded', String(expanded));
  if (typeof observeSections === 'function' && state.report) observeSections();
}
byId('toggle-history').addEventListener('click', () => setHistoryExpanded(byId('history-body').hidden, { remember: true }));
// The calendar is long; keep it closed until asked for so market data is visible first.
setHistoryExpanded(validDate(initialDate) || new URL(location.href).searchParams.get('view') === 'week' || prefs.get('history-expanded') === 'true');

// Theme: auto follows the system; the choice is remembered per browser.
const THEMES = ['auto', 'light', 'dark'];
const THEME_LABELS = { auto: 'Tự động theo hệ thống', light: 'Sáng', dark: 'Tối' };
function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
  const button = byId('theme-toggle'); button.dataset.themeState = theme;
  const label = 'Giao diện: ' + THEME_LABELS[theme] + '. Bấm để đổi';
  button.setAttribute('aria-label', label); button.title = label;
}
applyTheme(THEMES.includes(prefs.get('theme')) ? prefs.get('theme') : 'auto');
byId('theme-toggle').addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(byId('theme-toggle').dataset.themeState) + 1) % THEMES.length];
  applyTheme(next); prefs.set('theme', next);
});

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
    if (byId('toggle-sidebar').getAttribute('aria-expanded') === 'true' && !byId('sidebar').contains(document.activeElement)) byId('sidebar-close').focus();
  });
}
byId('toggle-sidebar').addEventListener('click', toggleNavigation);
byId('sidebar-close').addEventListener('click', () => closeNavigation({ focus: true }));
byId('sidebar-overlay').addEventListener('click', () => closeNavigation({ focus: true }));
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'b' && !event.repeat && !event.target.closest?.('input, textarea, select, [contenteditable]')) {
    event.preventDefault(); toggleNavigation();
  }
  if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeNavigation({ focus: true });
  if (event.key === 'Tab' && document.body.classList.contains('sidebar-open')) {
    const controls = [...byId('sidebar').querySelectorAll('a, button')].filter(node => node.getClientRects().length && !node.disabled); const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobileNavigation.addEventListener('change', () => {
  document.body.classList.remove('sidebar-open'); syncNavigation();
  if (byId('sidebar').inert && byId('sidebar').contains(document.activeElement)) byId('toggle-sidebar').focus();
}); syncNavigation();
const navTarget = hash => document.querySelector(state.mode === 'week' ? hash === '#market-overview' ? '#weekly-content' : hash.replace('#section-', '#week-topic-') : hash);
function markNav(hash) { for (const link of document.querySelectorAll('[data-dashboard-nav]')) { if (link.hash === hash) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); } }
for (const anchor of document.querySelectorAll('[data-dashboard-nav]')) anchor.addEventListener('click', event => {
  event.preventDefault(); resetFilters(); if (mobileNavigation.matches) closeNavigation();
  if (anchor.hash === '#history-panel') setHistoryExpanded(true, { remember: true });
  const target = navTarget(anchor.hash); if (target?.tagName === 'DETAILS') target.open = true; target?.scrollIntoView({ block: 'start' });
  const focusTarget = target?.querySelector('summary') || target;
  if (focusTarget && !focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1;
  focusTarget?.focus({ preventScroll: true });
  history.replaceState(null, '', anchor.hash);
  markNav(anchor.hash); spy.pausedUntil = Date.now() + 900;
});
// Links from the dashboard into a section clear filters first so the section is present.
byId('market-overview').addEventListener('click', event => {
  const link = event.target.closest('a[href^="#section-"]'); if (!link) return;
  event.preventDefault(); resetFilters(); const target = byId(link.hash.slice(1)); target?.scrollIntoView({ block: 'start' });
  target?.querySelector('h2')?.setAttribute('tabindex', '-1'); target?.querySelector('h2')?.focus({ preventScroll: true });
  history.replaceState(null, '', link.hash); markNav(link.hash);
});

// Scroll spy: highlight the sidebar entry for the section being read.
const spy = { observer: null, visible: new Map(), pausedUntil: 0 };
function observeSections() {
  spy.observer?.disconnect(); spy.visible.clear();
  if (!('IntersectionObserver' in window)) return;
  const links = [...document.querySelectorAll('[data-dashboard-nav]')];
  const targets = new Map(links.map(link => [navTarget(link.hash), link.hash]).filter(([node]) => node && !node.hidden && !node.classList.contains('is-collapsed')));
  spy.observer = new IntersectionObserver(entries => {
    for (const entry of entries) { if (entry.isIntersecting) spy.visible.set(entry.target, entry.boundingClientRect.top); else spy.visible.delete(entry.target); }
    if (Date.now() < spy.pausedUntil) return;
    if (scrollY < 160 || !spy.visible.size) { if (scrollY < 160) markNav('#market-overview'); return; }
    const [top] = [...spy.visible.keys()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    markNav(targets.get(top));
  }, { rootMargin: '-96px 0px -55% 0px' });
  for (const node of targets.keys()) spy.observer.observe(node);
}

for (const topic of TOPICS) {
  const button = make('button', topic.label); button.type = 'button'; button.dataset.topic = topic.id; button.setAttribute('aria-pressed', topic.id === 'all' ? 'true' : 'false');
  button.addEventListener('click', () => { state.filters.topic = topic.id; render(); }); byId('topics').append(button);
}
function resetFilters() {
  state.filters = { topic: 'all', source: '', period: 'any', query: '' };
  byId('search').value = ''; render();
}
let searchTimer = 0;
byId('search').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.filters.query = event.target.value; render(); }, 140); });
// Enter jumps through highlighted matches; Escape clears the query.
byId('search').addEventListener('keydown', event => {
  if (event.key === 'Escape' && event.target.value) { event.preventDefault(); event.target.value = ''; clearTimeout(searchTimer); state.filters.query = ''; render(); return; }
  if (event.key !== 'Enter') return; event.preventDefault();
  clearTimeout(searchTimer); if (state.filters.query !== event.target.value) { state.filters.query = event.target.value; render(); }
  const hits = [...byId('report-content').querySelectorAll('mark.search-hit')]; if (!hits.length) return;
  const current = hits.findIndex(hit => hit.classList.contains('is-current')); hits[current]?.classList.remove('is-current');
  const next = hits[(current + (event.shiftKey ? -1 + hits.length : 1)) % hits.length]; next.classList.add('is-current');
  next.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  byId('result-count').textContent = searchSummary(hits.length, hits.indexOf(next) + 1);
});
byId('clear-filters').addEventListener('click', () => { resetFilters(); byId('search').focus(); });

function clearHighlights(root) {
  for (const mark of root.querySelectorAll('mark.search-hit')) { const parent = mark.parentNode; mark.replaceWith(...mark.childNodes); parent.normalize(); }
}
// Accent-insensitive highlighting that maps folded text back to the original characters.
function highlightMatches(root, query) {
  clearHighlights(root);
  const needle = normalizeText(query || '').trim(); if (needle.length < 2) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement.closest('summary, .type-badge, .section-number') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  let count = 0;
  for (const node of nodes) {
    const text = node.data; let folded = ''; const map = [];
    for (let i = 0; i < text.length; i++) { const piece = normalizeText(text[i]); for (let k = 0; k < piece.length; k++) map.push(i); folded += piece; }
    const ranges = []; let from = 0, index;
    while (needle && (index = folded.indexOf(needle, from)) !== -1) { ranges.push([map[index], map[index + needle.length - 1] + 1]); from = index + needle.length; }
    if (!ranges.length) continue;
    const fragment = document.createDocumentFragment(); let cursor = 0;
    for (const [start, end] of ranges) { fragment.append(text.slice(cursor, start), make('mark', text.slice(start, end), 'search-hit')); cursor = end; count++; }
    fragment.append(text.slice(cursor)); node.replaceWith(fragment);
  }
  return count;
}
const searchSummary = (total, position) => `${total} kết quả${position ? ` · đang ở ${position}/${total}` : ''} · Enter để tới kết quả tiếp theo`;
byId('reset-empty').addEventListener('click', () => { if (!state.report) { if (!state.followingLatest) goLatest(); else void loadReport(); return; } resetFilters(); byId('search').focus(); });
byId('refresh').addEventListener('click', () => loadReport());

function render() {
  if (state.mode === 'week') {
    if (state.selectionLoading && state.weekKey !== weekRange(state.date).start) return;
    for (const button of byId('topics').children) button.setAttribute('aria-pressed', String(button.dataset.topic === state.filters.topic));
    const week = renderWeek(byId('weekly-content'), state.weekReports, state.date, { filters: state.filters, failures: state.weekFailures, availabilityKnown: Boolean(state.index) && !state.indexError, onReadDay: date => selectDate(date, 'day') });
    byId('result-count').textContent = `${week.reports.length} bản tin trong tuần · bộ lọc áp dụng cho phân tích theo chủ đề`;
    observeSections(); return;
  }
  const content = byId('report-content');
  for (const button of byId('topics').children) button.setAttribute('aria-pressed', String(button.dataset.topic === state.filters.topic));
  if (!state.report) { content.replaceChildren(); return; }
  // Section 9 (sources) stays in the data for verification but is not shown to readers.
  const sections = filterSections(state.sections, state.report, state.filters).filter(section => section.id !== '9');
  byId('no-results').hidden = sections.length !== 0;
  const count = sections.filter(s => s.id !== 'glossary').length;
  byId('result-count').textContent = `${count} / 8 chuyên mục${sections.some(s => s.id === 'glossary') ? ' · kèm giải thích thuật ngữ' : ''}`;
  renderReportList(content, sections);
  enhanceReportLearning(content);
  const hits = highlightMatches(content, state.filters.query);
  if (state.filters.query.trim().length >= 2 && sections.length) byId('result-count').textContent = `${count} / 8 chuyên mục · ` + searchSummary(hits);
  observeSections();
}
function setDayMetadata(report) {
  byId('report-date').textContent = dateLabel(report.reportDate);
  const cutoffDate = vietnamDate(new Date(report.cutoffAt));
  byId('cutoff-time').textContent = 'Chốt ' + new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(report.cutoffAt)) + (cutoffDate !== report.reportDate ? ' · ' + dateLabel(cutoffDate) : '');
  byId('coverage').textContent = formatTime(report.coverageStart, { year: undefined, second: undefined }) + ' → ' + formatTime(report.coverageEnd, { year: undefined, second: undefined });
  byId('section-count').textContent = '08';
  byId('exported-at').textContent = shortTime(report.exportedAt);
}
function installReport(report) {
  state.report = report; const parsed = parseSections(report.markdown); state.sections = parsed.sections;
  renderDashboard(byId('market-overview'), state.sections, report);
  enhanceMarketLearning(byId('market-overview'));
  void mountTrend(report.reportDate);
  setDayMetadata(report);
  byId('report-context').replaceChildren(renderMarkdown(parsed.intro));
  render();
}
// The trend chart loads its series once, lazily, and re-mounts whenever the dashboard re-renders.
let seriesPromise = null;
async function mountTrend(currentDate) {
  seriesPromise ??= fetchJSON('./data/market-series.json', 2_000_000).catch(error => { seriesPromise = null; throw error; });
  try {
    const series = await seriesPromise; const slot = byId('trend-slot'); if (!slot) return;
    renderTrendPanel(slot, { series, currentDate, onSelectDate: date => { if (date === state.latest?.reportDate) goLatest(); else selectDate(date, 'day'); byId('market-overview').scrollIntoView({ block: 'start' }); } });
  } catch { byId('trend-slot')?.replaceChildren(make('p', 'Chưa tải được dữ liệu diễn biến. Hãy làm mới để thử lại.', 'chart-empty')); }
}
function freshStatus(report) {
  const edition = `bản tin ngày ${dateLabel(report.reportDate)} (chốt ${shortTime(report.cutoffAt)})`;
  if (report.edition === 'backfill') { status(`Đang xem bản làm bù cho ngày ${dateLabel(report.reportDate)}, soạn lúc ${shortTime(report.cutoffAt)}. Thông tin sau ngày ${dateLabel(report.reportDate, { year: undefined })} được ghi riêng trong bản tin.`, 'info'); return; }
  if (!state.followingLatest) { status(`Đang xem ${edition} trong kho lưu trữ. Giá giữ đúng thời điểm nguồn của ngày đó.`, 'info'); return; }
  const stage = editionStatus(report);
  if (stage === 'today') status(`Bản tin hôm nay · chốt ${shortTime(report.cutoffAt)} giờ Việt Nam. Giá là dữ liệu tại thời điểm nguồn, không phải báo giá trực tiếp.`);
  else if (stage === 'awaiting') status(`Đang hiển thị ${edition}. Bản tin hôm nay được tổng hợp lúc ${PUBLICATION_TIME} giờ Việt Nam.`, 'info');
  else if (stage === 'compiling') status(`Bản tin tối nay đang được tổng hợp; tạm hiển thị ${edition}. Trang tự kiểm tra lại mỗi 5 phút.`, 'info');
  else status(`Chưa có bản tin mới. Bản gần nhất là ${edition}; giá giữ theo thời điểm trong nguồn.`, 'warning');
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
  if (state.latest) { const i = entries.findIndex(entry => entry.reportDate === state.latest.reportDate); const row = { reportDate: state.latest.reportDate, cutoffAt: state.latest.cutoffAt, title: state.latest.title, ...(state.latest.edition ? { edition: state.latest.edition } : {}) }; if (i < 0) entries.push(row); else if (Date.parse(state.latest.cutoffAt) > Date.parse(entries[i].cutoffAt)) entries[i] = row; }
  return entries;
}
function refreshCalendar() {
  renderCalendar(byId('calendar-grid'), { month: state.month, date: state.date, mode: state.mode, index: { reports: knownEntries() }, availabilityKnown: Boolean(state.index) && !state.indexError, eventDates: economicCalendar.eventDates, onSelect: date => selectDate(date), onMove: moveCalendarFocus });
  const range = weekRange(state.date);
  byId('history-selection').textContent = state.mode === 'week' ? 'Tuần ' + dateLabel(range.start) + ' – ' + dateLabel(range.end) : 'Ngày ' + dateLabel(state.date);
  byId('view-day').setAttribute('aria-pressed', String(state.mode === 'day')); byId('view-week').setAttribute('aria-pressed', String(state.mode === 'week'));
  const entries = knownEntries(); const entry = entries.find(row => row.reportDate === state.date);
  byId('history-detail').textContent = state.mode === 'week' ? `Có ${entries.filter(row => range.dates.includes(row.reportDate)).length} bản tin đã biết trong tuần. Những ngày thiếu sẽ được ghi rõ.` : entry ? entry.title + ' · chốt ' + formatTime(entry.cutoffAt) : state.index ? 'Chưa có bản tin được lưu cho ngày này.' : 'Chưa tải đủ lịch sử để xác nhận dữ liệu của ngày này.';
  byId('history-status').textContent = state.indexError || (state.index ? `Đã lưu ${state.index.reports.length} ngày · Giờ Việt Nam` : 'Đang tải lịch bản tin…');
  byId('history-status').classList.toggle('history-error', Boolean(state.indexError)); byId('latest-button').disabled = !state.latest;
  updateEditionNav(entries);
  economicCalendar.render();
}
// Previous/next edition buttons step through archived days (or whole weeks in week mode).
function editionNeighbours(entries = knownEntries()) {
  if (state.mode === 'week') {
    const start = weekRange(state.date).start;
    return { prev: addDays(start, -7), next: start < weekRange(vietnamDate()).start ? addDays(start, 7) : null };
  }
  const dates = entries.map(entry => entry.reportDate).sort();
  return { prev: dates.filter(date => date < state.date).at(-1) || null, next: dates.find(date => date > state.date) || null };
}
function updateEditionNav(entries) {
  const { prev, next } = editionNeighbours(entries); const unit = state.mode === 'week' ? 'Tuần' : 'Bản tin';
  for (const [id, date, word] of [['edition-prev', prev, 'trước'], ['edition-next', next, 'sau']]) {
    const button = byId(id); button.disabled = !date;
    const label = date ? `${unit} ${word}: ${state.mode === 'week' ? 'từ ' : ''}${dateLabel(date)}` : `Không có ${unit.toLowerCase()} ${word}`;
    button.setAttribute('aria-label', label); button.title = label + (date ? (word === 'trước' ? ' ( [ )' : ' ( ] )') : '');
  }
}
function stepEdition(direction) {
  const date = editionNeighbours()[direction]; if (!date) return;
  if (state.mode === 'day' && date === state.latest?.reportDate) goLatest(); else selectDate(date, state.mode);
}
function showMode() {
  const weekly = state.mode === 'week';
  byId('market-overview').hidden = weekly; byId('daily-overview').hidden = weekly; byId('daily-reader').hidden = weekly; byId('weekly-content').hidden = !weekly;
  byId('page-title').textContent = weekly ? 'Tổng hợp thông tin tuần' : 'Toàn cảnh thị trường';
  byId('edition-kicker').textContent = weekly ? 'TUẦN ĐƯỢC CHỌN' : state.followingLatest ? 'BẢN TIN GẦN NHẤT' : 'BẢN TIN ĐƯỢC CHỌN';
  byId('reading-title').textContent = weekly ? 'Tổng hợp & phân tích theo tuần' : 'Bản tin & phân tích đầy đủ';
  if (weekly) { const range = weekRange(state.date); byId('report-date').textContent = dateLabel(range.start, { year: undefined }) + ' – ' + dateLabel(range.end); }
}
function clearDay(message) {
  state.report = null; state.sections = []; byId('report-content').replaceChildren(); byId('report-context').replaceChildren();
  renderDashboard(byId('market-overview'), [], null); byId('report-date').textContent = dateLabel(state.date); byId('cutoff-time').textContent = 'Chưa có mốc chốt dữ liệu';
  byId('coverage').textContent = '—'; byId('section-count').textContent = '—'; byId('exported-at').textContent = '—';
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
    if (!state.index) { state.selectionLoading = false; byId('weekly-content').setAttribute('aria-busy', 'false'); byId('cutoff-time').textContent = 'Lịch sử chưa xác minh'; byId('weekly-content').replaceChildren(make('p', 'Chưa tải được lịch bản tin để tổng hợp tuần. Hãy làm mới để thử lại.', 'weekly-empty')); status('Chưa xác nhận được đầy đủ danh sách bản tin trong tuần.', 'error'); refreshCalendar(); return; }
    if (state.weekKey !== range.start) { state.weekReports = []; state.weekFailures = []; byId('weekly-content').replaceChildren(make('p', 'Đang tải các bản tin trong tuần…', 'weekly-loading')); }
    byId('weekly-content').setAttribute('aria-busy', 'true'); byId('cutoff-time').textContent = 'Đang tổng hợp bản tin đã lưu';
    const entries = knownEntries().filter(entry => range.dates.includes(entry.reportDate));
    const results = await Promise.allSettled(entries.map(entry => archivedReport(entry.reportDate)));
    if (request !== state.selectionRequest) return;
    const reports = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
    const failures = entries.filter((_, i) => results[i].status === 'rejected').map(entry => entry.reportDate);
    const changed = state.weekKey !== range.start || JSON.stringify(state.weekFailures) !== JSON.stringify(failures) || JSON.stringify(state.weekReports) !== JSON.stringify(reports);
    state.selectionLoading = false; state.weekReports = reports; state.weekFailures = failures; state.weekKey = range.start;
    if (changed || !quiet) render(); byId('weekly-content').setAttribute('aria-busy', 'false');
    byId('cutoff-time').textContent = `${reports.length} / 7 ngày có bản tin`;
    status(`Tổng hợp tuần ${dateLabel(range.start)} – ${dateLabel(range.end)} từ ${reports.length} ngày đã lưu.${failures.length ? ' Có bản tin tải lỗi; dữ liệu tuần chưa đầy đủ.' : reports.length < 7 ? ' Chưa đủ dữ liệu cả tuần.' : ''} Giá và nhận định giữ mốc của từng bản tin.`, failures.length ? 'error' : reports.length < 7 ? 'warning' : '');
    refreshCalendar(); return;
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
    byId('no-results').querySelector('h2').textContent = 'Không có mục phù hợp'; byId('no-results').querySelector('p').textContent = 'Thử đổi từ khóa hoặc chủ đề.'; byId('reset-empty').textContent = 'Xem bản tin gần nhất'; freshStatus(report);
  } catch (error) {
    if (request !== state.selectionRequest) return;
    if (!state.report || state.report.reportDate !== date) clearDay('Không tải được bản tin đúng ngày bạn chọn. Hãy thử làm mới.');
    status('Không tải được bản tin ngày ' + dateLabel(date) + '.' + (state.report ? ' Giữ bản đang đọc với mốc gốc.' : ' Hãy thử làm mới.'), 'error');
  } finally { if (request === state.selectionRequest) { state.selectionLoading = false; byId('report-content').setAttribute('aria-busy', 'false'); refreshCalendar(); } }
}
async function loadReport({ quiet = false } = {}) {
  void economicCalendar.refresh();
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
  state.filters = { topic: 'all', source: '', period: 'any', query: '' }; byId('search').value = '';
  updateURL(); void loadSelection();
}
function goLatest() {
  if (!state.latest) { void loadReport(); return; } state.mode = 'day'; state.followingLatest = true; state.date = state.latest.reportDate; state.month = state.date.slice(0, 7);
  state.filters = { topic: 'all', source: '', period: 'any', query: '' }; byId('search').value = ''; updateURL(); void loadSelection();
}
function moveMonth(delta) { const date = new Date(state.month + '-01T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() + delta); state.month = date.toISOString().slice(0, 7); refreshCalendar(); }
function moveCalendarFocus(date, days) { const target = addDays(date, days); state.month = target.slice(0, 7); refreshCalendar(); for (const button of byId('calendar-grid').children) button.tabIndex = button.dataset.calendarDate === target ? 0 : -1; byId('calendar-grid').querySelector('[data-calendar-date="' + target + '"]')?.focus(); }
byId('calendar-prev').addEventListener('click', () => moveMonth(-1)); byId('calendar-next').addEventListener('click', () => moveMonth(1));
byId('view-day').addEventListener('click', () => selectDate(state.date, 'day')); byId('view-week').addEventListener('click', () => selectDate(state.date, 'week'));
byId('latest-button').addEventListener('click', goLatest);
byId('edition-prev').addEventListener('click', () => stepEdition('prev'));
byId('edition-next').addEventListener('click', () => stepEdition('next'));

// Keyboard: "/" focuses search, "[" and "]" step between editions.
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (event.key === '/') { event.preventDefault(); byId('search').focus(); byId('search').select(); }
  else if (event.key === '[') stepEdition('prev');
  else if (event.key === ']') stepEdition('next');
});

// Back-to-top appears once the reader is well into the long report.
let scrollFrame = 0;
window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; byId('back-to-top').classList.toggle('is-visible', scrollY > 1200); });
}, { passive: true });
byId('back-to-top').addEventListener('click', () => {
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  byId('page-title').focus({ preventScroll: true });
});
window.addEventListener('popstate', () => { const url = new URL(location.href); const date = url.searchParams.get('date'); state.followingLatest = !validDate(date); state.date = validDate(date) ? date : state.latest?.reportDate || state.date; state.month = state.date.slice(0, 7); state.mode = url.searchParams.get('view') === 'week' ? 'week' : 'day'; void loadSelection(); });
const economicCalendar = createEconomicCalendar({
  fetchJSON,
  getReport: () => state.mode === 'day' && state.report?.reportDate === state.date ? state.report : null,
  getSelection: () => ({ date: state.date, mode: state.mode, loading: Boolean(state.selectionLoading) }),
  onSelect: date => selectDate(date, 'day'),
  onChange: refreshCalendar
});
refreshCalendar(); showMode(); void loadReport();
setInterval(() => { if (!document.hidden) void loadReport({ quiet: true }); }, 5 * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadReport({ quiet: true }); });
