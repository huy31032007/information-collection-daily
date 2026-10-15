// Publisher roles describe provenance, never verification or a confidence score.
export const SOURCE_ROLES = Object.freeze({
  authority: { label: 'Cơ quan công bố', note: 'Đối chiếu công bố gốc, kỳ dữ liệu, đơn vị và thời điểm; tên cơ quan không tự xác nhận mọi diễn giải.' },
  exchange: { label: 'Sở / hạ tầng thị trường', note: 'Đọc đúng sàn, sản phẩm, phiên và phạm vi giao dịch hoặc lưu ký mà đơn vị công bố.' },
  company: { label: 'Doanh nghiệp công bố', note: 'Là nguồn gốc cho báo giá hoặc hoạt động chính doanh nghiệp công bố; nhận định và thông tin bên ngoài vẫn cần đối chiếu.' },
  press: { label: 'Báo chí / thông tấn', note: 'Phân biệt dữ kiện, nguồn được dẫn và bình luận. Hai bài đăng lại cùng một nguồn không phải hai xác nhận độc lập.' },
  research: { label: 'Nghiên cứu / chuyên môn', note: 'Đọc phương pháp, mẫu khảo sát, kỳ và giới hạn; phân biệt số đo, số tổng hợp và nhận định.' },
  data: { label: 'Đơn vị dữ liệu', note: 'Đối chiếu nguồn gốc, cách tính, độ trễ và quyền sử dụng; không mặc định số liệu là thời gian thực.' },
  aggregate: { label: 'Kho / trang tổng hợp', note: 'Xác định tổ chức cung cấp dữ liệu hoặc hãng tin của từng bài; không coi trang đăng lại là một nguồn độc lập mới.' },
  unknown: { label: 'Chưa phân loại', note: 'Chưa xác định vai trò của đơn vị trong danh mục. Cần đọc nguồn gốc; nhãn này không kết luận nội dung sai.' }
});
const groups = [
  ['authority', [
    ['sbv', 'Ngân hàng Nhà nước', ['sbv.gov.vn']], ['nso', 'Cục Thống kê', ['nso.gov.vn','gso.gov.vn']],
    ['moit', 'Bộ Công Thương', ['moit.gov.vn']], ['mof', 'Bộ Tài chính', ['mof.gov.vn']],
    ['customs', 'Hải quan Việt Nam', ['customs.gov.vn']], ['fed', 'Cục Dự trữ Liên bang Mỹ', ['federalreserve.gov']],
    ['bls', 'Cục Thống kê Lao động Mỹ', ['bls.gov']], ['bea', 'Cục Phân tích Kinh tế Mỹ', ['bea.gov']],
    ['eia', 'Cơ quan Thông tin Năng lượng Mỹ', ['eia.gov']]
  ]],
  ['exchange', [
    ['hose', 'HOSE', ['hsx.vn']], ['hnx', 'HNX', ['hnx.vn']],
    ['vsdc', 'VSDC', ['vsd.vn']], ['cme', 'CME Group', ['cmegroup.com']]
  ]],
  ['company', [
    ['doji', 'DOJI', ['doji.vn']], ['pnj', 'PNJ', ['pnj.com.vn']], ['sjc', 'SJC', ['sjc.com.vn']],
    ['btmc', 'Bảo Tín Minh Châu', ['btmc.vn']], ['petrolimex', 'Petrolimex', ['petrolimex.com.vn']],
    ['saigonpetro', 'Saigon Petro', ['saigonpetro.com.vn']],
    ['vndirect', 'VNDIRECT', ['vndirect.com.vn']], ['jsi', 'Chứng khoán Nhật Bản', ['japan-sec.vn']],
    ['jpmorgan', 'JPMorganChase', ['jpmorganchase.com']]
  ]],
  ['press', [
    ['vietnamplus', 'TTXVN / VietnamPlus', ['vietnamplus.vn']], ['chinhphu', 'Báo Chính phủ', ['baochinhphu.vn']],
    ['taichinh', 'Thời báo Tài chính Việt Nam', ['thoibaotaichinhvietnam.vn']], ['nhandan', 'Nhân Dân', ['nhandan.vn']],
    ['vov', 'VOV', ['vov.vn']], ['vtv', 'VTV', ['vtv.vn']], ['dangcongsan', 'Cổng thông tin Đảng Cộng sản Việt Nam', ['dangcongsan.org.vn']],
    ['lamdong', 'Báo Lâm Đồng', ['baolamdong.vn']], ['vneconomy', 'VnEconomy', ['vneconomy.vn']],
    ['dautu', 'Báo Đầu Tư', ['baodautu.vn']], ['saigontimes', 'Saigon Times', ['thesaigontimes.vn']],
    ['tuoitre', 'Tuổi Trẻ', ['tuoitre.vn']], ['reuters', 'Reuters', ['reuters.com']], ['ap', 'AP', ['apnews.com']]
  ]],
  ['research', [['vbma', 'Hiệp hội Thị trường Trái phiếu Việt Nam', ['vbma.org.vn']], ['spglobal', 'S&P Global', ['spglobal.com']]]],
  ['data', [
    ['stockbiz', 'Stockbiz', ['stockbiz.vn']], ['investing', 'Investing.com', ['investing.com']], ['kitco', 'Kitco', ['kitco.com']],
    ['vietstock', 'Vietstock', ['vietstock.vn']], ['fiin', 'FiinGroup / FiinTrade', ['fiingroup.vn','fiintrade.vn']]
  ]],
  ['aggregate', [
    ['fred', 'FRED / St. Louis Fed', ['fred.stlouisfed.org']], ['marketscreener', 'MarketScreener', ['marketscreener.com']],
    ['forexfactory', 'Forex Factory', ['forexfactory.com']], ['tradingeconomics', 'Trading Economics', ['tradingeconomics.com']]
  ]]
];
const catalog = groups.flatMap(([role, entries]) => entries.map(([id, name, domains]) => ({ id, name, domains, role })));

export function describeSource(input) {
  let url;
  try { url = new URL(input); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const entry = catalog.find(source => source.domains.some(domain => host === domain || host.endsWith('.' + domain)));
  const role = entry?.role || 'unknown';
  return { id: entry?.id || host, name: entry?.name || host, host, href: url.href, role, ...SOURCE_ROLES[role], known: Boolean(entry) };
}

export function groupSources(sources = []) {
  const groups = new Map();
  for (const source of sources) {
    const profile = describeSource(source?.href || source?.url);
    if (!profile) continue;
    let group = groups.get(profile.id);
    if (!group) { group = { ...profile, links: [] }; groups.set(profile.id, group); }
    if (!group.links.some(link => link.href === profile.href)) group.links.push({ href: profile.href, label: source.label || source.name || profile.name });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
