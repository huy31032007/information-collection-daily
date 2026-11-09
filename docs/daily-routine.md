# Quy trình chạy hằng ngày 21:30 (lịch Claude trên cloud)

Tài liệu này là chỉ dẫn đầy đủ cho lượt chạy tự động mỗi tối. Lượt chạy bắt đầu từ một bản clone sạch của repo, không có trí nhớ từ lượt trước. Làm tuần tự; nếu một bước bị chặn, vẫn hoàn tất những gì an toàn và báo đúng bước lỗi.

## Không bao giờ

- Bịa số liệu, giá, sự kiện, thời điểm hoặc link. Không xác minh được thì ghi "Chưa xác minh".
- Sửa, xóa hoặc viết lại bản tin đã lưu; sửa code/giao diện; đổi remote; force-push; reset lịch sử.
- Đưa khuyến nghị mua/bán, mục tiêu giá hoặc tỷ trọng danh mục.

## 0. Chuẩn bị

```bash
node --version            # cần Node 20+
npm ci
TZ=Asia/Ho_Chi_Minh date '+%Y-%m-%d %H:%M:%S %z'
git fetch origin main && git status --short
```

Xác định `reportDate` (ngày được tổng kết) theo giờ Việt Nam: chạy từ 12:00 đến 23:59 → hôm nay; chạy từ 00:00 đến 05:59 (lượt bị trễ) → hôm qua, theo quy tắc bản muộn (coverageStart 00:00 ngày bản tin, cutoffAt là giờ thật của ngày kế tiếp).

Nếu `dist/data/archive/<reportDate>.json` đã tồn tại và không phải bản làm bù, bỏ qua bước 1–4 cho ngày đó (đã có bản tin), chuyển sang bước 5 (bù ngày thiếu).

## 1. Nghiên cứu và soạn

Đọc theo thứ tự rồi áp dụng:

1. `docs/editorial-brief.md` — chín mục, độ sâu, nhãn chắc chắn, giải thích cho người mới học.
2. `docs/analysis-framework.md` — mỗi mục 1–8 mở bằng `**Ý chính:**`, tiểu mục `###`, kết bằng `**Theo dõi tiếp:**`; bộ công cụ phân tích từng mục; kiểm soát chất lượng nội bộ.
3. `docs/financial-editorial-standard.md`, `docs/source-policy.md`.
4. `docs/dashboard-tables.md` — bảng bắt buộc cho thẻ VN-Index, VN30, vàng SJC, Brent.
5. `docs/economic-calendar.md` — trường `economic_calendar` tùy chọn.
6. Bản tin gần nhất trong `dist/data/latest.json` chỉ để lấy mốc so sánh (giá đóng cửa phiên trước, kỳ điều hành xăng dầu), không dùng làm dữ liệu hôm nay.

Dùng WebSearch để tìm và WebFetch để mở trang nguồn. Mỗi giá/chỉ số phải đến từ trang đã mở, có đơn vị, ngày giờ, mốc so sánh.

## 2. Ghi bản nháp

Tạo `.sites-runtime/report-<reportDate>.json` bằng một script node nhỏ (`JSON.stringify`, tránh lỗi escape) với các khóa:

| Khóa | Giá trị |
| --- | --- |
| `title` | `Bản tin kinh tế và thị trường — dd/mm/yyyy` |
| `reportDate` | `YYYY-MM-DD` |
| `coverageStart` | `YYYY-MM-DDT00:00:00+07:00` |
| `cutoffAt`, `coverageEnd` | giống nhau, giờ chốt thật `YYYY-MM-DDTHH:MM:SS+07:00` |
| `timezone` | `Asia/Ho_Chi_Minh` |
| `sourceThreadId` | `01a12a08-5c54-7d82-90fd-f96fbbc539ff` (mã quy trình, bắt buộc giữ nguyên) |
| `markdown` | toàn văn: `# …`, đoạn mở đầu in đậm ghi giờ chốt và khoảng tổng hợp, rồi `## 1. Tóm tắt nhanh` … `## 9. Nguồn` |
| `economic_calendar` | tùy chọn, theo `docs/economic-calendar.md`; `checkedAt` không vượt `cutoffAt` |

## 3. Kiểm tra trước khi ghi

```bash
npm run preflight -- .sites-runtime/report-<reportDate>.json
```

- Phải "✓ Hợp lệ". Thẻ ✗ mà dữ liệu đã xác minh có trong bài → bổ sung bảng theo `docs/dashboard-tables.md`. Thiếu dữ liệu thật → để ✗, không bịa.
- Thực hiện bảng kiểm soát ở `docs/analysis-framework.md` mục 3: mở lại link của mọi giá/chỉ số, tính lại mọi %, chọn thêm 3 nhận định để đối chiếu. Sửa trước khi ghi.

## 4. Ghi dữ liệu

```bash
npm run write --silent < .sites-runtime/report-<reportDate>.json
```

Lệnh chạy writer (ghi archive, index, latest một cách nguyên tử) rồi dựng lại `dist/data/market-series.json` cho biểu đồ. Nếu writer báo xung đột (cùng mốc chốt khác nội dung, bản mới hơn đã có), dừng và báo; không sửa tệp để vượt kiểm tra.

## 5. Bù ngày thiếu

Liệt kê các ngày từ 7 ngày trước `reportDate` đến hôm qua không có tệp trong `dist/data/archive/` (chỉ tính từ 12/10/2026 trở đi). Bù tối đa 2 ngày mỗi lượt, cũ nhất trước:

- Nghiên cứu như bước 1 nhưng cho ngày đó; thông tin công bố sau ngày đó phải ghi rõ là thông tin muộn hơn, kèm ngày công bố.
- JSON thêm `"edition": "backfill"`; `title` kết thúc bằng ` (làm bù)`; `coverageStart` là 00:00 ngày đó; `cutoffAt` = `coverageEnd` = giờ thật lúc hoàn tất (sau ngày đó). Đoạn mở đầu nói rõ đây là bản làm bù và giờ soạn thật.
- Đối chiếu chéo với bản tin ngày trước và sau đã lưu (ví dụ: đóng cửa hôm trước + thay đổi phải khớp đóng cửa hôm sau).
- Preflight và kiểm soát như bước 3, rồi `npm run write --silent < tệp`. Writer giữ nguyên `latest.json` khi bản bù cũ hơn bản mới nhất.

## 6. Kiểm tra toàn bộ

```bash
npm run verify
```

Phải đạt. Lỗi do code (không phải dữ liệu) → không sửa code; dừng commit và báo.

## 7. Commit và push

```bash
git add dist/data/latest.json dist/data/archive/ dist/data/market-series.json
git add dist/data/economic-calendar.json   # chỉ khi writer đã cập nhật
git status --short                          # chỉ được có tệp dữ liệu
git commit -m "Publish evening newsletter for YYYY-MM-DD"   # thêm "and backfill DD/MM" nếu có
git fetch origin main
git merge-base --is-ancestor origin/main HEAD || git pull --rebase origin main
git push origin HEAD:main
git ls-remote origin refs/heads/main        # phải trùng git rev-parse HEAD
```

Nếu rebase xung đột hoặc push bị từ chối: không force; báo rõ và dừng.

## 8. Đối chiếu website

Cloudflare tự deploy sau push (thường dưới 1 phút). Kiểm tra tối đa khoảng 6 phút, giãn 30 giây mỗi lần:

- `https://information-collection-daily.20-10-tctt67c.workers.dev/data/latest.json` có `reportDate` và `cutoffAt` trùng bản vừa ghi (dùng `curl`; nếu mạng chặn thì WebFetch).
- `.../data/archive/index.json` có các ngày vừa ghi.

HTTP 200 một mình chưa đủ; phải trùng nội dung.

## 9. Báo cáo cuối lượt

Viết ngắn bằng tiếng Việt: ngày bản tin, giờ chốt, 3–5 ý chính, thẻ dashboard ✓/✗, ngày đã bù, SHA commit, trạng thái deploy, những gì chưa xác minh hoặc bị chặn.
