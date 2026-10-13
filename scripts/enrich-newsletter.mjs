import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Parser from 'rss-parser';
import {
  TIMEZONE, validateNewsletter, parseSections, safeLink, normalizeText
} from '../dist/lib.mjs';
import { validDate } from '../dist/history.mjs';
import {
  readDashboardData, quoteParts, changeParts
} from '../dist/dashboard.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(root, 'dist/data');
const MAX_BYTES = 600_000;
const CACHE_MS = 15 * 60_000;
const parser = new Parser();
const feeds = [
  {
    id: 'vneconomy', name: 'VnEconomy',
    url: 'https://vneconomy.vn/tai-chinh.rss', host: 'vneconomy.vn'
  },
  {
    id: 'chinhphu', name: 'Báo Chính phủ',
    url: 'https://baochinhphu.vn/home.rss', host: 'baochinhphu.vn'
  }
];
const courses = [
  {
    id: 'macroeconomics', name: 'Kinh tế Vĩ mô',
    keywords: ['lãi suất', 'lạm phát', 'chính sách tiền tệ', 'tỷ giá',
      'GDP', 'SBV', 'ngân hàng nhà nước'],
    concept: 'lãi suất, lạm phát và truyền dẫn chính sách'
  },
  {
    id: 'finance_accounting', name: 'Tài chính - Kế toán',
    keywords: ['báo cáo tài chính', 'thị trường vốn', 'trái phiếu', 'thuế'],
    concept: 'nguồn vốn, báo cáo tài chính và nghĩa vụ thuế'
  },
  {
    id: 'institutions', name: 'Tư tưởng & Thể chế',
    keywords: ['nghị quyết', 'cải cách hành chính',
      'kinh tế thị trường định hướng xhcn', 'quốc hội'],
    concept: 'thể chế, quy định và điều kiện thực thi chính sách'
  }
];

const text = (value, max = 500) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function viNumber(value) {
  const raw = String(value ?? '').trim().replace(/−/g, '-');
  if (!/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(raw)) return null;
  const number = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function publishedAt(raw) {
  if (typeof raw !== 'string') return null;
  const input = raw.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(input);
  const rfc = /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(GMT|UTC|[+-]\d{4})$/.exec(input);
  if (!iso && !rfc) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const date = iso ? iso[1] : rfc[3] + '-' + String(months.indexOf(rfc[2].toLowerCase()) + 1).padStart(2, '0') + '-' + rfc[1].padStart(2, '0');
  const clock = (iso ? iso.slice(2, 5) : rfc.slice(4, 7)).map(Number);
  const zone = iso ? iso[5] : rfc[7];
  if (!validDate(date) || clock[0] > 23 || clock[1] > 59 || clock[2] > 59) return null;
  if (/^[+-]/.test(zone)) {
    const offset = zone.slice(1).replace(':', '');
    const hours = Number(offset.slice(0, 2)), minutes = Number(offset.slice(2));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  }
  const milliseconds = Date.parse(input);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function allowedLink(value, host) {
  const link = safeLink(value);
  if (!link) return null;
  const url = new URL(link);
  return url.protocol === 'https:'
    && (url.hostname === host || url.hostname.endsWith('.' + host))
    ? link : null;
}

function sourceList(list = []) {
  return list.flatMap(source => {
    const url = safeLink(source.href);
    return url ? [{ name: text(source.name, 120), url }] : [];
  });
}

function normalizedQuote(item, report) {
  if (!item) return null;
  const quote = quoteParts(item.value, item.section === '2' ? 'điểm' : '');
  const value = quote ? viNumber(quote.number) : null;
  const sources = sourceList(item.sources);
  if (value === null || value <= 0 || !sources.length || !text(item.time)) return null;
  const movement = changeParts(item.change || '', item.section === '2' ? 'điểm' : '');
  const comparison = text(item.comparison);
  return {
    symbol: item.label, value, unit: quote.unit,
    decimal_places: Math.min(6, quote.number.split(',')[1]?.length || 0),
    change_val: comparison && movement ? viNumber(movement.amount) : null,
    change_pct: comparison && movement ? movement.percent.value : null,
    change_is_approximate: Boolean(movement?.approximate),
    session_note: comparison || 'Không có mốc so sánh đã xác minh.',
    updated_at: null, time_text: item.time,
    report_date: report.reportDate, report_cutoff: report.cutoffAt,
    product: item.product || item.label, sources,
    status: 'newsletter_quote',
    is_stale: true,
    freshness_note: 'Giá tại thời điểm trong bản tin; chưa kiểm tra báo giá mới.'
  };
}

export function marketSnapshot(report, history) {
  const current = readDashboardData(parseSections(report.markdown).sections);
  const indices = current.indices
    .map(item => normalizedQuote(item, report)).filter(Boolean);
  const oil = normalizedQuote(current.oil, report);
  const goldFrom = record => {
    const row = readDashboardData(parseSections(record.markdown).sections).gold;
    const quote = normalizedQuote(row, record);
    const buy = row && quoteParts(row.buyValue);
    if (!quote || !buy || buy.unit !== quote.unit) return null;
    const buyValue = viNumber(buy.number);
    if (buyValue === null || buyValue <= 0 || buyValue > quote.value) return null;
    return { ...quote, buy: buyValue, sell: quote.value, change_pct: null };
  };
  let gold = goldFrom(report);
  if (!gold) {
    for (const record of [...history].sort((a, b) => Date.parse(b.cutoffAt) - Date.parse(a.cutoffAt))) {
      if (Date.parse(record.cutoffAt) > Date.parse(report.cutoffAt)) continue;
      const previous = goldFrom(record);
      if (!previous) continue;
      gold = {
        ...previous, status: 'last_known', is_stale: true,
        freshness_note: 'Chưa xác minh được giá mới. Giữ báo giá cũ và nguồn cũ.'
      };
      break;
    }
  }
  return {
    indices, oil_brent: oil,
    gold_sjc: gold || {
      buy: null, sell: null, unit: 'triệu VNĐ/lượng',
      updated_at: null, time_text: '', sources: [],
      status: 'unavailable', is_stale: true,
      freshness_note: 'Chưa có giá SJC đã xác minh để dùng làm dự phòng.'
    }
  };
}

async function readJSON(file) {
  try {
    const bytes = await readFile(file);
    if (bytes.length > MAX_BYTES) throw new Error('JSON vượt giới hạn.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function storedReports(report) {
  const reports = [];
  const current = validateNewsletter(await readJSON(path.join(dataDir, 'latest.json')));
  if (current) {
    if (current.sourceThreadId !== report.sourceThreadId)
      throw new Error('Bản tin thuộc pipeline khác.');
    if (Date.parse(current.cutoffAt) >= Date.parse(report.cutoffAt))
      throw new Error('Chỉ bổ sung dữ liệu cho bản tin mới; không sửa cùng mốc chốt.');
    reports.push(current);
  }
  const archive = path.join(dataDir, 'archive');
  let files;
  try { files = await readdir(archive); }
  catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
  for (const file of files.filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
    const item = validateNewsletter(await readJSON(path.join(archive, file)));
    if (!item || item.reportDate + '.json' !== file
        || item.sourceThreadId !== report.sourceThreadId)
      throw new Error('Kho lịch sử không khớp ngày hoặc pipeline.');
    if (Date.parse(item.cutoffAt) >= Date.parse(report.cutoffAt))
      throw new Error('Kho lịch sử đã có bản cùng mốc hoặc mới hơn.');
    reports.push(item);
  }
  return reports.sort((a, b) => Date.parse(b.cutoffAt) - Date.parse(a.cutoffAt));
}

export function cleanItem(item, feed) {
  const link = allowedLink(item?.link, feed.host);
  const title = text(item?.title, 200);
  if (!link || !title) return null;
  const rawDate = text(item.pubDate, 100);
  return {
    title, link, summary: text(item.contentSnippet, 350),
    published_at: publishedAt(rawDate),
    published_at_raw: rawDate, source: feed.name,
    published_at_basis: 'rss_declared'
  };
}

export function validCache(cache, feed, now) {
  if (!cache || cache.url !== feed.url || !Array.isArray(cache.items)
      || cache.items.length > 50
      || !publishedAt(cache.checked_at)
      || Date.parse(cache.checked_at) > now) return null;
  const items = cache.items.map(item => cleanItem({
    title: item?.title, link: item?.link,
    contentSnippet: item?.summary, pubDate: item?.published_at_raw
  }, feed)).filter(Boolean);
  return { url: feed.url, checked_at: cache.checked_at, items };
}

export async function readFeed(feed, previousCache, { fetcher = fetch, now = Date.now() } = {}) {
  const cached = validCache(previousCache, feed, now);
  if (cached && now - Date.parse(cached.checked_at) < CACHE_MS)
    return { cache: cached, status: { source: feed.name, state: 'cached' } };
  try {
    const response = await fetcher(feed.url, {
      signal: AbortSignal.timeout(10_000), redirect: 'error',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const type = response.headers.get('content-type') || '';
    if (!/xml/i.test(type)) throw new Error('Nguồn không trả XML.');
    const chunks = []; let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > MAX_BYTES) throw new Error('RSS vượt giới hạn.');
        chunks.push(Buffer.from(chunk));
      }
    } catch (error) {
      await response.body?.cancel().catch(() => {});
      throw error;
    }
    const xml = new TextDecoder('utf-8', { fatal: true })
      .decode(Buffer.concat(chunks, size));
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML có khai báo không hỗ trợ.');
    const result = await parser.parseString(xml);
    if (!Array.isArray(result.items)) throw new Error('RSS không có danh sách hợp lệ.');
    const items = result.items.slice(0, 50).map(item => cleanItem(item, feed)).filter(Boolean);
    return {
      cache: { url: feed.url, checked_at: new Date(now).toISOString(), items },
      status: { source: feed.name, state: 'ok' }
    };
  } catch {
    return {
      cache: cached,
      status: {
        source: feed.name, state: 'error',
        message: cached ? 'Nguồn lỗi; dùng dữ liệu RSS đã lưu.' : 'Không tải được nguồn RSS.'
      }
    };
  }
}

export function academicItems(results, report) {
  const start = Date.parse(report.coverageStart), end = Date.parse(report.cutoffAt);
  const articles = new Map();
  const status = results.map(result => ({ ...result.status, excluded_time: 0 }));
  results.forEach((result, index) => {
    for (const item of result.cache?.items || []) {
      const timestamp = Date.parse(item.published_at);
      if (!Number.isFinite(timestamp)) { status[index].excluded_time++; continue; }
      if (timestamp < start || timestamp > end) continue;
      const haystack = ' ' + normalizeText(item.title + ' ' + item.summary)
        .replace(/[^a-z0-9]+/g, ' ') + ' ';
      const matches = courses.map(course => ({
        course,
        words: course.keywords.filter(word => haystack.includes(' ' + normalizeText(word) + ' '))
      })).filter(match => match.words.length)
        .sort((a, b) => b.words.length - a.words.length);
      if (!matches.length || articles.has(item.link)) continue;
      const { course, words } = matches[0];
      articles.set(item.link, {
        ...item, course_id: course.id, course_name: course.name,
        label: 'Unverified', relevance_label: 'Analysis',
        academic_relevance: 'Gợi ý học: RSS nhắc đến ' + words.join(', ')
          + '. Có thể đối chiếu với ' + course.concept
          + '; cần đọc bài gốc để xác nhận liên hệ.',
        verification_note: 'Tiêu đề, tóm tắt và giờ lấy từ RSS; chưa đối chiếu toàn văn.'
      });
    }
  });
  return {
    articles: [...articles.values()]
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 30),
    status
  };
}

export async function enrich(report, history) {
  const previous = history[0];
  const results = await Promise.all(feeds.map(feed =>
    readFeed(feed, previous?.feed_cache?.[feed.id])));
  const academic = academicItems(results, report);
  return {
    ...report,
    meta: { version: '2.0', generated_at: new Date().toISOString(), timezone: TIMEZONE },
    market_snapshot: marketSnapshot(report, history),
    academic_feed: academic.articles,
    source_status: {
      rss: academic.status,
      gold_direct: {
        state: 'not_connected',
        message: 'Chưa có nguồn giá trực tiếp với định dạng đã kiểm chứng.'
      }
    },
    feed_cache: Object.fromEntries(feeds.map((feed, i) => [feed.id, results[i].cache]))
  };
}

async function main() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('Đầu vào quá lớn.');
    chunks.push(chunk);
  }
  const input = JSON.parse(new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks, size)));
  const keys = ['title', 'reportDate', 'cutoffAt', 'coverageStart',
    'coverageEnd', 'timezone', 'sourceThreadId', 'markdown'];
  const payload = Object.fromEntries(keys.map(key => [key, input?.[key]]));
  const report = validateNewsletter({ ...payload, exportedAt: new Date().toISOString() });
  if (!report) throw new Error('Không có bản tin hợp lệ.');
  const result = await enrich(report, await storedReports(report));
  validateNewsletter(result);
  const output = JSON.stringify(result) + '\n';
  if (Buffer.byteLength(output) > MAX_BYTES) throw new Error('Đầu ra vượt giới hạn.');
  process.stdout.write(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Không tạo được dữ liệu mới; bản đã xuất bản được giữ nguyên.');
    process.exitCode = 1;
  });
}
