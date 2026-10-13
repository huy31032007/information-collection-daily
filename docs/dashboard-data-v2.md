# Dữ liệu dashboard v2

Các trường bản tin chín mục, nội dung Markdown và lịch sử ngày giữ nguyên.
Bước bổ sung xuất thêm meta, market_snapshot, academic_feed, source_status
và feed_cache. Các bản tin cũ tiếp tục dùng renderer hiện có.

## Chạy với bản tin mới của pipeline hiện tại

Từ thư mục dự án, truyền JSON bản tin mới qua stdin:

```bash
npm run publish:newsletter --silent < /duong/dan/ban-tin-moi.json
```

Đường dẫn trên là ví dụ, cần thay bằng file thật của pipeline.
Lệnh này chuẩn hóa dữ liệu và đọc RSS trước khi dùng writer hiện có.
Nó không tạo lịch hoặc tự nghiên cứu lại bản tin chín mục.
Lệnh node scripts/write-newsletter.mjs vẫn nhận schema bản tin cũ.
Chưa thay lịch Codex hoặc tự bật bước RSS trong automation.

Script bổ sung chỉ nhận mốc chốt mới hơn latest và archive. Writer có khóa
giữa các tiến trình; dữ liệu v2 khác nhau ở cùng mốc chốt được coi là xung đột.
Không đổi ngày/mốc chốt để vượt kiểm tra. Không ghi đè latest.json bằng shell redirect.

## Giá và thời gian

Bốn thẻ là VN-Index, VN30, vàng miếng SJC và dầu Brent.
Chuẩn hóa số từ bản tin, giữ nguồn, sản phẩm/khu vực, lời ghi thời điểm và
số chữ số thập phân gốc. updated_at để null khi chưa có thời điểm đầy đủ.
generated_at là thời điểm xử lý, không thay thời điểm báo giá.

Khi không xác minh được SJC trong bản tin mới, lấy báo giá dùng được gần nhất
trong kho, giữ nguyên địa điểm, đơn vị và nguồn; đánh dấu last_known/is_stale.
Không có dữ liệu dự phòng thì unavailable và giá null. Không tự điền 0%.
Nguồn giá SJC trực tiếp chưa kết nối; không có parser đoán định dạng XML.

## RSS và liên hệ môn học

- VnEconomy: https://vneconomy.vn/tai-chinh.rss
- Báo Chính phủ: https://baochinhphu.vn/home.rss

Đọc tối đa 50 mục/nguồn, timeout 10 giây, cache thành công 15 phút.
Cache cũ chỉ bổ sung tin nằm trong khoảng tổng hợp của bản tin mới.
Thiếu múi giờ, ngày không hợp lệ hoặc thời điểm ngoài khoảng thì bỏ qua.
Lỗi HTTP/XML giữ cache đã kiểm tra và hiển thị cảnh báo nguồn.
Không đọc toàn văn bài báo, không vượt kiểm soát truy cập, không thêm API key.

Danh sách tối đa 30 tin, loại liên kết trùng, chỉ nhận HTTPS đúng miền nguồn.
Tiêu đề/tóm tắt lấy từ RSS; chưa xác minh toàn văn nên giữ nhãn Unverified.
Liên hệ môn học là gợi ý theo từ khóa, nhãn Analysis, không phải phân tích
chuyên sâu hoặc bài nghiên cứu học thuật đã được phản biện.

Điều khoản RSS VnEconomy: https://vneconomy.vn/rss.html
Thư viện parser: https://github.com/rbren/rss-parser
