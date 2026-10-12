import { TIMEZONE, validateNewsletter, vietnamDate, parseSections, extractSources, normalizeText } from './lib.mjs';

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(value, days) {
  if (!validDate(value) || !Number.isInteger(days)) throw new Error('Ngày lịch không hợp lệ.');
  const date = new Date(value + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
export function weekRange(value) {
  if (!validDate(value)) throw new Error('Ngày của tuần không hợp lệ.');
  const weekday = new Date(value + 'T12:00:00Z').getUTCDay();
  const start = addDays(value, -((weekday + 6) % 7));
  return { start, end: addDays(start, 6), dates: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}
export function dateLabel(value, options = {}) {
  if (!validDate(value)) throw new Error('Ngày hiển thị không hợp lệ.');
  return new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', ...options }).format(new Date(value + 'T12:00:00+07:00'));
}
export function monthGrid(month) {
  const first = month + '-01'; if (!validDate(first)) throw new Error('Tháng lịch không hợp lệ.');
  const start = weekRange(first).start;
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function validateArchiveIndex(value, { now = new Date() } = {}) {
  if (!value || value.version !== 1 || value.timezone !== TIMEZONE || !Array.isArray(value.reports) || value.reports.length > 10000) throw new Error('Danh sách bản tin đã lưu không hợp lệ.');
  const dates = new Set();
  for (const row of value.reports) {
    if (!row || !validDate(row.reportDate) || dates.has(row.reportDate) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 200 || typeof row.cutoffAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.cutoffAt) || !Number.isFinite(Date.parse(row.cutoffAt)) || vietnamDate(new Date(row.cutoffAt)) !== row.reportDate || Date.parse(row.cutoffAt) > now.getTime()) throw new Error('Mốc ngày trong lịch bản tin không hợp lệ.');
    dates.add(row.reportDate);
    if (!validDate(row.cutoffAt.slice(0, 10))) throw new Error('Ngày chốt trong lịch không hợp lệ.');
    const time = row.cutoffAt.slice(11, 19).split(':').map(Number);
    if (time[0] > 23 || time[1] > 59 || time[2] > 59) throw new Error('Giờ chốt trong lịch không hợp lệ.');
  }
  return { ...value, reports: [...value.reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate)) };
}
export function validateArchivedReport(value, entry, options) {
  const report = validateNewsletter(value, options);
  if (!report || report.reportDate !== entry.reportDate || report.cutoffAt !== entry.cutoffAt) throw new Error('Bản tin đã lưu không khớp ngày hoặc mốc chốt trong lịch.');
  return report;
}
export function summarizeWeek(reports, selectedDate) {
  const range = weekRange(selectedDate); const unique = new Map();
  for (const report of reports) {
    if (!report || !range.dates.includes(report.reportDate)) continue;
    const current = unique.get(report.reportDate);
    if (!current || Date.parse(report.cutoffAt) > Date.parse(current.cutoffAt)) unique.set(report.reportDate, report);
  }
  const days = [...unique.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const groups = new Map(['2','3','4','5','6','7','8','9','glossary'].map(id => [id, []])); const queues = [];
  for (const report of days) {
    const sections = parseSections(report.markdown).sections;
    for (const section of sections) if (groups.has(section.id)) groups.get(section.id).push({ report, section });
    const quick = sections.find(section => section.id === '1');
    const blocks = quick?.body.split(/\n\s*\n/).filter(block => block.trim() && !/^#/.test(block)) || [];
    const bullets = blocks.flatMap(block => block.split(/\n(?=\s*(?:[-*]|\d+\.)\s+)/));
    queues.push(bullets.map(markdown => ({ reportDate: report.reportDate, cutoffAt: report.cutoffAt, markdown: markdown.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''), sources: extractSources(markdown) })));
  }
  const highlights = []; const seen = new Set(); let offset = 0;
  while (highlights.length < 5 && queues.some(queue => queue[offset])) {
    for (const queue of queues) {
      const item = queue[offset]; if (!item) continue;
      const key = normalizeText(item.markdown).replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) { highlights.push(item); seen.add(key); }
      if (highlights.length === 5) break;
    }
    offset++;
  }
  return { ...range, reports: days, availableDates: days.map(report => report.reportDate).sort(), missingDates: range.dates.filter(date => !unique.has(date)), sources: [...new Set(days.flatMap(report => extractSources(report.markdown).map(source => source.href)))], highlights, groups };
}
