import { LESSONS, eventLessons, metricExplanation } from './learning.mjs';

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
export function renderLessons(keys, title = 'Giải thích cho người mới học') {
  const group = make('details', null, 'learning-group'); group.append(make('summary', title));
  const intro = make('p', 'Kiến thức nền bổ sung · Ví dụ giả định được ghi riêng; dữ liệu thật giữ nguyên nguồn và thời điểm.', 'learning-intro'); group.append(intro);
  for (const [index, key] of [...new Set(keys)].filter(key => LESSONS[key]).entries()) {
    const lesson = LESSONS[key], entry = make('details', null, 'learning-concept'); entry.dataset.lesson = key; entry.open = index === 0;
    entry.append(make('summary', lesson.title));
    const body = make('div', null, 'learning-copy');
    for (const [field, label] of [['meaning', 'Hiểu đơn giản'], ['reading', 'Cách đọc / cách tính'], ['example', 'Ví dụ để học'], ['relevance', 'Vì sao đáng chú ý'], ['caution', 'Điểm dễ nhầm']]) {
      const paragraph = make('p'); paragraph.append(make('strong', label + ': '), document.createTextNode(lesson[field])); body.append(paragraph);
    }
    if (lesson.sources.length) {
      const sources = make('p', 'Tài liệu giải thích: ', 'learning-sources');
      for (const source of lesson.sources) { const a = make('a', source.name); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a); }
      body.append(sources);
    }
    entry.append(body); group.append(entry);
  }
  return group;
}
export function eventLearning(event) { return renderLessons(eventLessons(event)); }
export function metricLearning(metric, open = false) {
  const guide = make('details', null, 'metric-reading'); guide.open = open;
  guide.append(make('summary', 'Đọc số liệu và sự thay đổi từng bước'));
  const content = make('div', null, 'learning-copy');
  for (const text of metricExplanation(metric)) content.append(make('p', text));
  guide.append(content); return guide;
}
export function enhanceMarketLearning(container) {
  for (const card of container.querySelectorAll('.market-card')) {
    if (card.querySelector(':scope > .learning-group')) continue;
    const title = card.querySelector('.market-label')?.textContent || '';
    const key = /VN-Index|VN30/.test(title) ? 'indices' : /Vàng/.test(title) ? 'gold' : /Brent/.test(title) ? 'oil' : null;
    if (!key) continue;
    const guide = renderLessons([key], 'Hiểu chỉ số và cách đọc giá'); guide.classList.add('market-learning'); card.append(guide);
  }
}
export function enhanceReportLearning(container) {
  for (const section of container.querySelectorAll('.report-section')) {
    if (section.querySelector(':scope > .learning-group')) continue;
    const body = section.querySelector('.section-body'); if (!body) continue;
    let keys = [];
    if (section.id === 'section-2') keys = ['indices', 'units'];
    else if (section.id === 'section-3') keys = ['gold'];
    else if (section.id === 'section-4') keys = ['oil'];
    else if (section.id === 'section-5' || section.id === 'section-6') keys = eventLessons({ title: body.textContent, metrics: [] }).filter(key => key !== 'units').slice(0, 3);
    if (keys.length) section.insertBefore(renderLessons(keys, 'Học cách đọc chuyên mục này'), body);
  }
}
