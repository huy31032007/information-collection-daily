# Bảng số liệu cho dashboard

Bốn thẻ đầu trang (VN-Index, VN30, vàng miếng SJC, dầu Brent), biểu đồ % thay đổi và khối nhận định **chỉ đọc từ bảng Markdown** trong bản tin. Dashboard không đoán số từ văn xuôi: thiếu bảng thì thẻ hiện "Chưa có số liệu dạng bảng" và dẫn người đọc tới mục tương ứng.

Ngày 24/10 và 07/11/2026 viết số liệu bằng văn xuôi nên cả bốn thẻ trống. Chạy kiểm tra trước khi xuất bản để bắt lỗi này:

```bash
npm run preflight -- .sites-runtime/ban-tin-nhap.json
```

Lệnh in ✓/✗ cho từng thẻ và gợi ý bảng còn thiếu. Thêm `--strict` nếu muốn chặn xuất bản khi thẻ trống. Không bịa số để lấp bảng: nếu nguồn chưa xác minh, để trống là đúng.

Các mẫu dưới đây lấy từ bản tin 04/11/2026 (dữ liệu thật). Thay bằng số, giờ và nguồn của ngày đang viết.

## Mục 2 — chỉ số chứng khoán

Câu ngay trên bảng phải có cụm "so với …" (mốc so sánh). Cột Thay đổi ghi `điểm; %`. Thời điểm có giờ `HH:MM` và ngày `dd/mm`. Dòng `Nguồn:` nằm ngay sau bảng.

```markdown
Các mức sau là **kết phiên 04/11**, thay đổi so với đóng cửa **03/11/2026**.

| Chỉ số | Mức đóng cửa (điểm) | Thay đổi | Thời điểm |
| --- | ---: | --- | --- |
| VN-Index | 1.733,02 | +33,40 điểm; +1,97% | Kết phiên 04/11/2026; bản tin 16:48 |
| VN30 | 1.862,07 | +46,47 điểm; +2,56% | Kết phiên 04/11/2026; bản tin 16:48 |

Nguồn: [điểm tin HOSE](https://…); [BSC](https://…).
```

Khối nhận định lấy đoạn đầu tiên của mục 2 bắt đầu bằng `**Nhận định:**`.

## Mục 3 — vàng miếng SJC

Bảng cần cột `Mua vào`, `Bán ra`, `Thời điểm` và một dòng bắt đầu bằng "Vàng miếng SJC". Giá có đơn vị `triệu đồng/lượng` (hoặc `đồng/lượng`).

```markdown
| Sản phẩm tại DOJI | Mua vào | Bán ra | Thời điểm |
| --- | ---: | ---: | --- |
| Vàng miếng SJC | 139,4 triệu đồng/lượng | 142,4 triệu đồng/lượng | 22:54 ngày 04/11/2026, UTC+7 |

Nguồn: [bảng giá DOJI](https://banggia.doji.vn/gold-price).
```

## Mục 4 — dầu Brent

Cột đầu là `Giá dầu tham chiếu`, có **đúng một** dòng Brent. Đoạn ngay trên bảng nêu giờ và ngày của giá.

```markdown
**Dầu quốc tế lúc 22:24 ngày 04/11/2026 (15:24 UTC), còn trong phiên.**

| Giá dầu tham chiếu | Giá | Thay đổi so phiên 03/11 |
| --- | ---: | --- |
| Brent giao tháng 01/2027 | 101,16 USD/thùng | −2,44 USD/thùng; −2,36% |
| WTI giao tháng 12/2026 | 93,82 USD/thùng | −2,27 USD/thùng; −2,36% |

Nguồn: [tên nguồn](https://…).
```

Bảng giá xăng dầu bán lẻ trong nước vẫn giữ bình thường; nó không thay bảng dầu tham chiếu.
