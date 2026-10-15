import { describeSource, groupSources } from './source-catalog.mjs';

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
function badge(profile) {
  const node = make('span', profile.label, 'source-role-badge');
  node.title = profile.note; node.dataset.sourceRole = profile.role;
  return node;
}

export function enhanceSourceLinks(container) {
  for (const link of container.querySelectorAll('.dashboard-sources a, .event-source-links a')) {
    if (link.closest('.source-attribution')) continue;
    const profile = describeSource(link.href); if (!profile) continue;
    const wrapper = make('span', null, 'source-attribution');
    link.replaceWith(wrapper); wrapper.append(link, badge(profile));
  }
}

export function enhanceReportSources(container, sections) {
  const section = container.querySelector('#section-9');
  const sources = sections.find(item => item.id === '9')?.sources;
  if (!section || section.querySelector(':scope > .source-directory') || !sources?.length) return;
  const groups = groupSources(sources), directory = make('details', null, 'source-directory');
  directory.append(make('summary', 'Vai trò của nguồn trong bản tin · ' + groups.length + ' đơn vị'));
  directory.append(make('p', 'Nhãn mô tả đơn vị phát hành, không phải điểm tin cậy hay xác nhận dữ kiện. Doanh nghiệp là nguồn gốc cho thông tin chính họ công bố. Link, kỳ dữ liệu và thời điểm bên dưới vẫn cần được đọc cùng nhau.', 'source-directory-intro'));
  const list = make('ul', null, 'source-directory-list');
  for (const group of groups) {
    const row = make('li'), heading = make('div', null, 'source-directory-heading');
    heading.append(make('strong', group.name), badge(group));
    row.append(heading, make('p', group.note, 'source-role-note'));
    const links = make('div', null, 'source-directory-links');
    for (const [index, source] of group.links.entries()) {
      const link = make('a', group.links.length === 1 ? 'Mở nguồn đã dẫn' : 'Nguồn đã dẫn ' + (index + 1));
      link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = source.label;
      links.append(link);
    }
    row.append(links); list.append(row);
  }
  directory.append(list); section.insertBefore(directory, section.querySelector('.section-body'));
}
