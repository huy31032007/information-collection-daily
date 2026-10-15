import { validateEconomicCalendar } from './economic-calendar.mjs';
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const MAX_CONTENT = 250_000;
export const TOPICS = [
  { id: 'all', label: 'Tất cả' },
  { id: '2', label: 'Chứng khoán' },
  { id: '3', label: 'Vàng' },
  { id: '4', label: 'Xăng dầu' },
  { id: '5', label: 'Kinh tế & tài chính' },
  { id: '6', label: 'Chính trị kinh tế' },
];
const SOURCE_NAMES = {
  'vietnamplus.vn': 'TTXVN / VietnamPlus', 'baochinhphu.vn': 'Báo Chính phủ',
  'nso.gov.vn': 'Cục Thống kê', 'moit.gov.vn': 'Bộ Công Thương',
  'sbv.gov.vn': 'Ngân hàng Nhà nước', 'hsx.vn': 'HOSE', 'hnx.vn': 'HNX',
  'pnj.com.vn': 'PNJ', 'kitco.com': 'Kitco', 'saigonpetro.com.vn': 'Saigon Petro',
  'vndirect.com.vn': 'VNDIRECT', 'stockbiz.vn': 'Stockbiz',
  'investing.com': 'Investing.com', 'apnews.com': 'AP', 'bls.gov': 'Cục Thống kê Lao động Mỹ',
};
export function safeLink(input) {
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function sourceName(hostname) {
  const host = hostname.replace(/^www\./, '');
  return Object.entries(SOURCE_NAMES).find(([domain]) => host === domain || host.endsWith('.' + domain))?.[1] || host;
}
export function extractSources(markdown) {
  const sources = new Map();
  for (const match of markdown.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    const href = safeLink(match[2]);
    if (href) { const url = new URL(href); sources.set(href, { href, label: match[1], host: url.hostname, name: sourceName(url.hostname) }); }
  }
  return [...sources.values()];
}
export function parseSections(markdown) {
  const sections = [];
  const headings = [...markdown.matchAll(/^## (.+)$/gm)];
  const intro = markdown.slice(0, headings[0]?.index ?? markdown.length).trim();
  for (let i = 0; i < headings.length; i++) {
    const title = headings[i][1].trim();
    const number = /^(\d+)\./.exec(title)?.[1] || 'glossary';
    const body = markdown.slice(headings[i].index + headings[i][0].length, headings[i + 1]?.index ?? markdown.length).trim();
    sections.push({ id: number, title: title.replace(/^\d+\.\s*/, ''), body, sources: extractSources(body) });
  }
  return { intro, sections };
}
export function vietnamDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function formatTime(value, options = {}) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', ...options }).format(new Date(value));
}
export function reportFreshness(report, now = new Date()) {
  return report.reportDate === vietnamDate(now) ? 'today' : 'older';
}
export function validateNewsletter(value, { now = new Date() } = {}) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Định dạng bản tin không hợp lệ.');
  for (const key of ['title', 'reportDate', 'cutoffAt', 'coverageStart', 'coverageEnd', 'exportedAt', 'sourceThreadId', 'markdown']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error('Bản tin thiếu nội dung hoặc thời điểm cần thiết.');
  }
  if (value.markdown.length > MAX_CONTENT || value.title.length > 200) throw new Error('Bản tin vượt giới hạn kích thước.');
  if (value.timezone !== TIMEZONE || !/^\d{4}-\d{2}-\d{2}$/.test(value.reportDate)) throw new Error('Ngày hoặc múi giờ bản tin không hợp lệ.');
  for (const key of ['cutoffAt', 'coverageStart', 'coverageEnd', 'exportedAt']) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value[key]);
    if (!parts || !Number.isFinite(Date.parse(value[key]))) throw new Error('Mốc thời gian bản tin không hợp lệ.');
    const numbers = parts.slice(1, 7).map(Number); const [year, month, day, hour, minute, second] = numbers;
    const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, 0);
    const roundTrip = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
    if (numbers.some((number, index) => number !== roundTrip[index])) throw new Error('Mốc thời gian bản tin không hợp lệ.');
    if (parts[7] !== 'Z') { const zoneHour = Number(parts[7].slice(1, 3)), zoneMinute = Number(parts[7].slice(4)); if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) throw new Error('Múi giờ thời điểm không hợp lệ.'); }
  }
  if (Date.parse(value.coverageStart) >= Date.parse(value.coverageEnd) || Date.parse(value.coverageEnd) !== Date.parse(value.cutoffAt) || vietnamDate(new Date(value.cutoffAt)) !== value.reportDate) throw new Error('Khoảng tổng hợp không khớp ngày và mốc chốt.');
  if (Date.parse(value.cutoffAt) > now.getTime() || Date.parse(value.exportedAt) > now.getTime() || Date.parse(value.exportedAt) < Date.parse(value.cutoffAt)) throw new Error('Thời điểm bản tin hoặc xuất bản chưa hợp lệ.');
  const ids = parseSections(value.markdown).sections.filter(s => /^\d+$/.test(s.id)).map(s => s.id);
  if (ids.join(',') !== '1,2,3,4,5,6,7,8,9') throw new Error('Bản tin chưa có đủ chín mục theo quy trình.');
  if (value.economic_calendar != null) validateEconomicCalendar(value.economic_calendar, { now, cutoffAt: value.cutoffAt, sourceThreadId: value.sourceThreadId });
  return value;
}
export function normalizeText(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
export function filterSections(sections, report, filters, now = new Date()) {
  if (filters.period === 'today' && reportFreshness(report, now) !== 'today') return [];
  if (filters.period === 'week' && Date.parse(report.cutoffAt) < now.getTime() - 7 * 86_400_000) return [];
  const search = normalizeText(filters.query || '').trim();
  return sections.filter(section => (filters.topic === 'all' || section.id === filters.topic)
    && (!filters.source || section.sources.some(source => source.name === filters.source))
    && (!search || normalizeText(section.title + ' ' + section.body).includes(search)));
}
