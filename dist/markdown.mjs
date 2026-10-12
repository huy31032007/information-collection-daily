import { safeLink } from './lib.mjs';

const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
export function inline(parent, text) {
  const pattern = /(\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[2]) {
      const href = safeLink(match[3]);
      if (href) { const anchor = element('a', match[2]); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; parent.append(anchor); }
      else parent.append(document.createTextNode(match[2]));
    } else if (match[4]) {
      const strong = element('strong'); inline(strong, match[4]); parent.append(strong);
      if (match[4] === 'Chưa xác minh') parent.append(element('span', 'Unverified', 'type-badge'));
    } else if (match[5]) parent.append(element('code', match[5]));
    else parent.append(element('em', match[6]));
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
function classification(text) {
  if (/^\*\*Nhận định của cơ quan/.test(text)) return ['Estimate', 'Ước tính / dự báo'];
  if (/^\*\*Nhận định/.test(text)) return ['Analysis', 'Nhận định'];
  if (/^\*\*Đã xác nhận/.test(text)) return ['Fact', 'Thông tin đã xác nhận'];
  if (/^\*\*Chưa xác minh/.test(text)) return ['Unverified', 'Chưa xác minh'];
  if (/^\*\*(?:Ý kiến|Bình luận)/.test(text)) return ['Opinion', 'Ý kiến / bình luận'];
  return null;
}
export function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { const node = element('h' + Math.min(heading[1].length, 5)); inline(node, heading[2]); fragment.append(node); i++; continue; }
    if (/^\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || '')) {
      const headers = cells(line); const wrapper = element('div', null, 'table-wrap'); const table = element('table', null, 'data-table');
      const thead = element('thead'); const head = element('tr');
      for (const label of headers) { const th = element('th'); th.scope = 'col'; inline(th, label); head.append(th); }
      thead.append(head); table.append(thead); const tbody = element('tbody'); i += 2;
      while (i < lines.length && /^\|/.test(lines[i])) {
        const row = element('tr'); const values = cells(lines[i]);
        for (let col = 0; col < headers.length; col++) { const td = element('td'); td.dataset.label = headers[col]; const value = element('span', null, 'cell-value'); inline(value, values[col] || ''); td.append(value); row.append(td); }
        tbody.append(row); i++;
      }
      table.append(tbody); wrapper.append(table); fragment.append(wrapper); continue;
    }
    const bullet = /^\s*[-*]\s+/.test(line), ordered = /^\d+\.\s+/.test(line);
    if (bullet || ordered) {
      const list = element(bullet ? 'ul' : 'ol'); const pattern = bullet ? /^\s*[-*]\s+/ : /^\d+\.\s+/;
      while (i < lines.length && pattern.test(lines[i])) {
        const item = element('li'); const text = lines[i].replace(pattern, ''); const kind = classification(text);
        if (kind) { item.classList.add('classified', kind[0].toLowerCase()); const badge = element('span', kind[0], 'type-badge'); badge.title = kind[1]; item.append(badge); }
        inline(item, text); list.append(item); i++;
      }
      fragment.append(list); continue;
    }
    const paragraph = element('p'); const content = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|\||\s*[-*]\s|\d+\.\s)/.test(lines[i])) { content.push(lines[i]); i++; }
    if (!content.length) { content.push(lines[i]); i++; }
    const text = content.join(' '); const kind = classification(text);
    if (kind) { paragraph.classList.add('classified', kind[0].toLowerCase()); const badge = element('span', kind[0], 'type-badge'); badge.title = kind[1]; paragraph.append(badge); }
    inline(paragraph, text); fragment.append(paragraph);
  }
  return fragment;
}
