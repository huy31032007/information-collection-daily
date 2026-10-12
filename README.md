# Bản tin kinh tế Việt Nam

Website tĩnh hiển thị nguyên văn bản tin từ cuộc trò chuyện ChatGPT hiện có. Không có API thu thập tin, database, model API, dependency ứng dụng hoặc nguồn dữ liệu thay thế. HTML/CSS/JavaScript được phục vụ từ `dist/`.

## Nội dung và trạng thái

- Nguồn duy nhất: bản tin đã tạo trong thread `01a12a08-5c54-7d82-90fd-f96fbbc539ff`.
- `dist/data/latest.json` giữ toàn văn Markdown, ngày bản tin, mốc chốt, khoảng tổng hợp và thời điểm xuất sang web. Giá/nguồn/thời điểm được giữ nguyên trong nội dung.
- Bộ lọc tìm kiếm giữ trọn chuyên mục khớp để không cắt mất điều kiện hoặc nguồn của nhận định. Chỉ có bản gần nhất; bộ lọc thời gian không phải kho lịch sử.
- Làm mới và kiểm tra mỗi 5 phút khi tab được mở chỉ đọc JSON đã xuất bản cùng hosting. Trình duyệt không đọc chat hoặc thu thập tin từ báo.
- Bản tin khác ngày Việt Nam được đánh dấu bản gần nhất. Tải lỗi giữ bản đang đọc và cảnh báo; không thay bằng dữ liệu mẫu.
- Các nhãn tiếng Anh chỉ ánh xạ nhãn có sẵn trong bản gốc; không tự coi một chuyên mục chứa nhận định là Fact.

## Chạy và kiểm tra

```sh
cd "/Users/quanghuyvu/Documents/Workspace/Claude Code/projects/information-collection"
npm run check
npm test
npm run preview
```

Lệnh preview in URL local thực tế, sử dụng cổng khả dụng và chỉ bind loopback. Chạy build riêng không cần thiết vì không có framework hoặc bước biên dịch.

Unit tests dùng bản tin thật ngày 12/10 làm fixture lịch sử riêng, không dùng giá hoặc ngày của `latest.json` làm giả định cố định. Fixture không nằm trong `dist/` và không được phục vụ trên web. `npm run check` kiểm tra bản tin thực tế sắp xuất bản.

## Cập nhật hằng ngày

Dùng heartbeat hiện có `b-n-tin-kinh-t-th-tr-ng-09-00-vi-t-nam`, lúc 09:00 Asia/Ho_Chi_Minh. Máy/ứng dụng/mạng phải hoạt động. Quy trình nghiên cứu và phân tích gốc được giữ nguyên; chỉ thêm bước xuất cùng bản nội dung lên website. Xem `PUBLISHING.md`.

Site mặc định riêng tư và sử dụng đăng nhập ChatGPT. `.openai/hosting.json` ghi đúng ID/hosting; không có API key trong frontend. Token ghi repository chỉ giữ trong bộ nhớ tác vụ và truyền qua stdin ẩn của helper Sites. Không tự đổi quyền truy cập, repository hoặc domain.
