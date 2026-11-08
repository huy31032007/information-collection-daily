# Bản tin kinh tế Việt Nam — hướng dẫn cho Claude Code

Website tĩnh trong `dist/` hiển thị bản tin kinh tế hằng ngày (chín mục, xuất bản tối 21:30 giờ Việt Nam). Không framework, không bước build, không backend. Deploy: push `main` → Cloudflare Workers Builds (`wrangler.json` phục vụ `dist/`).

## Lệnh

```bash
npm run preview      # http://127.0.0.1:4173 (tự lùi sang cổng trống nếu bận)
npm run verify       # check + test — chạy trước mọi commit
npm run preflight -- <bản-nháp.json>   # kiểm tra bản tin TRƯỚC khi xuất bản
npm run qa:browser   # Playwright 6 kích thước màn hình (cần preview đang chạy)
```

## Xuất bản một bản tin

1. Soạn bản tin theo `docs/financial-editorial-standard.md` và `docs/source-policy.md`. Giữ đủ chín mục `## 1.` … `## 9.`.
2. Lưu JSON nháp vào `.sites-runtime/` (đã ignore): `title, reportDate, cutoffAt, coverageStart, coverageEnd (= cutoffAt), timezone: "Asia/Ho_Chi_Minh", sourceThreadId, markdown`, tùy chọn `economic_calendar`.
3. `npm run preflight -- .sites-runtime/<file>.json`. Nếu thẻ ✗, thêm bảng theo `docs/dashboard-tables.md` **bằng dữ liệu thật đã có nguồn**; không bịa số.
4. `node scripts/write-newsletter.mjs < .sites-runtime/<file>.json` (writer tự ghi `exportedAt`, archive, index, latest một cách nguyên tử và có khóa).
5. `npm run verify`, chỉ stage các tệp dữ liệu writer tạo, commit `Publish evening newsletter for YYYY-MM-DD`, `git push origin HEAD:main`.
6. Đối chiếu URL thật: https://information-collection-daily.20-10-tctt67c.workers.dev/ (`data/latest.json` phải trùng local).

Chi tiết và các trường hợp lỗi: `PUBLISHING.md`.

## Quy tắc không được phá

- Không sửa/xóa bản tin đã lưu trong `dist/data/archive/` để "làm đẹp" dữ liệu; không dựng dữ liệu cho ngày thiếu.
- `reportDate` = ngày được tổng kết; `cutoffAt` = giờ chốt thật (có thể sang ngày sau với bản muộn).
- Dashboard chỉ đọc bảng Markdown, không đoán số từ văn xuôi. Giá luôn kèm nguồn và thời điểm.
- Mọi link ngoài: `target=_blank rel="noopener noreferrer"`; markdown được dựng bằng DOM API, không `innerHTML`.
- Không force-push, không đổi remote, không đưa token vào repo.

## Cấu trúc

- `dist/index.html` khung trang; `dist/app.mjs` trạng thái, điều hướng, tìm kiếm, phím tắt.
- `dist/lib.mjs` validate + parse; `dist/history.mjs` ngày/tuần/kho; `dist/dashboard.mjs` thẻ và biểu đồ (có `dashboardCoverage` dùng cho preflight).
- `dist/tokens.css` màu sáng/tối (chỉ dùng biến, không mã màu cứng trong component) → `styles.css` → `reading.css`.
- `scripts/write-newsletter.mjs` writer duy nhất được ghi dữ liệu. `tests/` dùng fixture ngày 12/10, không phụ thuộc `latest.json`.

## Giao diện

Theo checklist UI UX Pro Max: chữ ≥11px (nội dung ≥12px), vùng bấm ≥44px, focus ring rõ, tôn trọng `prefers-reduced-motion`, không icon emoji (dùng SVG nét 1.7), màu tăng/giảm luôn kèm ký hiệu ▲▼ và số. Kiểm tra cả sáng và tối, 375px và 1440px.
