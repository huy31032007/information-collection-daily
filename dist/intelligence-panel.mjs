import { safeLink, TIMEZONE, vietnamDate } from './lib.mjs';

const numberFormat = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2
});
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const formatNumber = (value, precision) => {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) return numberFormat.format(value);
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: precision, maximumFractionDigits: Math.max(2, precision)
  }).format(value);
};
const make = (tag, value, className) => {
  const element = document.createElement(tag);
  if (value != null) element.textContent = String(value);
  if (className) element.className = className;
  return element;
};

function displayTime(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(value));
}

function addSources(parent, sources = []) {
  const row = make('div', null, 'dashboard-sources');
  const seen = new Set();
  for (const source of Array.isArray(sources) ? sources : []) {
    const url = safeLink(source?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const link = make('a', source.name || new URL(url).hostname);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    row.append(link);
  }
  if (row.childElementCount) parent.append(row);
}

function detail(list, label, value) {
  if (typeof value !== 'string' || !value.trim()) return;
  const row = make('div', null, 'market-detail-row');
  row.append(make('dt', label), make('dd', value));
  list.append(row);
}

function card(quote, label, tone, report, gold = false) {
  const article = make('article', null, 'market-card ' + tone);
  const heading = make('p', label, 'market-label');
  if (gold) heading.append(make('span', 'Bán ra', 'market-price-side'));
  article.append(heading);
  const value = gold ? quote?.sell : quote?.value;
  if (!isNumber(value) || value <= 0 || !Array.isArray(quote?.sources)
      || !quote.sources.some(source => safeLink(source?.url))
      || typeof quote.unit !== 'string' || !quote.unit.trim()
      || !quote.time_text && !displayTime(quote.updated_at)) {
    article.append(
      make('p', 'Chưa xác minh', 'metric-empty'),
      make('p', quote?.freshness_note || 'Chưa có số liệu đủ nguồn và thời điểm.', 'market-meta')
    );
    return article;
  }
  const price = make('div', null, 'market-quote');
  price.append(
    make('strong', formatNumber(value, quote.decimal_places), 'market-value'),
    make('span', quote.unit, 'market-unit')
  );
  article.append(price);

  if (isNumber(quote.change_pct) && quote.session_note) {
    const percent = quote.change_pct;
    const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
    const arrow = percent > 0 ? '▲ ' : percent < 0 ? '▼ ' : '• ';
    const signed = (percent > 0 ? '+' : '') + formatNumber(percent) + '%';
    const movement = make('div', null, 'market-change');
    const badge = make('span',
      arrow + (quote.change_is_approximate ? '≈ ' : '') + signed,
      'change-badge ' + direction
    );
    badge.setAttribute('aria-label',
      (percent > 0 ? 'Tăng ' : percent < 0 ? 'Giảm ' : 'Biến động ')
      + (quote.change_is_approximate ? 'khoảng ' : '') + signed
    );
    movement.append(badge);
    if (isNumber(quote.change_val)) {
      movement.append(make('span',
        (quote.change_val > 0 ? '+' : '') + formatNumber(quote.change_val) + ' ' + quote.unit,
        'market-change-amount'
      ));
    }
    article.append(movement);
  }

  const details = make('dl', null, 'market-details');
  if (gold && isNumber(quote.buy))
    detail(details, 'Mua vào', formatNumber(quote.buy) + ' ' + quote.unit);
  detail(details, 'Thời điểm theo nguồn',
    quote.time_text || displayTime(quote.updated_at));
  detail(details, 'Loại giá / khu vực', quote.product);
  if (isNumber(quote.change_pct))
    detail(details, 'Mốc so sánh', quote.session_note);
  detail(details, 'Trích từ bản tin ngày', quote.report_date || report.reportDate);
  article.append(details);

  const historical = report.reportDate !== vietnamDate();
  const note = quote.status === 'last_known'
    ? 'Dữ liệu cũ: ' + (quote.freshness_note || 'Chờ báo giá mới được xác minh.')
    : historical
      ? 'Đang xem dữ liệu lịch sử; giá giữ theo thời điểm nguồn.'
      : quote.freshness_note || 'Giá tại thời điểm nguồn, không phải báo giá trực tiếp.';
  article.append(make('p', note,
    'market-freshness ' + (quote.is_stale || historical ? 'is-stale' : '')));
  addSources(article, quote.sources);
  return article;
}

export function renderMarketCards(report) {
  const section = make('section', null, 'market-cards');
  section.setAttribute('aria-label', 'Bốn thẻ dữ liệu thị trường');
  const snapshot = report?.market_snapshot || {};
  const indices = Array.isArray(snapshot.indices) ? snapshot.indices : [];
  section.append(
    card(indices.find(item => item?.symbol === 'VN-Index'), 'VN-Index', 'blue', report),
    card(indices.find(item => item?.symbol === 'VN30'), 'VN30', 'slate', report),
    card(snapshot.gold_sjc, 'Vàng miếng SJC', 'amber', report, true),
    card(snapshot.oil_brent, 'Dầu Brent', 'orange', report)
  );
  return section;
}

export function renderAcademicFeed(report) {
  const section = make('section', null, 'academic-panel');
  const heading = make('h2', 'Tin tức gắn với môn học');
  section.append(
    heading,
    make('p',
      'Tin từ RSS và gợi ý liên hệ kiến thức. Chưa phải bài nghiên cứu đã được phản biện.',
      'academic-intro')
  );
  const coverage = displayTime(report?.coverageStart);
  const cutoff = displayTime(report?.cutoffAt);
  if (coverage && cutoff)
    section.append(make('p', 'Khoảng tin: ' + coverage + ' → ' + cutoff + ' · Giờ Việt Nam',
      'academic-meta'));
  const list = make('div', null, 'academic-list');
  const seen = new Set();
  for (const item of Array.isArray(report?.academic_feed) ? report.academic_feed : []) {
    const url = safeLink(item?.link);
    const date = displayTime(item?.published_at);
    if (!url || !date || typeof item.title !== 'string'
        || !item.title.trim() || seen.has(url)) continue;
    seen.add(url);
    const article = make('article', null, 'academic-item');
    const labels = make('div', null, 'academic-badges');
    labels.append(
      make('span', item.course_name || 'Chưa phân loại', 'course-badge'),
      make('span', 'Chưa xác minh toàn văn', 'verification-badge')
    );
    const title = make('h3');
    const link = make('a', item.title);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    title.append(link);
    article.append(
      labels, title,
      make('p', (item.source || new URL(url).hostname) + ' · ' + date
        + ' · giờ do RSS khai báo, quy đổi sang Việt Nam', 'academic-meta')
    );
    if (typeof item.summary === 'string' && item.summary.trim()) {
      article.append(make('p', item.summary, 'academic-summary'),
        make('p', 'Tóm tắt do RSS cung cấp.', 'academic-meta'));
    }
    if (typeof item.academic_relevance === 'string' && item.academic_relevance.trim()) {
      const relevance = make('div', null, 'academic-relevance');
      relevance.append(
        make('strong', 'Nhận định — liên hệ môn học'),
        make('p', item.academic_relevance)
      );
      article.append(relevance);
    }
    list.append(article);
  }
  if (!list.childElementCount) {
    list.append(make('p', 'Chưa có cập nhật mới đáng tin cậy trong khoảng đã chọn.',
      'academic-empty'));
  }
  section.append(list);
  const statuses = Array.isArray(report?.source_status?.rss) ? report.source_status.rss : [];
  for (const source of statuses) {
    if (source.state === 'error')
      section.append(make('p', source.source + ': ' + source.message, 'academic-source-warning'));
    if (source.excluded_time > 0)
      section.append(make('p', source.source + ': bỏ qua ' + source.excluded_time
        + ' tin vì giờ công bố thiếu múi giờ hoặc không đọc được.',
        'academic-source-warning'));
  }
  return section;
}
