import { monthGrid, weekRange, dateLabel, summarizeWeek } from './history.mjs';
import { vietnamDate, formatTime, filterSections } from './lib.mjs';
import { renderMarkdown } from './markdown.mjs';

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
export function renderCalendar(container, { month, date, mode, index, availabilityKnown = true, onSelect, onMove }) {
  const focusedDate = document.activeElement?.dataset.calendarDate;
  const available = new Set(index?.reports.map(report => report.reportDate) || []);
  const range = weekRange(date); const today = vietnamDate();
  document.getElementById('calendar-month').textContent = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(month + '-01T12:00:00+07:00'));
  container.replaceChildren();
  for (const day of monthGrid(month)) {
    const button = make('button', String(Number(day.slice(-2))), 'calendar-day'); button.type = 'button'; button.dataset.calendarDate = day;
    const selected = mode === 'week' ? range.dates.includes(day) : day === date;
    button.setAttribute('aria-pressed', String(selected)); button.tabIndex = day === date ? 0 : -1;
    button.setAttribute('aria-label', dateLabel(day, { weekday: 'long' }) + (available.has(day) ? ' · Có bản tin' : availabilityKnown ? ' · Chưa có bản tin' : ' · Chưa xác nhận lịch sử'));
    if (day.slice(0, 7) !== month) button.classList.add('outside-month');
    if (available.has(day)) { button.classList.add('has-report'); button.append(make('span', null, 'calendar-dot')); }
    if (day === today) { button.classList.add('is-today'); button.setAttribute('aria-current', 'date'); }
    button.addEventListener('click', () => onSelect(day));
    button.addEventListener('keydown', event => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (event.key in moves) { event.preventDefault(); onMove(day, moves[event.key]); }
    }); container.append(button);
  }
  if (!container.querySelector('[tabindex="0"]')) container.querySelector('[data-calendar-date^="' + month + '"]')?.setAttribute('tabindex', '0');
  if (focusedDate) container.querySelector('[data-calendar-date="' + focusedDate + '"]')?.focus({ preventScroll: true });
}
export function renderWeek(container, reports, selectedDate, { filters, failures = [], availabilityKnown = true, onReadDay }) {
  const week = summarizeWeek(reports, selectedDate); container.replaceChildren(); container.setAttribute('aria-busy', 'false');
  const head = make('div', null, 'weekly-heading'); head.append(make('p', 'TỔNG HỢP TỪ BẢN TIN ĐÃ LƯU', 'eyebrow'), make('h2', 'Tuần ' + dateLabel(week.start) + ' – ' + dateLabel(week.end)), make('p', 'Theo ngày bản tin · Thứ Hai đến Chủ nhật · Asia/Ho_Chi_Minh', 'weekly-period')); container.append(head);
  const coverage = make('div', null, 'weekly-coverage'); coverage.append(make('strong', week.reports.length + ' / 7 ngày có bản tin'), make('span', week.sources.length + ' link nguồn trong các bản tin'));
  if (week.reports.length < 7) coverage.append(make('p', 'Tổng hợp chưa đủ tuần. Chỉ sử dụng những ngày đã có dữ liệu; ngày còn thiếu không được thay bằng bản tin của ngày khác.'));
  if (failures.length) coverage.append(make('p', 'Chưa tải được bản tin: ' + failures.map(date => dateLabel(date)).join(', ') + '. Hãy dùng nút làm mới để thử lại.', 'weekly-fetch-error'));
  if (!availabilityKnown) coverage.append(make('p', 'Danh sách lịch sử mới nhất chưa xác minh. Tổng hợp chỉ sử dụng các bản tin đã tải được.', 'weekly-fetch-error'));
  container.append(coverage);
  const timeline = make('div', null, 'week-timeline');
  for (const date of week.dates) {
    const report = week.reports.find(item => item.reportDate === date); const item = make('div', null, 'week-day-status'); item.append(make('span', dateLabel(date, { year: undefined })));
    if (report) { const button = make('button', 'Đọc bản tin', 'week-read-day'); button.type = 'button'; button.dataset.readDate = date; button.addEventListener('click', () => onReadDay(date)); item.append(button); }
    else item.append(make('span', failures.includes(date) ? 'Tải lỗi' : date > vietnamDate() ? 'Chưa tới ngày' : availabilityKnown ? 'Chưa có bản tin' : 'Chưa xác nhận', 'week-missing'));
    timeline.append(item);
  }
  container.append(timeline);
  const highlights = make('section', null, 'weekly-highlights'); highlights.append(make('h3', 'Điểm nổi bật trong tuần'), make('p', 'Trích nguyên ý từ mục tóm tắt của các bản tin hằng ngày; giữ nguồn, thời điểm và điều kiện của nhận định.', 'weekly-explanation'));
  highlights.id = 'week-topic-1'; highlights.tabIndex = -1;
  if (!week.highlights.length) highlights.append(make('p', week.reports.length ? 'Chưa có mục tóm tắt phù hợp để trích điểm nổi bật.' : 'Chưa có bản tin để tổng hợp trong tuần này.', 'weekly-empty'));
  for (const item of week.highlights) {
    const card = make('article', null, 'weekly-highlight'); card.append(make('p', 'Bản tin ' + dateLabel(item.reportDate) + ' · chốt ' + formatTime(item.cutoffAt), 'weekly-date'));
    const body = make('div', null, 'section-body'); body.append(renderMarkdown(item.markdown)); card.append(body); highlights.append(card);
  }
  container.append(highlights);
  const grouping = make('section', null, 'weekly-topics'); grouping.append(make('h3', 'Phân tích theo chủ đề'), make('p', 'Bộ lọc bên dưới tiêu đề bản tin áp dụng cho phần này. Mở từng ngày để đọc đầy đủ, không gộp giá khác thời điểm thành giá cuối tuần.', 'weekly-explanation'));
  let found = 0;
  for (const [id, entries] of week.groups) {
    const matching = entries.filter(({ report, section }) => filterSections([section], report, filters).length);
    if (!matching.length) continue; found += matching.length;
    const group = make('details', null, 'weekly-topic'); const summary = make('summary', matching[0].section.title + ' · ' + matching.length + ' bản tin'); group.append(summary);
    group.id = 'week-topic-' + id;
    for (const { report, section } of matching) {
      const day = make('details', null, 'weekly-topic-day'); day.append(make('summary', dateLabel(report.reportDate) + ' · chốt ' + formatTime(report.cutoffAt)));
      const body = make('div', null, 'section-body'); body.append(renderMarkdown(section.body)); day.append(body); group.append(day);
    } grouping.append(group);
  }
  if (!found && week.reports.length) grouping.append(make('p', 'Không có nội dung phù hợp với bộ lọc hiện tại.', 'weekly-empty'));
  container.append(grouping); return week;
}
