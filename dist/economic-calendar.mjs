// Published snapshots only: this module never requests external financial sources.
export const CALENDAR_TIMEZONE = 'Asia/Ho_Chi_Minh';
const fail = message => { throw new Error('Lịch kinh tế: ' + message); };
const text = (value, max = 1200) => typeof value === 'string' && value.trim() && value.length <= max;
export const calendarDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
function instant(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !validDate(match[1]) || +match[2] > 23 || +match[3] > 59 || +match[4] > 59 || !Number.isFinite(Date.parse(value))) return false;
  return match[5] === 'Z' || (+match[5].slice(1, 3) <= 14 && +match[5].slice(4) <= 59 && (+match[5].slice(1, 3) < 14 || +match[5].slice(4) === 0));
}
function source(value) {
  if (!value || !text(value.name, 120) || !text(value.url, 2000)) fail('nguồn chưa hợp lệ.');
  let url; try { url = new URL(value.url); } catch { fail('link nguồn chưa hợp lệ.'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('link nguồn phải dùng HTTPS và không chứa thông tin đăng nhập.');
}
function point(value, checkedAt) {
  if (value == null) return;
  if (!value || !((typeof value.value === 'number' && Number.isFinite(value.value)) || text(value.value, 80)) || !text(value.period, 100)) fail('giá trị hoặc kỳ dữ liệu chưa hợp lệ.');
  source(value.source);
  if (!instant(value.publishedAt) || Date.parse(value.publishedAt) > checkedAt) fail('thời điểm công bố chưa hợp lệ.');
  if (value.revisedFrom != null && !((typeof value.revisedFrom === 'number' && Number.isFinite(value.revisedFrom)) || text(value.revisedFrom, 80))) fail('số điều chỉnh chưa hợp lệ.');
}
export function validateEconomicCalendar(value, { now = new Date(), cutoffAt, sourceThreadId } = {}) {
  if (value == null) return null;
  if (value.version !== 1 || value.timezone !== CALENDAR_TIMEZONE || !text(value.sourceThreadId, 150) || !instant(value.checkedAt)) fail('thiếu phiên bản, múi giờ hoặc mốc kiểm tra.');
  const checkedAt = Date.parse(value.checkedAt);
  if (checkedAt > now.getTime() || (cutoffAt && checkedAt > Date.parse(cutoffAt))) fail('dữ liệu vượt mốc chốt.');
  if (sourceThreadId && value.sourceThreadId !== sourceThreadId) fail('khác quy trình bản tin.');
  if (!validDate(value.coverageStart) || !validDate(value.coverageEnd) || value.coverageStart > value.coverageEnd) fail('phạm vi ngày chưa hợp lệ.');
  if (!Array.isArray(value.events) || value.events.length > 200) fail('danh sách sự kiện chưa hợp lệ.');
  const ids = new Set();
  for (const event of value.events) {
    if (!event || typeof event.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(event.id) || ids.has(event.id)) fail('mã sự kiện thiếu hoặc trùng.');
    ids.add(event.id);
    if (!text(event.title, 240) || !text(event.period, 100) || !/^[A-Z]{2}$/.test(event.country) || !/^[A-Z]{3}$/.test(event.currency)) fail('tên, kỳ hoặc quốc gia chưa hợp lệ.');
    if (!['high', 'medium', 'low'].includes(event.impact) || !text(event.impactReason) || !text(event.description, 2000)) fail('thiếu giải thích chỉ tiêu hoặc mức theo dõi.');
    if (!['scheduled', 'released', 'postponed'].includes(event.status) || !validDate(event.scheduledDate) || event.scheduledDate < value.coverageStart || event.scheduledDate > value.coverageEnd) fail('trạng thái hoặc ngày sự kiện chưa hợp lệ.');
    if (event.scheduledAt != null && (!instant(event.scheduledAt) || calendarDate(event.scheduledAt) !== event.scheduledDate)) fail('giờ công bố không khớp ngày Việt Nam.');
    try { new Intl.DateTimeFormat('en', { timeZone: event.sourceTimezone }).format(); } catch { fail('múi giờ nguồn chưa hợp lệ.'); }
    if (!text(event.sourceTimezone, 80)) fail('thiếu múi giờ nguồn.');
    source(event.scheduleSource);
    if (!event.analysis || !['mechanism', 'vietnam', 'conditions'].every(key => text(event.analysis[key], 2400))) fail('thiếu cơ chế tác động và điều kiện nhận định.');
    if (!Array.isArray(event.metrics) || event.metrics.length > 12) fail('chỉ tiêu chưa hợp lệ.');
    const labels = new Set(); let actualCount = 0;
    for (const metric of event.metrics) {
      if (!text(metric.label, 150) || labels.has(metric.label) || !text(metric.unit, 60) || !text(metric.basis, 300)) fail('nhãn, đơn vị hoặc cách so sánh chưa hợp lệ.');
      labels.add(metric.label);
      for (const key of ['actual', 'forecast', 'previous']) point(metric[key], checkedAt);
      for (const key of ['actual', 'forecast']) if (metric[key] && metric[key].period !== event.period) fail('kết quả hoặc dự báo khác kỳ dữ liệu.');
      const forecastDeadline = Math.min(Date.parse(event.scheduledAt), event.releasedAt ? Date.parse(event.releasedAt) : Infinity);
      if (metric.forecast && (!event.scheduledAt || Date.parse(metric.forecast.publishedAt) >= forecastDeadline)) fail('dự báo phải có mốc trước công bố.');
      if (metric.actual) actualCount++;
    }
    if (event.outcome != null && !text(event.outcome, 1200)) fail('nội dung kết quả chưa hợp lệ.');
    if (event.status === 'released') {
      source(event.resultSource);
      if (!instant(event.releasedAt) || Date.parse(event.releasedAt) > checkedAt || (!actualCount && !event.outcome)) fail('chưa có kết quả đã xác minh.');
    } else if (actualCount || event.outcome || event.releasedAt || event.resultSource) fail('kết quả không khớp trạng thái.');
  }
  return value;
}
export function eventStatus(event, referenceTime) {
  if (event.status === 'released') return 'Đã công bố';
  if (event.status === 'postponed') return 'Đổi lịch / hoãn';
  if (!event.scheduledAt) return 'Chưa xác định giờ';
  return Date.parse(event.scheduledAt) <= new Date(referenceTime).getTime() ? 'Đã đến giờ — chưa xác minh kết quả' : 'Sắp công bố';
}
export function eventRange(date, mode = 'day') {
  if (!validDate(date) || !['day', 'week', 'next'].includes(mode)) fail('phạm vi chọn chưa hợp lệ.');
  const day = new Date(date + 'T12:00:00Z');
  if (mode === 'week') day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const start = day.toISOString().slice(0, 10);
  if (mode !== 'day') day.setUTCDate(day.getUTCDate() + 6);
  return { start, end: day.toISOString().slice(0, 10) };
}
export function selectEvents(snapshot, { date, range = 'day', country = '', impact = '', query = '' }) {
  const window = eventRange(date, range);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const search = normalize(query.trim());
  return (snapshot?.events || []).filter(event => event.scheduledDate >= window.start && event.scheduledDate <= window.end && (!country || event.country === country) && (!impact || event.impact === impact) && (!search || normalize(event.title + ' ' + event.description + ' ' + event.period + ' ' + event.metrics.map(metric => metric.label).join(' ')).includes(search)))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledAt || 'z').localeCompare(b.scheduledAt || 'z') || a.id.localeCompare(b.id));
}
export const formatEventValue = value => typeof value === 'number' ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(value) : value;
export function surprise(metric) {
  if (typeof metric.actual?.value !== 'number' || typeof metric.forecast?.value !== 'number') return null;
  const difference = Number((metric.actual.value - metric.forecast.value).toFixed(8));
  return (difference > 0 ? '+' : '') + formatEventValue(difference) + ' ' + (metric.unit === '%' ? 'điểm phần trăm' : metric.unit);
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export function assertCalendarUpdate(previous, next) {
  if (!previous) return;
  if (previous.sourceThreadId !== next.sourceThreadId) fail('không thay quy trình bản tin.');
  if (Date.parse(previous.checkedAt) > Date.parse(next.checkedAt)) fail('không ghi đè lịch mới hơn.');
  if (Date.parse(previous.checkedAt) === Date.parse(next.checkedAt) && JSON.stringify(canonical(previous)) !== JSON.stringify(canonical(next))) fail('cùng mốc kiểm tra nhưng khác nội dung.');
}
