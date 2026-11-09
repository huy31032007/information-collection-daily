// Interactive trend chart over archived editions. Data comes from
// data/market-series.json (built from the same tables as the cards).
import { dateLabel, addDays } from './history.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const KEYS = [
  { key: 'vnIndex', tab: 'VN-Index' },
  { key: 'vn30', tab: 'VN30' },
  { key: 'gold', tab: 'Vàng SJC' },
  { key: 'brent', tab: 'Dầu Brent' },
];
const RANGES = [{ days: 14, label: '2 tuần' }, { days: 31, label: '1 tháng' }, { days: 0, label: 'Tất cả' }];
const fmt = (value, digits = 2) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const pct = value => (value > 0 ? '+' : value < 0 ? '−' : '') + fmt(Math.abs(value)) + '%';
const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const svg = (tag, attrs = {}) => { const node = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); return node; };
const short = date => dateLabel(date, { year: undefined });
const digitsFor = key => key === 'gold' ? 1 : 2;

// Persist the reader's last tab/range for the session only.
const view = { key: 'vnIndex', days: 31, active: -1 };

export function renderTrendPanel(container, { series, currentDate, onSelectDate }) {
  const panel = make('section', null, 'dashboard-panel trend-panel');
  panel.setAttribute('aria-labelledby', 'trend-title');
  const heading = make('div', null, 'panel-heading');
  const title = make('h2', 'Diễn biến qua các bản tin'); title.id = 'trend-title';
  heading.append(title, make('span', 'Tương tác', 'panel-tag'));
  panel.append(heading, make('p', 'Chọn chỉ số và khoảng thời gian. Di chuột, chạm hoặc dùng phím mũi tên để xem từng ngày; bấm một điểm để mở bản tin của ngày đó.', 'trend-intro'));

  const controls = make('div', null, 'trend-controls');
  const tabs = make('div', null, 'trend-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Chọn chỉ số');
  const ranges = make('div', null, 'trend-ranges'); ranges.setAttribute('role', 'group'); ranges.setAttribute('aria-label', 'Khoảng thời gian');
  controls.append(tabs, ranges);
  const summary = make('p', null, 'trend-summary'); summary.setAttribute('aria-live', 'polite');
  const plot = make('div', null, 'trend-plot');
  plot.tabIndex = 0; plot.setAttribute('role', 'group');
  const tooltip = make('div', null, 'trend-tooltip'); tooltip.hidden = true;
  const live = make('p', null, 'visually-hidden'); live.setAttribute('aria-live', 'polite');
  const legend = make('div', null, 'trend-legend');
  const note = make('p', null, 'chart-note');
  const tableBox = make('details', null, 'chart-details'); tableBox.append(make('summary', 'Xem bảng số liệu'));
  panel.append(controls, summary, plot, legend, note, tableBox, live);
  plot.append(tooltip);

  let points = [], geometry = null;
  const buttons = KEYS.map(item => {
    const button = make('button', item.tab); button.type = 'button'; button.setAttribute('role', 'tab'); button.dataset.key = item.key;
    button.addEventListener('click', () => { view.key = item.key; view.active = -1; draw(); });
    button.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]; if (!step) return; event.preventDefault();
      const next = buttons[(buttons.indexOf(button) + step + buttons.length) % buttons.length]; next.click(); next.focus();
    });
    tabs.append(button); return button;
  });
  const rangeButtons = RANGES.map(range => {
    const button = make('button', range.label); button.type = 'button'; button.dataset.days = range.days;
    button.addEventListener('click', () => { view.days = range.days; view.active = -1; draw(); });
    ranges.append(button); return button;
  });

  function visiblePoints() {
    const all = series?.series?.[view.key]?.points || [];
    if (!view.days || !all.length) return all;
    const start = addDays(all.at(-1).date, -(view.days - 1));
    return all.filter(point => point.date >= start);
  }

  function draw() {
    const meta = series?.series?.[view.key];
    for (const button of buttons) { const on = button.dataset.key === view.key; button.setAttribute('aria-selected', String(on)); button.tabIndex = on ? 0 : -1; }
    for (const button of rangeButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.days) === view.days));
    points = visiblePoints();
    plot.querySelector('svg')?.remove(); tooltip.hidden = true;
    if (!meta || points.length < 2) {
      summary.textContent = 'Chưa đủ ngày có bảng số liệu để vẽ diễn biến cho chỉ số này.';
      legend.replaceChildren(); note.textContent = ''; tableBox.hidden = true; return;
    }
    tableBox.hidden = false;
    const digits = digitsFor(view.key);
    const first = points[0], last = points.at(-1);
    const values = points.flatMap(point => point.buy != null ? [point.value, point.buy] : [point.value]);
    const high = points.reduce((a, b) => b.value > a.value ? b : a), low = points.reduce((a, b) => b.value < a.value ? b : a);
    const change = (last.value - first.value) / first.value * 100;
    summary.replaceChildren();
    const strong = make('strong', `${fmt(first.value, digits)} → ${fmt(last.value, digits)} ${meta.unit}`);
    const badge = make('span', pct(change), 'change-badge ' + (change > 0 ? 'up' : change < 0 ? 'down' : 'flat'));
    summary.append(make('span', `${short(first.date)} – ${short(last.date)}: `), strong, ' ', badge,
      make('span', ` · cao nhất ${fmt(high.value, digits)} (${short(high.date)}) · thấp nhất ${fmt(low.value, digits)} (${short(low.date)}) · ${points.length} ngày có số liệu`, 'trend-meta'));
    plot.setAttribute('aria-label', `${meta.label} từ ${short(first.date)} đến ${short(last.date)}: ${fmt(first.value, digits)} lên ${fmt(last.value, digits)} ${meta.unit}, ${pct(change)}. Dùng phím mũi tên trái phải để xem từng ngày, Enter để mở bản tin.`);

    // Geometry from the live width so text never stretches.
    const width = Math.max(280, plot.clientWidth || 640), height = width < 480 ? 220 : 260;
    const pad = { top: 16, right: 16, bottom: 30, left: width < 480 ? 46 : 58 };
    let min = Math.min(...values), max = Math.max(...values);
    const margin = (max - min) * 0.12 || max * 0.01 || 1; min -= margin; max += margin;
    const t0 = Date.parse(first.date), t1 = Date.parse(last.date);
    const x = date => pad.left + (Date.parse(date) - t0) / Math.max(1, t1 - t0) * (width - pad.left - pad.right);
    const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
    geometry = { x, y, width, height, pad };

    const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true', class: 'trend-svg' });
    for (let i = 0; i <= 4; i++) {
      const value = min + (max - min) * i / 4, yy = y(value);
      chart.append(svg('line', { x1: pad.left, x2: width - pad.right, y1: yy, y2: yy, class: 'trend-grid' }));
      const label = svg('text', { x: pad.left - 8, y: yy + 4, class: 'trend-axis', 'text-anchor': 'end' }); label.textContent = fmt(value, value >= 1000 ? 0 : digits); chart.append(label);
    }
    const ticks = width < 480 ? [first, last] : [first, points[Math.floor(points.length / 2)], last];
    for (const point of ticks) {
      const label = svg('text', { x: x(point.date), y: height - 8, class: 'trend-axis', 'text-anchor': point === first ? 'start' : point === last ? 'end' : 'middle' }); label.textContent = short(point.date); chart.append(label);
    }
    // Split the line where a day is missing so gaps stay visible instead of being bridged.
    const line = (key, className) => {
      let d = '', previous = null;
      for (const point of points) {
        const value = point[key]; if (value == null) { previous = null; continue; }
        const contiguous = previous && addDays(previous.date, 1) === point.date;
        if (previous && !contiguous) chart.append(svg('line', { x1: x(previous.date), y1: y(previous[key]), x2: x(point.date), y2: y(value), class: 'trend-gap' }));
        d += (contiguous ? 'L' : 'M') + x(point.date).toFixed(1) + ',' + y(value).toFixed(1);
        previous = point;
      }
      chart.append(svg('path', { d, class: className }));
    };
    if (view.key === 'gold') line('buy', 'trend-line trend-line-secondary');
    line('value', 'trend-line');
    for (const point of points) {
      const dot = svg('circle', { cx: x(point.date), cy: y(point.value), r: point.date === currentDate ? 5 : 3, class: 'trend-dot' + (point.date === currentDate ? ' is-current' : '') });
      chart.append(dot);
    }
    chart.append(svg('line', { x1: 0, x2: 0, y1: pad.top, y2: height - pad.bottom, class: 'trend-cursor', visibility: 'hidden' }));
    plot.prepend(chart);

    legend.replaceChildren();
    const item = (className, text) => { const row = make('span', null, 'trend-legend-item'); row.append(make('span', null, 'trend-swatch ' + className), text); legend.append(row); };
    item('primary', view.key === 'gold' ? 'Bán ra' : meta.label);
    if (view.key === 'gold') item('secondary', 'Mua vào');
    item('gap', 'Nét đứt: có ngày thiếu bảng số liệu');
    if (points.some(point => point.date === currentDate)) item('current', 'Ngày đang đọc');
    note.textContent = meta.note + '. Mỗi điểm là một bản tin; giá giữ đúng thời điểm ghi trong bản tin, không phải chuỗi giá đóng cửa chính thức.';

    const table = make('table', null, 'snapshot-table');
    table.append(make('caption', `${meta.label} · ${meta.unit}`));
    const head = make('tr'); for (const name of ['Ngày', view.key === 'gold' ? 'Bán ra' : 'Giá trị', ...(view.key === 'gold' ? ['Mua vào'] : []), 'So điểm trước']) { const th = make('th', name); th.scope = 'col'; head.append(th); }
    const thead = make('thead'); thead.append(head); table.append(thead);
    const body = make('tbody');
    points.forEach((point, index) => {
      const row = make('tr'), previous = points[index - 1];
      const cells = [dateLabel(point.date), fmt(point.value, digits), ...(view.key === 'gold' ? [point.buy != null ? fmt(point.buy, digits) : '—'] : []), previous ? pct((point.value - previous.value) / previous.value * 100) : '—'];
      const labels = ['Ngày', view.key === 'gold' ? 'Bán ra' : 'Giá trị', ...(view.key === 'gold' ? ['Mua vào'] : []), 'So điểm trước'];
      cells.forEach((text, i) => { const td = make('td', text); td.dataset.label = labels[i]; row.append(td); });
      body.append(row);
    });
    table.append(body); tableBox.querySelector('table')?.remove(); tableBox.append(table);
    if (view.active >= points.length) view.active = -1;
    if (view.active >= 0) focusPoint(view.active, false);
  }

  function focusPoint(index, announce = true) {
    if (!geometry || !points[index]) return;
    view.active = index;
    const point = points[index], previous = points[index - 1], meta = series.series[view.key], digits = digitsFor(view.key);
    const cx = geometry.x(point.date), cy = geometry.y(point.value);
    const cursor = plot.querySelector('.trend-cursor'); cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('visibility', 'visible');
    plot.querySelectorAll('.trend-dot').forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    const delta = previous ? (point.value - previous.value) / previous.value * 100 : null;
    tooltip.replaceChildren(make('strong', dateLabel(point.date)),
      make('span', `${view.key === 'gold' ? 'Bán ra ' : ''}${fmt(point.value, digits)} ${meta.unit}`));
    if (point.buy != null) tooltip.append(make('span', `Mua vào ${fmt(point.buy, digits)} · chênh ${fmt(point.value - point.buy, digits)}`));
    if (point.changePct != null) tooltip.append(make('span', `So phiên trước: ${pct(point.changePct)}`));
    else if (delta != null) tooltip.append(make('span', `So điểm trước (${short(previous.date)}): ${pct(delta)}`));
    tooltip.append(make('span', 'Bấm để mở bản tin', 'trend-tooltip-hint'));
    tooltip.hidden = false;
    const box = plot.getBoundingClientRect(), tipWidth = tooltip.offsetWidth || 180;
    tooltip.style.left = Math.min(Math.max(8, cx - tipWidth / 2), box.width - tipWidth - 8) + 'px';
    tooltip.style.top = Math.max(4, cy - (tooltip.offsetHeight || 80) - 14) + 'px';
    if (announce) live.textContent = tooltip.textContent.replace('Bấm để mở bản tin', '');
  }
  function nearest(clientX) {
    if (!geometry || !points.length) return -1;
    const left = plot.getBoundingClientRect().left;
    let best = 0, distance = Infinity;
    points.forEach((point, index) => { const d = Math.abs(geometry.x(point.date) - (clientX - left)); if (d < distance) { distance = d; best = index; } });
    return best;
  }
  plot.addEventListener('pointermove', event => { const index = nearest(event.clientX); if (index >= 0 && index !== view.active) focusPoint(index, false); });
  plot.addEventListener('pointerleave', () => { if (document.activeElement !== plot) { tooltip.hidden = true; plot.querySelector('.trend-cursor')?.setAttribute('visibility', 'hidden'); view.active = -1; plot.querySelectorAll('.trend-dot.is-active').forEach(dot => dot.classList.remove('is-active')); } });
  plot.addEventListener('click', event => { const index = nearest(event.clientX); if (index >= 0) onSelectDate(points[index].date); });
  plot.addEventListener('keydown', event => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (event.key in moves) {
      event.preventDefault();
      const start = view.active < 0 ? points.length - 1 : view.active;
      focusPoint(Math.min(points.length - 1, Math.max(0, start + (Number.isFinite(moves[event.key]) ? moves[event.key] : moves[event.key] > 0 ? points.length : -points.length))));
    } else if (event.key === 'Enter' && view.active >= 0) { event.preventDefault(); onSelectDate(points[view.active].date); }
  });
  plot.addEventListener('focus', () => { if (view.active < 0 && points.length) focusPoint(points.length - 1); });
  plot.addEventListener('blur', () => { tooltip.hidden = true; });

  let resizeFrame = 0;
  const observer = new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (panel.isConnected) draw(); else observer.disconnect(); }); });
  container.replaceWith(panel);
  observer.observe(plot);
  draw();
  return panel;
}
