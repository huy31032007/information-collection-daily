# Bản tin kinh tế Việt Nam

Website tĩnh hiển thị nguyên văn bản tin từ cuộc trò chuyện ChatGPT hiện có. Không có API thu thập tin, database, model API, dependency ứng dụng hoặc nguồn dữ liệu thay thế. HTML/CSS/JavaScript được phục vụ từ `dist/`.

## Nội dung và trạng thái

- Nguồn duy nhất: bản tin đã tạo trong thread `01a12a08-5c54-7d82-90fd-f96fbbc539ff`.
- `dist/data/latest.json` giữ toàn văn Markdown, ngày bản tin, mốc chốt, khoảng tổng hợp và thời điểm xuất sang web. Giá/nguồn/thời điểm được giữ nguyên trong nội dung.
- Dashboard dùng bố cục thẻ và sidebar tham khảo [AdminCN](https://21st.dev/@clevision/templates/admincn-shadcn-admin-dashboard-template), được triển khai bằng HTML/CSS/JavaScript hiện có. Biểu đồ chỉ đọc phần trăm thay đổi có nguồn, thời điểm và mốc so sánh từ bảng trong bản tin; thiếu dữ liệu thì hiển thị trạng thái trống. Các thẻ vàng/dầu giữ loại giá và đơn vị, sơ đồ phân tích là khung tham khảo riêng.
- Lịch tháng mở bản tin theo ngày, có đánh dấu những ngày đã lưu. Kho nằm tại `dist/data/archive/YYYY-MM-DD.json`, danh sách ngày tại `dist/data/archive/index.json`. Mỗi ngày giữ phiên bản mới nhất đã xuất bản; ngày chưa có bản tin hiển thị trạng thái trống.
- Tổng hợp tuần tính theo ngày bản tin, thứ Hai–Chủ nhật ở Asia/Ho_Chi_Minh. Điểm nổi bật được trích từ mục tóm tắt hằng ngày; phân tích được nhóm theo chuyên mục với ngày, mốc chốt và nguồn gốc. Đây là tổng hợp từ các bản tin đã lưu, không phải một bài phân tích mới do model viết. Có số ngày đủ/thiếu và lỗi tải rõ ràng.
- Bộ lọc tìm kiếm giữ trọn chuyên mục khớp để không cắt mất điều kiện hoặc nguồn của nhận định. Bộ lọc áp dụng cho ngày đang đọc hoặc nội dung theo chủ đề trong tuần. URL giữ ngày/chế độ khi tải lại; làm mới nền không đổi ngày lịch sử đang chọn.
- Làm mới và kiểm tra mỗi 5 phút khi tab được mở chỉ đọc JSON đã xuất bản cùng hosting. Trình duyệt không đọc chat hoặc thu thập tin từ báo.
- Bản tin khác ngày Việt Nam được đánh dấu bản gần nhất. Tải lỗi giữ bản đang đọc và cảnh báo; không thay bằng dữ liệu mẫu.
- Lịch sử bắt đầu từ bản tin thật đang có ngày 12/10/2026. Không dựng lại dữ liệu của những ngày trước đó. Writer hiện có tự lưu ngày cũ và ngày mới trước khi cập nhật bản gần nhất; không cần database hay lịch tự động mới.
- Các nhãn tiếng Anh chỉ ánh xạ nhãn có sẵn trong bản gốc; không tự coi một chuyên mục chứa nhận định là Fact.

## Chạy và kiểm tra

```sh
cd "/Users/quanghuyvu/Documents/Workspace/Claude code/projects/information-collection"
npm run verify      # check + test
npm run preflight   # độ phủ dashboard của bản tin mới nhất (hoặc truyền đường dẫn bản nháp)
npm run preview     # http://127.0.0.1:4173
```

Preview chỉ bind loopback, ưu tiên cổng 4173 và tự lùi sang cổng trống nếu bận. GitHub Actions chạy `npm run verify` cho mỗi push/PR vào `main`. Hướng dẫn rút gọn cho Claude Code nằm ở `CLAUDE.md`. Chạy build riêng không cần thiết vì không có framework hoặc bước biên dịch.

Unit tests dùng bản tin thật ngày 12/10 làm fixture lịch sử riêng, không dùng giá hoặc ngày của `latest.json` làm giả định cố định. Fixture không nằm trong `dist/` và không được phục vụ trên web. `npm run check` kiểm tra bản tin thực tế sắp xuất bản.

## Cập nhật hằng ngày

Bộ prompt và schema cho module xử lý từng bài viết/tài liệu trong phiên bản mở rộng nằm tại [docs/intelligence-engine](docs/intelligence-engine/README.md). Bộ chuẩn này độc lập với định dạng bản tin chín mục và chưa được kết nối vào dashboard.

Dùng heartbeat hiện có `b-n-tin-kinh-t-th-tr-ng-09-00-vi-t-nam`, lúc 09:00 Asia/Ho_Chi_Minh. Máy/ứng dụng/mạng phải hoạt động. Quy trình nghiên cứu và phân tích gốc được giữ nguyên; chỉ thêm bước xuất cùng bản nội dung lên website. Xem `PUBLISHING.md`.

Site mặc định riêng tư và sử dụng đăng nhập ChatGPT. `.openai/hosting.json` ghi đúng ID/hosting; không có API key trong frontend. Token ghi repository chỉ giữ trong bộ nhớ tác vụ và truyền qua stdin ẩn của helper Sites. Không tự đổi quyền truy cập, repository hoặc domain.

## Lịch kinh tế quốc tế

Trong “Lịch bản tin & sự kiện”, chọn ngày hoặc tuần để xem đồng thời bản tin và các sự kiện CPI, PPI, Fed, GDP/PCE, việc làm. Lịch dùng giờ Việt Nam, có ngày/tuần, bộ lọc, nguồn và giải thích tác động; cập nhật cùng lượt tổng hợp 21:30. Xem [hợp đồng dữ liệu và quy trình](docs/economic-calendar.md). Không có kết nối tự động tới Forex Factory hoặc cập nhật kết quả trực tiếp theo giây.

## Giao diện và nhịp đọc

- Mở trang thấy ngay bốn thẻ thị trường; lịch thu gọn mặc định (nhớ lựa chọn trên từng trình duyệt), tự mở khi URL có `?date=` hoặc `view=week`.
- Nút ‹ › cạnh ngày bản tin chuyển giữa các ngày đã lưu (theo tuần khi xem tổng hợp tuần). Phím tắt: `/` tìm kiếm, `[` `]` bản trước/sau, ⌘/Ctrl+B thanh điều hướng.
- Tìm kiếm không cần dấu, đánh dấu kết quả; Enter (Shift+Enter) nhảy tới kết quả kế tiếp, Esc xóa.
- Thanh điều hướng tự đánh dấu mục đang đọc; nút lên đầu trang xuất hiện khi đọc sâu.
- Giao diện sáng/tối/tự động ở góc phải thanh trên cùng.
- Thẻ không đọc được bảng hiện "Chưa có số liệu dạng bảng" kèm link tới mục chứa số liệu (xem `docs/dashboard-tables.md`).
- Trạng thái đầu trang theo lịch xuất bản 21:30: trước giờ đó, bản tin hôm qua là bình thường (màu trung tính); chỉ cảnh báo khi bản tin cũ hơn một ngày.

- `dist/tokens.css`: màu của giao diện sáng, chữ, trạng thái tăng/giảm, khoảng cách và kích thước dòng đọc.
- `dist/styles.css`: các thành phần và bố cục responsive hiện có; renderer JavaScript tiếp tục dựng giao diện theo dữ liệu.
- `dist/reading.css`: chữ số thẳng cột, đoạn phân tích tối đa 70ch, giãn dòng 1.7 và chế độ giảm chuyển động. Bảng tài chính giữ độ rộng khả dụng.

Ba stylesheet được tải theo thứ tự trên. Màu xanh/đỏ có cả ký hiệu và số biến động; màu lịch chỉ phân loại bản tin/sự kiện. Dữ liệu, nguồn và mốc thời gian không bị thay đổi bởi giao diện.

## Quy chuẩn biên tập bản tin

[Hướng dẫn biên tập](docs/financial-editorial-standard.md) áp dụng vào lượt tổng hợp 21:30 hiện có: kết luận → bằng chứng → cơ chế → phản biện → theo dõi. Giữ chín mục và giải thích cho người mới học. Các ngưỡng kế toán trong tài liệu tham khảo không được dùng làm kết luận tự động về gian lận hay định giá. Thay đổi hướng dẫn không viết lại bản tin đã lưu hoặc tự thêm dữ liệu mới.

## Vai trò và chính sách nguồn

[Nguồn và giới hạn kiểm chứng](docs/source-policy.md) hướng dẫn chọn công bố gốc, bổ sung tiền tệ/trái phiếu, RSS phát hiện tin và các nguồn cần quyền truy cập. Trên web, nhãn nguồn cho biết loại đơn vị phát hành, không phải dấu xác thực. Mở “Vai trò của nguồn trong bản tin” ở mục 9 để đọc giải thích và truy cập từng nguồn đã dẫn. Không đổi schema hoặc dữ liệu bản tin cũ.
