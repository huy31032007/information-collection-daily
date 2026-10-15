# Lịch sự kiện kinh tế

Lịch dùng cùng website tĩnh, repository, Worker và lượt tổng hợp 21:30 Asia/Ho_Chi_Minh hiện có. Không có crawler, API backend, database, lịch chạy hay dependency mới. Trình duyệt chỉ tải JSON đã xuất bản cùng origin; nút làm mới không truy vấn BLS, Fed hoặc Forex Factory.

## Nguồn và phạm vi

- [BLS](https://www.bls.gov/schedule/): CPI, PPI, việc làm, thất nghiệp và tiền lương. Lịch ghi Eastern Time, cần xử lý múi giờ America/New_York theo ngày thực tế.
- [Fed](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) và [lịch sự kiện theo tháng](https://www.federalreserve.gov/newsevents/2026-october.htm): quyết định, họp báo, biên bản và dự báo kinh tế khi lịch xác nhận. Quyết định và họp báo là hai sự kiện, không mặc định lần họp nào cũng có bản dự báo.
- [BEA](https://www.bea.gov/news/schedule): GDP và báo cáo Personal Income and Outlays, trong đó có chỉ số giá PCE.
- [Forex Factory](https://www.forexfactory.com/calendar) có liên kết tham khảo trên web. Không sao chép database/feed, mức ảnh hưởng hoặc dự báo của họ khi chưa xác minh quyền sử dụng. [Điều khoản](https://www.forexfactory.com/notices) hạn chế tái xuất bản; thử truy cập JSON trực tiếp ngày 15/10/2026 trả HTTP 403. Không vượt bảo vệ truy cập.

Đây là lịch các sự kiện được chọn, không tuyên bố bao phủ tất cả công bố. Lần khởi tạo kiểm tra ngày 15/10/2026, phạm vi 08/10–14/11/2026, gồm 9 sự kiện có nguồn chính thức. Giá trị dự báo chưa có nguồn khả thi được để null; không đưa số mẫu vào dữ liệu thật. Nội dung giải thích tác động và mức theo dõi là Nhận định của bản tin, không phải đánh giá của Forex Factory.

## Dữ liệu và writer

`dist/data/economic-calendar.json` là snapshot lịch được kiểm tra gần nhất, có mốc riêng `checkedAt`. Lịch có thể mới hơn bản tin; không thay `reportDate`, `cutoffAt` hoặc nội dung của các bản tin cũ.

Mỗi lượt tổng hợp 21:30:

1. Kiểm tra nguồn chính thức cho các sự kiện đã lưu, kết quả của các công bố đã qua và lịch tối đa 30 ngày tới. Có thể giữ các sự kiện gần đây làm bối cảnh, ghi đúng kỳ/ngày. Đổi lịch phải theo nguồn, không tự đoán giờ. Giữ id ổn định theo chỉ tiêu, kỳ và loại công bố, không dùng giờ lịch làm id vì giờ có thể đổi.
2. Đưa snapshot vào trường tùy chọn `economic_calendar` của JSON bản tin hiện có. Cùng dữ kiện/nguồn phải xuất hiện trong các mục liên quan của Markdown; lịch không phải một bản tin được research riêng. `checkedAt` không được vượt `cutoffAt`. Với lỗi nguồn, giữ dữ liệu cũ cùng mốc cũ, không gán mốc kiểm tra mới cho số liệu chưa kiểm tra.
3. Dùng `node scripts/write-newsletter.mjs` nhận JSON qua stdin như hiện tại. Writer lưu snapshot trong archive của ngày và xuất lịch hiện tại cùng một khóa ghi; từng file được ghi atomically. Không dùng script enrich/RSS cho lịch.
4. Commit/push cả `dist/data/economic-calendar.json` nếu writer thay đổi file này, cùng latest/index/archive do lượt chạy tạo. Giữ lịch mới hơn nếu snapshot bản tin cũ hơn lịch hiện tại. Cùng mốc kiểm tra nhưng khác nội dung bị từ chối; không sửa/xóa file để vượt guard.
5. Chạy `npm run check`, `npm test`; sau deploy đối chiếu lịch trên URL thật với local, kiểm tra mốc, id, thời gian và kết quả, ngoài các kiểm tra bản tin hiện có.

Để khởi tạo hoặc cập nhật **chỉ lịch** sau một lần kiểm chứng độc lập được yêu cầu, writer hỗ trợ `node scripts/write-newsletter.mjs --calendar`, cũng nhận JSON snapshot qua stdin. Chế độ này không thay latest hoặc archive bản tin, yêu cầu cùng sourceThreadId và bảo vệ mốc lịch mới hơn. Đây không phải lịch chạy mới. Không dùng nó để gắn dữ liệu mới vào bản tin quá khứ.

## Hợp đồng snapshot, phiên bản 1

Snapshot gồm:

| Trường | Ý nghĩa |
| --- | --- |
| version | Số 1 |
| timezone | Asia/Ho_Chi_Minh |
| sourceThreadId | Giữ nguyên thread của pipeline bản tin |
| checkedAt | ISO có múi giờ, mốc kiểm tra thực tế; không ở tương lai |
| coverageStart / coverageEnd | YYYY-MM-DD, phạm vi lịch theo ngày Việt Nam |
| events | Tối đa 200 sự kiện, id duy nhất |

Mỗi event:

- `id`: chữ thường, số và gạch nối, tối đa 120 ký tự; giữ ổn định qua cập nhật/đổi lịch.
- `title`, `period`: tên dễ hiểu và kỳ dữ liệu, không nhầm kỳ thống kê với ngày công bố.
- `country`, `currency`: mã quốc gia hai chữ, tiền tệ ba chữ.
- `scheduledAt`: ISO có múi giờ hoặc null; `scheduledDate` là ngày tương ứng tại Việt Nam. Nếu chưa rõ giờ nhưng đã xác minh ngày, để scheduledAt=null. `sourceTimezone` là múi giờ IANA, ví dụ America/New_York. Không cộng cố định 11 hoặc 12 giờ cho mọi ngày.
- `scheduleSource`: `{name, url}` của nguồn lịch chính thức; HTTPS, không credential.
- `status`: `scheduled`, `released` hoặc `postponed`. Đến giờ mà chưa có kết quả vẫn là scheduled. UI hiển thị “Đã đến giờ — chưa xác minh kết quả”.
- `impact`: `high`, `medium`, `low`; `impactReason` phải ghi rõ cơ sở đánh giá dưới nhãn Nhận định.
- `description`: giải thích chỉ tiêu; `analysis`: ba trường `mechanism`, `vietnam`, `conditions`, giải thích kênh tác động, liên hệ Việt Nam, rủi ro/điều kiện thay đổi nhận định.
- `metrics`: tối đa 12 chỉ tiêu; mỗi chỉ tiêu có `label`, `unit`, `basis`, `actual`, `forecast`, `previous`. basis phân biệt so tháng trước, so cùng kỳ, năm hóa và điều chỉnh mùa vụ. Không ghép số khác đơn vị/phương pháp.
- Mỗi giá trị actual/forecast/previous là null hoặc `{value, period, source: {name,url}, publishedAt}`. value là số hữu hạn hoặc chuỗi chính xác của nguồn (dùng chuỗi cho khoảng lãi suất). Actual và forecast phải đúng period của event. `previous.revisedFrom` giữ số cũ nếu có xác minh; không tự suy ra số sửa đổi. Giá trị 0 và số âm là dữ liệu hợp lệ.
- Forecast cần nguồn và mốc công bố **trước scheduledAt**; không lấy dự báo biết sau công bố. Thiếu nguồn/giờ thì để null. Actual và mọi giá trị không được có publishedAt sau checkedAt.
- Event released phải có `releasedAt`, `resultSource` và ít nhất một actual hoặc `outcome` có nội dung đã xác minh (dành cho thông cáo/họp báo). Không tự dùng thời điểm dự kiến làm releasedAt. Các trạng thái khác không được chứa kết quả.

Số chênh lệch actual − forecast chỉ tính khi cả hai là số cùng chỉ tiêu. Với đơn vị %, kết quả là điểm phần trăm. Không gán xanh/đỏ theo quan niệm cao hơn luôn tốt hoặc xấu.

## Lịch sử và giao diện

- “Lịch mới nhất” tải file lịch hiện hành và ghi mốc riêng.
- “Theo bản tin đang đọc” chỉ dùng `economic_calendar` trong chính archive đã chọn. Những bản tin trước khi có tính năng sẽ báo chưa lưu lịch; không ghép kết quả hiện tại vào quá khứ. Chế độ tổng hợp tuần không giả lập một bản tin riêng để gán mốc lịch.
- Chọn ngày, tuần thứ Hai–Chủ nhật hoặc 7 ngày tới; lọc quốc gia, mức theo dõi và tên/chỉ tiêu. Kết quả đã chọn vẫn có thể mở chi tiết với nguồn và điều kiện phân tích.
- Có loading, empty, lỗi, dữ liệu cũ và cảnh báo phạm vi chưa được bao phủ. Lỗi lịch không làm hỏng phần bản tin; làm mới lỗi giữ snapshot đã xác minh cùng mốc gốc.
- Lịch ngày có ký hiệu riêng cho bản tin và sự kiện. Phím mũi tên chuyển focus, Enter chọn ngày. Thu gọn và điều hướng sidebar hiện có được giữ lại.

## Kiểm tra

`npm run check` kiểm tra cú pháp, archive và lịch hiện hành. `npm test` chạy thêm `tests/economic-calendar.test.mjs`: nguồn/giờ, DST, ngày Việt Nam, thời điểm dự báo, dữ liệu tương lai, số 0/âm/sửa đổi, guard và writer hai chế độ. Các fixture dùng dữ liệu lịch sử có thật, các biến thể giả định chỉ nằm trong test cô lập.

Kiểm tra trình duyệt ở 320, 360, 390, 768, 1024, 1280 px gồm nội dung mở rộng, không tràn ngang, liên kết nguồn, bàn phím, bộ lọc, lỗi/tải/chưa có dữ liệu, lịch sử và tổng hợp tuần. Không cần thêm dependency để chạy ứng dụng; môi trường QA dùng Playwright sẵn có.
