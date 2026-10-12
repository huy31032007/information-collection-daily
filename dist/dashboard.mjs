import { extractSources, normalizeText, formatTime } from './lib.mjs';
import { renderMarkdown } from './markdown.mjs';

const clean = text => text.replace(/\*\*|`/g, '').trim();
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean);

// Read display values only; missing or unfamiliar tables never become estimates.
export function readTables(body = '') {
  const lines = body.split('\n'); const tables = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\|/.test(lines[i]) || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const start = i; const headers = cells(lines[i]); const rows = []; i += 2;
    while (i < lines.length && /^\|/.test(lines[i])) { const row = cells(lines[i]); if (row.length === headers.length) rows.push(row); i++; }
    const before = lines.slice(0, start).join('\n').split(/\n\s*\n/).filter(Boolean).slice(-2).join('\n\n');
    const following = lines.slice(i).join('\n').split(/\n\s*\n/).filter(Boolean);
    const after = following.slice(0, 2).filter(p => !/^#|^\|/.test(p)).join('\n\n');
    tables.push({ headers, rows, before, after, sources: extractSources(after) });
  }
  return tables;
}
export function explicitPercent(value = '') {
  if (/chua xac minh|chua co|khong co/i.test(normalizeText(value))) return null;
  const matches = [...clean(value).matchAll(/([+−-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?)\s*%/g)];
  if (matches.length !== 1) return null;
  if (/[\d.,]/.test(clean(value)[matches[0].index - 1] || '')) return null;
  const text = matches[0][1]; const number = Number(text.replace(/−/g, '-').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? { value: number, text: text + '%' } : null;
}
const quotedNumber = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?';
export function quoteParts(value = '', indexUnit = '') {
  const text = clean(value);
  if (indexUnit && new RegExp('^' + quotedNumber + '$').test(text)) return { number: text, unit: indexUnit };
  const match = new RegExp('^(' + quotedNumber + ')\\s+(triệu đồng/lượng|đồng/lượng|triệu VNĐ/lượng|VNĐ/lượng|USD/thùng)$').exec(text);
  return match ? { number: match[1], unit: match[2] } : null;
}
export function changeParts(value = '', indexUnit = '') {
  const text = clean(value), percent = explicitPercent(text);
  const match = new RegExp('^([+−-]?' + quotedNumber + ')(?:\\s+(USD/thùng))?;\\s*(khoảng\\s+|xấp xỉ\\s+|ước tính\\s+)?([+−-]?' + quotedNumber + ')\\s*%$').exec(text);
  return match && percent ? { amount: match[1], unit: match[2] || indexUnit, percent, approximate: Boolean(match[3]) } : null;
}
export function marketMetadata(data) {
  const rows = [];
  if (data.buyValue) rows.push({ label: 'Mua vào', value: data.buyValue });
  const day = data.time.match(/\bngày (\d{1,2}\/\d{1,2}(?:\/\d{4})?)\b/i)?.[1];
  const clock = data.observedTime?.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0];
  const goldTime = data.section === '3' && /^(.*?);\s*bài công bố\s+(\d{1,2}:\d{2}),\s*(.*)$/i.exec(data.time);
  const oilTime = data.section === '4' && /^Lúc (\d{1,2}:\d{2}) ngày (\d{1,2}\/\d{1,2}) giờ Việt Nam, theo .+:$/.exec(data.time);
  if (data.section === '2' && /^Mức hiển thị ngày /i.test(data.time) && day && clock) rows.push({ label: 'Hiển thị', value: clock + ' · ' + day });
  else if (goldTime) rows.push({ label: 'Giá ghi nhận', value: goldTime[1] }, { label: 'Bài công bố', value: goldTime[2] }, { label: 'Lưu ý', value: goldTime[3] });
  else if (oilTime) rows.push({ label: 'Giá lúc', value: oilTime[1] + ' · ' + oilTime[2] + ' (giờ Việt Nam)' });
  else rows.push({ label: 'Thời điểm', value: data.time });
  if (data.comparison) rows.push({ label: 'Mốc so sánh', value: data.comparison.replace(/^so với\s+/i, '') });
  if (data.product) {
    const area = data.section === '3' && /^Vàng miếng SJC tại (.+?), theo .+$/.exec(data.product);
    rows.push({ label: area ? 'Khu vực' : 'Loại giá', value: area ? area[1] : data.product });
  }
  return rows;
}
export function readDashboardData(sections) {
  const stocks = sections.find(s => s.id === '2'); const gold = sections.find(s => s.id === '3'); const oil = sections.find(s => s.id === '4');
  const stockTable = readTables(stocks?.body).find(t => t.headers.some(h => normalizeText(h) === 'chi so'));
  const index = expression => stockTable?.headers.findIndex(h => expression.test(normalizeText(h))) ?? -1;
  const label = index(/^chi so$/), quote = index(/muc|gia tri|diem/), change = index(/thay doi|bien dong/), time = index(/thoi diem/);
  const comparison = clean(stockTable?.before || '').match(/so với[^,;:.\n]+/i)?.[0] || '';
  const indices = label >= 0 && quote >= 0 && change >= 0 && time >= 0 && stockTable.sources.length && /so voi/i.test(normalizeText(stockTable.before))
    ? stockTable.rows.filter(row => /^(VN-Index|VN30|HNX-Index|UPCoM-Index)$/.test(row[label])).map(row => ({ label: row[label], value: row[quote], change: row[change], percent: explicitPercent(row[change]), comparison, time: stockTable.headers[quote] + ' · ' + row[time], observedTime: row[time], sources: stockTable.sources, section: '2' })).filter(row => /^\d[\d.,]*$/.test(row.value) && /\d{1,2}:\d{2}/.test(row.time) && /\d{1,2}\/\d{1,2}/.test(row.time) && !/chua xac minh/.test(normalizeText(row.change + ' ' + row.time))) : [];
  const goldTable = readTables(gold?.body).find(t => t.headers.some(h => normalizeText(h) === 'ban ra') && t.rows.some(r => /vang mieng sjc/.test(normalizeText(r[0]))));
  const goldRow = goldTable?.rows.find(r => /vang mieng sjc/.test(normalizeText(r[0])));
  const sell = goldTable?.headers.findIndex(h => normalizeText(h) === 'ban ra'), buy = goldTable?.headers.findIndex(h => normalizeText(h) === 'mua vao'), goldTime = goldTable?.headers.findIndex(h => /thoi diem/.test(normalizeText(h)));
  const goldMetric = goldRow && sell >= 0 && buy >= 0 && goldTime >= 0 && goldTable.sources.length && /\d.*(?:dong|vnd)/i.test(normalizeText(goldRow[sell])) && /\d{1,2}\/\d{1,2}/.test(goldRow[goldTime]) && !/chua xac minh/.test(normalizeText(goldRow.join(' ')))
    ? { label: 'Vàng miếng SJC', value: goldRow[sell], buyValue: goldRow[buy], detail: 'Bán ra · Mua vào: ' + goldRow[buy], time: goldRow[goldTime], product: goldRow[0], sources: goldTable.sources.slice(0, 1), section: '3' } : null;
  const oilTable = readTables(oil?.body).find(t => t.headers.some(h => /gia dau tham chieu/.test(normalizeText(h))));
  const oilRow = oilTable?.rows.find(r => /^brent$/i.test(r[0]));
  const oilMetric = oilRow && oilTable.sources.length && /USD\/thùng/.test(oilRow[1]) && /\d{1,2}:\d{2}.*\d{1,2}\/\d{1,2}/s.test(oilTable.before) && !/chua xac minh/.test(normalizeText(oilRow.join(' ') + ' ' + oilTable.before))
    ? { label: 'Dầu Brent', value: oilRow[1], change: oilRow[2], comparison: oilTable.headers[2], detail: oilRow[2] + ' · ' + oilTable.headers[2], time: clean(oilTable.before.split(/\n\s*\n/).filter(p => !/^#/.test(p)).at(-1) || ''), product: 'Giá dầu tham chiếu quốc tế', sources: oilTable.sources.slice(0, 1), section: '4' } : null;
  return { indices, stockTable, gold: goldMetric, oil: oilMetric, insight: stocks?.body.split(/^### /m)[0].trim() || '' };
}

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
function sources(parent, list = []) {
  const line = make('div', null, 'dashboard-sources');
  for (const source of list) { const link = make('a', source.name); link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; line.append(link); }
  parent.append(line);
}
function metric(data, label, tone) {
  const card = make('article', null, 'market-card ' + tone), heading = make('p', data?.label || label, 'market-label');
  if (data?.section === '3') heading.append(document.createTextNode(' '), make('span', 'Bán ra', 'market-price-side'));
  card.append(heading);
  if (!data) { card.append(make('p', 'Chưa có số liệu phù hợp', 'metric-empty'), make('p', 'Xem dữ kiện và giới hạn trong bản tin bên dưới.', 'market-meta')); return card; }
  const quote = make('div', null, 'market-quote'), parts = quoteParts(data.value, data.section === '2' ? 'điểm' : '');
  if (parts) quote.append(make('strong', parts.number, 'market-value'), make('span', parts.unit, 'market-unit'));
  else quote.append(make('p', data.value, 'market-unparsed'));
  card.append(quote);
  const change = changeParts(data.change || '', data.section === '2' ? 'điểm' : '');
  if (change) {
    const line = make('div', null, 'market-change'), direction = change.percent.value < 0 ? 'down' : change.percent.value > 0 ? 'up' : 'flat';
    const badge = make('span', null, 'change-badge ' + direction);
    const arrow = make('span', direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•'); arrow.setAttribute('aria-hidden', 'true');
    badge.append(arrow, document.createTextNode((change.approximate ? '≈ ' : '') + change.percent.text));
    badge.setAttribute('aria-label', (direction === 'up' ? 'Tăng ' : direction === 'down' ? 'Giảm ' : 'Biến động ') + (change.approximate ? 'khoảng ' : '') + change.percent.text);
    line.append(badge, make('span', change.amount + (change.unit ? ' ' + change.unit : ''), 'market-change-amount')); card.append(line);
  } else if (data.change) card.append(make('p', data.change, 'market-meta'));
  const details = make('dl', null, 'market-details');
  for (const row of marketMetadata(data)) { const pair = make('div', null, 'market-detail-row'); pair.append(make('dt', row.label), make('dd', row.value)); details.append(pair); }
  card.append(details);
  sources(card, data.sources); return card;
}
function chart(snapshot) {
  const card = make('section', null, 'dashboard-panel chart-panel'); const head = make('div', null, 'panel-heading');
  head.append(make('h2', 'Biến động các chỉ số'), make('span', '% thay đổi', 'panel-tag')); card.append(head);
  const values = snapshot.indices.filter(row => row.percent); const table = snapshot.stockTable;
  if (!values.length) { card.append(make('p', 'Chưa có dữ liệu và mốc so sánh phù hợp để vẽ biểu đồ.', 'chart-empty')); return card; }
  card.append(make('p', values[0].time.split(' · ')[0], 'chart-date'));
  const comparison = clean(table.before).match(/so với[^,;:.\n]+/i)?.[0];
  card.append(make('p', 'Mốc so sánh: ' + (comparison || 'xem chú thích bảng số liệu'), 'chart-context'));
  const lower = Math.min(0, ...values.map(row => row.percent.value)), upper = Math.max(0, ...values.map(row => row.percent.value));
  const min = lower < 0 ? -Math.ceil(Math.abs(lower) * 2) / 2 : 0, max = upper > 0 ? Math.ceil(upper * 2) / 2 : 0;
  const span = max - min || 1; const zero = -min / span * 100;
  const plot = make('div', null, 'comparison-plot'); plot.setAttribute('role', 'img'); plot.setAttribute('aria-label', values.map(row => `${row.label}: ${row.percent.text}, ${row.time}`).join('; '));
  for (const row of values) {
    const line = make('div', null, 'plot-row'); const label = make('div', null, 'plot-label'); label.append(make('strong', row.label), make('span', row.observedTime));
    const track = make('div', null, 'plot-track'); const baseline = make('span', null, 'plot-zero'); baseline.style.left = zero + '%';
    const bar = make('span', null, 'plot-bar ' + (row.percent.value < 0 ? 'negative' : 'positive')); bar.style.left = (Math.min(0, row.percent.value) - min) / span * 100 + '%'; bar.style.width = Math.abs(row.percent.value) / span * 100 + '%';
    track.append(baseline, bar); line.append(label, track, make('strong', row.percent.text, 'plot-value')); plot.append(line);
  }
  card.append(plot);
  const scale = make('div', null, 'plot-scale'); const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value) + '%';
  scale.append(make('span', number(min)), make('span', 'Tỷ lệ thay đổi (%)'), make('span', number(max))); card.append(scale);
  const legend = make('p', null, 'plot-legend'); legend.append(make('span', '+ Tăng', 'increase'), make('span', '− Giảm', 'decrease')); card.append(legend);
  card.append(make('p', 'So sánh phần trăm thay đổi, không so sánh số điểm giữa các bộ chỉ số. Thời điểm từng chỉ số có thể khác nhau.', 'chart-note'));
  sources(card, table.sources);
  const disclosure = make('details', null, 'chart-details'); disclosure.append(make('summary', 'Xem bảng số liệu và chú thích nguồn'));
  const accessible = make('table', null, 'snapshot-table'); const caption = make('caption', 'Dữ liệu nguyên văn từ bảng chỉ số trong bản tin'); accessible.append(caption);
  const thead = make('thead'); const headings = make('tr'); for (const name of table.headers) { const th = make('th', name); th.scope = 'col'; headings.append(th); } thead.append(headings); accessible.append(thead);
  const tbody = make('tbody'); for (const row of table.rows) { const tr = make('tr'); for (let i = 0; i < row.length; i++) { const td = make('td', row[i]); td.dataset.label = table.headers[i]; tr.append(td); } tbody.append(tr); } accessible.append(tbody); disclosure.append(accessible, renderMarkdown(table.after)); card.append(disclosure); return card;
}
function framework() {
  const panel = make('section', null, 'dashboard-panel framework-panel'); const head = make('div', null, 'panel-heading'); head.append(make('h2', 'Sơ đồ đọc phân tích'), make('span', 'Khung tham khảo', 'panel-tag')); panel.append(head);
  const flow = make('ol', null, 'analysis-flow');
  const nodes = [['Vĩ mô', 'Tăng trưởng, lạm phát, lãi suất và tỷ giá.'], ['Doanh nghiệp', 'Doanh thu, chi phí, nợ và khả năng tăng giá bán.'], ['Kết quả tài chính', 'Lợi nhuận và tiền thực thu, thực chi.'], ['Định giá & thị trường', 'Giá tài sản, sức mua và mức độ lan tỏa.']];
  for (let i = 0; i < nodes.length; i++) { const item = make('li'); item.append(make('span', String(i + 1).padStart(2, '0'), 'flow-step'), make('h3', nodes[i][0]), make('p', nodes[i][1])); if (i < nodes.length - 1) { const arrow = make('span', '→', 'flow-arrow'); arrow.setAttribute('aria-hidden', 'true'); item.append(arrow); } flow.append(item); }
  panel.append(flow, make('p', 'Mũi tên biểu thị kênh tác động cần kiểm chứng. Quan hệ nhân quả, điều kiện và rủi ro phải được đối chiếu với dữ kiện trong bản tin.', 'chart-note')); return panel;
}
export function renderDashboard(container, sections, report) {
  container.replaceChildren(); container.setAttribute('aria-busy', 'false');
  if (!report) { container.append(make('p', 'Dashboard sẽ hiển thị khi có bản tin hợp lệ. Bạn có thể dùng nút làm mới để thử lại.', 'dashboard-empty')); return; }
  const snapshot = readDashboardData(sections);
  const heading = make('div', null, 'dashboard-heading'); heading.append(make('h2', 'Bản chụp thị trường'), make('p', 'Theo bản tin chốt ' + formatTime(report.cutoffAt) + ' · giờ Việt Nam')); container.append(heading);
  const metrics = make('div', null, 'market-cards'); metrics.append(metric(snapshot.indices.find(row => row.label === 'VN-Index'), 'VN-Index', 'teal'), metric(snapshot.indices.find(row => row.label === 'VN30'), 'VN30', 'slate'), metric(snapshot.gold, 'Vàng miếng SJC', 'amber'), metric(snapshot.oil, 'Dầu Brent', 'orange')); container.append(metrics);
  const panels = make('div', null, 'dashboard-panels'); panels.append(chart(snapshot));
  const insight = make('section', null, 'dashboard-panel insight-panel'); const head = make('div', null, 'panel-heading'); head.append(make('h2', 'Góc nhìn thị trường'), make('span', 'Nhận định', 'analysis-label')); insight.append(head);
  const body = make('div', null, 'insight-body'); if (snapshot.insight) body.append(renderMarkdown(snapshot.insight)); else body.append(make('p', 'Chưa có nhận định phù hợp trong bản tin.')); insight.append(body);
  const link = make('a', 'Đọc phân tích và các kịch bản →', 'read-analysis'); link.href = '#section-2'; insight.append(link); panels.append(insight); container.append(panels, framework());
}
