// Background explanations, separate from dated news and market observations.
const cpiSource = { name: 'BLS · giải thích CPI', url: 'https://www.bls.gov/cpi/questions-and-answers.htm' };
const gdpSource = { name: 'BEA · giải thích GDP', url: 'https://www.bea.gov/resources/learning-center/what-to-know-gdp' };
const fedSource = { name: 'Fed · vai trò FOMC', url: 'https://www.federalreserve.gov/monetarypolicy/fomc.htm' };
export const LESSONS = {
  cpi: {
    title: 'CPI · chỉ số giá tiêu dùng và lạm phát',
    meaning: 'CPI (Consumer Price Index) theo dõi giá một rổ hàng hóa, dịch vụ tiêu dùng. Lạm phát là mức tăng của mặt bằng giá; tỷ lệ lạm phát giảm nhưng vẫn dương nghĩa là giá đang tăng chậm lại.',
    reading: 'Tỷ lệ thay đổi = (chỉ số kỳ mới ÷ chỉ số kỳ so sánh − 1) × 100%. Phải đọc rõ so tháng trước hay so cùng kỳ năm trước.',
    example: 'Ví dụ giả định: chỉ số từ 100 lên 103 nghĩa là tăng (103 ÷ 100 − 1) × 100% = 3%. Đây là mức bình quân, không phải mọi món hàng đều tăng 3%.',
    relevance: 'Nhận định: lạm phát có thể tác động kỳ vọng lãi suất, rồi ảnh hưởng USD, vàng và chi phí vốn tại Việt Nam. Cần xem kết quả so với kỳ vọng và phản ứng thị trường.',
    caution: 'CPI phản ánh rổ tiêu dùng bình quân; mức tăng chi phí riêng của gia đình bạn có thể khác. Một lần công bố chưa đủ xác nhận xu hướng.',
    sources: [cpiSource]
  },
  core: {
    title: 'CPI cơ bản · vì sao loại thực phẩm và năng lượng?',
    meaning: 'Trong báo cáo Mỹ, CPI cơ bản loại thực phẩm và năng lượng để nhìn rõ hơn những thay đổi giá ở các nhóm còn lại; hai nhóm bị loại thường biến động mạnh.',
    reading: 'Đọc cùng CPI tổng thể và cùng kỳ so sánh. Đây là hai rổ khác nhau nên không lấy một mức trừ mức kia rồi gọi là thay đổi lạm phát theo thời gian.',
    example: 'Ví dụ giả định: CPI tổng thể 3% và CPI cơ bản 2% là hai cách đo tại cùng một kỳ; không có nghĩa lạm phát vừa giảm 1 điểm phần trăm.',
    relevance: 'Nhận định: dùng hai thước đo giúp xem biến động có tập trung ở năng lượng/thực phẩm hay lan sang các nhóm khác.',
    caution: 'Các khoản bị loại vẫn là chi phí thực tế của hộ gia đình. CPI cơ bản không thay thế hoàn toàn CPI tổng thể.',
    sources: [cpiSource]
  },
  units: {
    title: 'Phần trăm, điểm phần trăm và điểm cơ bản',
    meaning: 'Phần trăm (%) đo thay đổi tương đối so với một gốc. Điểm phần trăm đo khoảng cách giữa hai tỷ lệ. Điểm cơ bản là đơn vị nhỏ hơn: 100 điểm cơ bản = 1 điểm phần trăm.',
    reading: 'Thay đổi tương đối = (mới − cũ) ÷ cũ × 100%, khi gốc khác 0 và có ý nghĩa. Khoảng cách hai tỷ lệ = tỷ lệ mới − tỷ lệ cũ.',
    example: 'Ví dụ giả định: lãi suất từ 4% lên 4,25% tăng 0,25 điểm phần trăm, bằng 25 điểm cơ bản. Mức tăng tương đối là 0,25 ÷ 4 × 100% = 6,25%; ba cách nói không được dùng lẫn.',
    relevance: 'Giúp đọc đúng quyết định lãi suất và chênh lệch thực tế/dự báo; một sai sót đơn vị có thể làm bạn hiểu sai mức thay đổi.',
    caution: 'Dự báo là ước tính trước công bố; kỳ trước là kết quả của kỳ cũ. Kỳ dữ liệu khác với ngày công bố. Số điều chỉnh là số của kỳ cũ được nguồn cập nhật lại.',
    sources: []
  },
  ppi: {
    title: 'PPI · giá mà nhà sản xuất nhận được',
    meaning: 'PPI (Producer Price Index) đo thay đổi giá bán mà nhà sản xuất trong nước nhận được. CPI nhìn từ phía người tiêu dùng; hai thước đo có phạm vi khác nhau.',
    reading: 'Đọc chỉ tiêu, kỳ so sánh và việc điều chỉnh mùa vụ. Điều chỉnh mùa vụ là loại bớt dao động lặp lại theo mùa để quan sát thay đổi ngắn hạn.',
    example: 'Ví dụ giả định: chỉ số giá nhà sản xuất từ 100 lên 102 là tăng 2%. Chưa thể kết luận giá bán lẻ cũng tăng 2%.',
    relevance: 'Nhận định: chi phí có thể truyền tới khách hàng, hoặc doanh nghiệp phải chịu một phần bằng lợi nhuận thấp hơn; khả năng tăng giá bán phụ thuộc cạnh tranh và sức mua.',
    caution: 'PPI tăng không đồng nghĩa mọi doanh nghiệp đều có chi phí tăng cùng tỷ lệ hoặc CPI sẽ tăng ngay.',
    sources: [{ name: 'BLS · giải thích PPI', url: 'https://www.bls.gov/ppi/overview.htm' }]
  },
  pce: {
    title: 'PCE · chỉ số giá chi tiêu tiêu dùng cá nhân',
    meaning: 'PCE (Personal Consumption Expenditures) là chi tiêu tiêu dùng cá nhân; chỉ số giá PCE đo biến động giá của các khoản chi này. PCE cơ bản loại thực phẩm và năng lượng.',
    reading: 'Đọc rõ đang nói về số tiền chi tiêu hay chỉ số giá. Đối chiếu đúng kỳ và đúng loại tổng thể/cơ bản; phạm vi và trọng số PCE khác CPI.',
    example: 'Ví dụ giả định: chỉ số giá PCE từ 100 lên 102 là tăng 2%; điều đó không có nghĩa tổng số tiền người dân chi tiêu chỉ tăng 2%.',
    relevance: 'Nhận định: số liệu giúp phân biệt sức mua thay đổi do giá hay lượng tiêu dùng và đánh giá áp lực giá trong nền kinh tế.',
    caution: 'Không ghép CPI tháng này với PCE tháng trước để tính tăng/giảm. Hai thước đo có thể khác nhau mà không có nguồn nào sai.',
    sources: [{ name: 'BEA · giá cả và lạm phát', url: 'https://www.bea.gov/resources/learning-center/what-to-know-prices-inflation' }]
  },
  fed: {
    title: 'Fed, FOMC và quyết định lãi suất',
    meaning: 'Fed là ngân hàng trung ương Mỹ. FOMC (Federal Open Market Committee), tức Ủy ban Thị trường Mở Liên bang, quyết định chính sách tiền tệ, trong đó có khoảng lãi suất mục tiêu.',
    reading: 'Quyết định cho biết thay đổi chính sách thực tế; họp báo giải thích đánh giá và định hướng. Phát biểu về khả năng hành động trong tương lai chưa phải một quyết định mới.',
    example: 'Ví dụ giả định: khoảng mục tiêu từ 4–4,25% lên 4,25–4,50% nghĩa là cả hai cận tăng 0,25 điểm phần trăm, bằng 25 điểm cơ bản.',
    relevance: 'Nhận định: lãi suất Mỹ và kỳ vọng có thể ảnh hưởng USD, chi phí vay ngoại tệ và dòng vốn. Doanh nghiệp có nợ USD và doanh nghiệp có doanh thu USD chịu tác động khác nhau.',
    caution: 'Giữ nguyên lãi suất vẫn có thể làm thị trường biến động nếu khác kỳ vọng. Không mặc định tăng lãi suất khiến mọi cổ phiếu giảm ngay.',
    sources: [fedSource]
  },
  gdp: {
    title: 'GDP · tăng trưởng thực, danh nghĩa và năm hóa',
    meaning: 'GDP (Gross Domestic Product), tổng sản phẩm trong nước, đo giá trị sản xuất cuối cùng trong nền kinh tế. GDP thực đã loại ảnh hưởng giá; GDP danh nghĩa dùng giá hiện hành.',
    reading: 'Năm hóa quy đổi nhịp tăng một quý thành nhịp năm nếu nhịp đó lặp lại bốn quý. Nó khác so với cùng quý năm trước, và không phải dự báo bảo đảm.',
    example: 'Ví dụ giả định: tăng 1% so quý trước tương ứng ((1 + 0,01)^4 − 1) × 100% ≈ 4,06% năm hóa. Phép tính giả định tốc độ một quý lặp lại bốn lần.',
    relevance: 'Nhận định: tăng trưởng Mỹ có thể liên hệ với nhu cầu nhập khẩu hàng Việt Nam, nhưng cần xem cơ cấu chi tiêu và từng ngành xuất khẩu.',
    caution: 'GDP tăng không bảo đảm mọi doanh nghiệp có lợi nhuận tăng. Ước tính ban đầu có thể được điều chỉnh.',
    sources: [gdpSource]
  },
  jobs: {
    title: 'Việc làm, thất nghiệp và tiền lương',
    meaning: 'Việc làm phi nông nghiệp đếm công việc trong khảo sát doanh nghiệp. Tỷ lệ thất nghiệp đo người thất nghiệp trong lực lượng lao động, gồm người có việc làm và người thất nghiệp theo định nghĩa khảo sát.',
    reading: 'Tỷ lệ thất nghiệp = người thất nghiệp ÷ lực lượng lao động × 100%. Đọc cùng số việc làm, tiền lương và tỷ lệ tham gia lao động để hiểu bối cảnh.',
    example: 'Ví dụ giả định: lực lượng lao động 1.000 người, có 40 người thất nghiệp thì tỷ lệ là 40 ÷ 1.000 × 100% = 4%. Không lấy mẫu số là toàn bộ dân số.',
    relevance: 'Nhận định: việc làm và tiền lương ảnh hưởng sức mua, đồng thời có thể thay đổi kỳ vọng lãi suất Mỹ và nhu cầu hàng xuất khẩu Việt Nam.',
    caution: 'Số công việc khác số người có việc làm: một người có thể làm nhiều việc. Tỷ lệ thất nghiệp giảm cũng cần kiểm tra có người rời lực lượng lao động hay không.',
    sources: [{ name: 'BLS · định nghĩa lao động', url: 'https://www.bls.gov/cps/definitions.htm' }, { name: 'BLS · khảo sát việc làm', url: 'https://www.bls.gov/web/empsit/cesfaq.htm' }]
  },
  indices: {
    title: 'VN-Index, VN30 và “điểm” chứng khoán',
    meaning: 'VN-Index phản ánh giá cổ phiếu trên HOSE, tức Sở Giao dịch Chứng khoán TP.HCM. VN30 theo dõi một rổ 30 cổ phiếu được chọn theo quy mô và thanh khoản. Điểm là đơn vị chỉ số, không phải đồng tiền.',
    reading: 'Thay đổi điểm = điểm mới − điểm cũ; thay đổi % = chênh lệch điểm ÷ điểm cũ × 100%. Cổ phiếu có ảnh hưởng khác nhau trong chỉ số; không phải trung bình cộng đơn giản.',
    example: 'Ví dụ giả định: chỉ số từ 1.000 xuống 990 là giảm 10 điểm, tương ứng −10 ÷ 1.000 × 100% = −1%. Điều này không nói mọi cổ phiếu đều giảm 1%.',
    relevance: 'Theo dõi cả hai giúp đặt diễn biến nhóm lớn trong bối cảnh HOSE. Vốn hóa là giá cổ phiếu nhân số cổ phiếu tương ứng; thanh khoản nói về khả năng mua bán thuận lợi.',
    caution: 'Hai rổ có phần trùng nhau. Chỉ số tăng không chứng minh đa số cổ phiếu tăng; cần đọc độ rộng, tức số mã tăng/giảm, và giá trị giao dịch. So chỉ số khác nhau nên dùng % cùng kỳ, không so trực tiếp độ cao điểm số.',
    sources: [{ name: 'Báo Chính phủ · VN30 và VN-Index', url: 'https://baochinhphu.vn/hose-chinh-thuc-trien-khai-chi-so-vn-30-nha-dau-tu-co-them-mot-thuoc-do-thi-truong-102118206.htm' }]
  },
  gold: {
    title: 'Giá vàng mua vào, bán ra và chênh lệch',
    meaning: 'Mua vào là giá cửa hàng mua vàng của bạn. Bán ra là giá cửa hàng bán vàng cho bạn. Chênh lệch mua–bán là khoảng cách giữa hai mức của cùng sản phẩm tại cùng thời điểm.',
    reading: 'Chênh lệch = giá bán ra − giá mua vào. Đối chiếu cùng loại vàng, đơn vị, nơi báo giá và thời điểm trước khi tính.',
    example: 'Ví dụ giả định: cửa hàng mua 100, bán 103 triệu đồng/lượng. Bạn mua theo 103; nếu bán lại ngay theo báo giá 100 thì chênh 3 triệu đồng/lượng, chưa tính chi phí khác. Đây không phải dự báo giá.',
    relevance: 'Khoảng chênh giúp hiểu vì sao giá niêm yết đi lên chưa bảo đảm người mua bán lại có lãi.',
    caution: 'Vàng miếng, nhẫn và vàng thế giới khác loại/đơn vị không được so trực tiếp. Cần quy đổi phù hợp rồi mới đánh giá chênh lệch.',
    sources: []
  },
  oil: {
    title: 'Dầu Brent · giá tham chiếu và giá bán lẻ',
    meaning: 'Brent là một chuẩn tham chiếu giá dầu thô quốc tế. Giá USD/thùng biểu thị đô la Mỹ cho một thùng dầu; khác giá xăng bán lẻ bằng đồng/lít tại Việt Nam.',
    reading: 'Đọc loại dầu, loại giá, kỳ hạn hợp đồng nếu có và giờ báo giá. Hợp đồng tháng khác nhau hoặc giá giao ngay/thanh toán có thể khác nhau.',
    example: 'Ví dụ giả định: cùng hợp đồng Brent từ 100 lên 102 USD/thùng là tăng 2 USD/thùng, tức 2%. Không suy ra xăng trong nước tăng ngay 2%.',
    relevance: 'Nhận định: tác động có thể truyền qua dầu thô, sản phẩm lọc dầu, tỷ giá, thuế và kỳ điều hành, rồi tới chi phí vận tải/sản xuất.',
    caution: 'Dầu tăng có thể thuận lợi cho bên bán dầu nhưng gây sức ép cho bên tiêu thụ. Không coi mọi doanh nghiệp dầu khí cùng hưởng lợi.',
    sources: [{ name: 'EIA · định nghĩa Brent', url: 'https://www.eia.gov/dnav/pet/TblDefs/pet_pri_spt_tbldef2.asp' }]
  }
};
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
export function eventLessons(event) {
  const text = normalized(event.title + ' ' + (event.metrics || []).map(metric => metric.label).join(' '));
  const keys = [];
  for (const [key, pattern] of [['cpi', /\bcpi\b/], ['ppi', /\bppi\b/], ['pce', /\bpce\b/], ['fed', /\bfed\b|\bfomc\b/], ['gdp', /\bgdp\b/], ['jobs', /viec lam|that nghiep|tien luong/]]) if (pattern.test(text)) keys.push(key);
  if (keys.includes('cpi') && /co ban/.test(text)) keys.push('core');
  return [...keys, 'units'];
}
function periodIndex(period) {
  const month = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec(period || '');
  if (month) return { type: 'month', index: +month[2] * 12 + +month[1] };
  const quarter = /^Quý (I|II|III|IV)\/(\d{4})$/.exec(period || '');
  if (quarter) return { type: 'quarter', index: +quarter[2] * 4 + ['I', 'II', 'III', 'IV'].indexOf(quarter[1]) };
  return null;
}
export function metricExplanation(metric) {
  const format = number => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(number);
  const actual = metric.actual, previous = metric.previous, forecast = metric.forecast;
  if (actual == null) return ['Chưa có kết quả thực tế đã xác minh. Giờ trong lịch là giờ dự kiến công bố, không phải bằng chứng dữ liệu đã được công bố.'];
  const lines = ['Kết quả kỳ ' + actual.period + ' là ' + (typeof actual.value === 'number' ? format(actual.value) : actual.value) + ' ' + metric.unit + '. Cách đối chiếu: ' + metric.basis];
  const a = periodIndex(actual.period), b = periodIndex(previous?.period);
  if (typeof actual.value === 'number' && Number.isFinite(actual.value) && typeof previous?.value === 'number' && Number.isFinite(previous.value) && a && b && a.type === b.type && a.index - b.index === 1) {
    const change = Number((actual.value - previous.value).toFixed(8)), unit = metric.unit === '%' ? 'điểm phần trăm' : metric.unit;
    lines.push('Kỳ trước ' + previous.period + ': ' + format(previous.value) + ' ' + metric.unit + '. Phép trừ: ' + format(actual.value) + ' − (' + format(previous.value) + ') = ' + format(change) + ' ' + unit + '; tức ' + (change > 0 ? 'tăng ' : change < 0 ? 'giảm ' : 'không đổi ') + format(Math.abs(change)) + ' ' + unit + '.');
    if (metric.unit === '%') lines.push('Đây là chênh lệch giữa hai tỷ lệ cùng cách đo. Không gọi chênh lệch này là mức tăng giá trong một tháng nếu chỉ tiêu đang so với cùng kỳ năm trước.');
    if (metric.unit === '%' && /cpi|ppi|pce/.test(normalized(metric.label)) && actual.value > 0 && change < 0) lines.push('Tỷ lệ tăng giá thấp hơn nhưng vẫn dương: giá bình quân vẫn cao hơn mốc so sánh tương ứng, chỉ tăng chậm hơn.');
  } else lines.push('Chưa đủ hai mốc số tương thích của hai kỳ liền nhau để tự tính thay đổi so kỳ trước. Không lấy số khác kỳ hoặc dữ liệu thiếu để bù.');
  if (typeof actual.value === 'number' && typeof forecast?.value === 'number') lines.push('So với dự báo trước công bố: ' + format(actual.value) + ' − (' + format(forecast.value) + ') = ' + format(Number((actual.value - forecast.value).toFixed(8))) + ' ' + (metric.unit === '%' ? 'điểm phần trăm' : metric.unit) + '. Dự báo khác với kết quả kỳ trước.');
  else lines.push('Chưa có dự báo đã xác minh nên chưa kết luận kết quả cao hơn hoặc thấp hơn kỳ vọng thị trường.');
  if (previous?.revisedFrom != null) lines.push('Kỳ trước có số điều chỉnh. Phép đối chiếu dùng số đã điều chỉnh được dẫn nguồn, không phải số công bố ban đầu.');
  lines.push('Đây là cách đọc số liệu; nguyên nhân biến động tài sản phải được kiểm chứng riêng trong phần nhận định.');
  return lines;
}
