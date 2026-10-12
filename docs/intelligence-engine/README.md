# Module xử lý từng tài liệu — bộ chuẩn v1

Phạm vi đã chọn: dùng prompt cho từng bài viết/tài liệu riêng trong phiên bản mở rộng. Bộ chuẩn này chưa được kết nối với dashboard hoặc lịch bản tin 09:00. Không có API gọi model, kho tài liệu, vector database, chatbot hoặc nguồn thu thập mới trong thay đổi này. `dist/data/latest.json`, schema bản tin chín mục và quy trình xuất bản bản tin giữ nguyên.

## Tệp sử dụng

- `SYSTEM_PROMPT.md`: hướng dẫn xử lý một tài liệu mỗi lượt.
- `article-output.schema.json`: JSON Schema Draft 7 cho đầu ra tài liệu, version `1.0.0`; không phải schema của bản tin hiện có.

## Cách dùng trong hội thoại

1. Cung cấp prompt và schema cho model dùng cùng nhau. Nếu giao diện chỉ có ô chat thông thường, dán chúng như hướng dẫn tác vụ; việc này không thay đổi system prompt của nền tảng.
2. Gửi nội dung bài viết/tài liệu thực tế. Kèm URL/nguồn, ngày công bố/truy cập đã biết, phạm vi đầy đủ hay trích đoạn; không cần tự điền giá trị chưa biết. URL đơn lẻ không chứng minh model đã đọc bài.
3. Có thể cung cấp mã nội dung gốc, tài liệu cũ cho phép đối chiếu và thời gian đọc đã tính. Nếu chưa có, các trường tương ứng là `null` hoặc `[]`.
4. Yêu cầu một đối tượng JSON theo schema. Đọc nhãn kiểm chứng và các giới hạn cùng với tóm tắt; nguồn đã nêu không đồng nghĩa được kiểm chứng độc lập.
5. Kiểm tra cú pháp và schema bằng validator phù hợp trước khi dùng đầu ra trong ứng dụng. Sau đó kiểm tra source ID, URL an toàn, thời gian, đơn vị, bằng chứng và ý nghĩa. Validator cấu trúc không xác nhận tính đúng của dữ liệu.

## Khác với mẫu ban đầu

- Thêm provenance, trạng thái đủ/thiếu đầu vào, nhãn từng claim, giới hạn và dữ liệu tài chính có mốc thời gian.
- Giữ các nhóm `meta`, `executive_summary`, `knowledge_extraction`, `rag_index_helper`; thêm `deep_dive` và version. `key_insights`/`actionable_takeaways` trở thành đối tượng có bằng chứng, không còn là chuỗi đơn thuần.
- `confidence_score=null` trong v1; sử dụng mức độ chắc chắn và lý do, tránh điểm số tự gán. Thời gian đọc chưa tính cũng là `null`.
- Các lựa chọn được định nghĩa bằng enum trong schema, thay biểu thức `"Evergreen" | "News/Temporal"` không hợp lệ trong một đối tượng JSON.
- Nguyên văn được tham chiếu bằng `original_content_ref` nếu được đầu vào cung cấp. Bản phân tích do model viết không được giả làm nguyên văn đã làm sạch.
- Bước áp dụng trong tài chính là theo dõi/kiểm chứng/học, giữ giới hạn lời khuyên chứng khoán đã đặt ra.

## Ánh xạ giao diện dự kiến

| Nội dung | Trường | Cách hiển thị |
|---|---|---|
| Thẻ tài liệu | meta.title_refined, executive_summary.tldr | Tiêu đề, tóm tắt và loại nội dung |
| Điểm chính | executive_summary.key_insights[].text | Luôn kèm label, verification và nguồn |
| Bước áp dụng | knowledge_extraction.actionable_takeaways[].text | Có thể làm checklist cá nhân; chưa triển khai lưu trạng thái |
| Đọc sâu | deep_dive.analysis, deep_dive.original_content_ref | Phân tích và đường mở nội dung gốc thật |
| Giải thích thuật ngữ | knowledge_extraction.mental_models_or_concepts | Định nghĩa, ví dụ, ý nghĩa và giới hạn |
| Giá/chỉ số | knowledge_extraction.financial_observations | Loại giá, đơn vị, ngày giờ và mốc so sánh |
| Gợi ý câu hỏi | rag_index_helper.suggested_query_prompts | Chỉ là metadata; chưa có tìm kiếm ngữ nghĩa/RAG |

Không dùng trường `null` như chuỗi trống, số 0 hoặc giá hiện tại. Các source ID và content ref phải được kiểm tra với dữ liệu thực tế được cung cấp. Chưa có kho lịch sử thì không hiển thị liên kết tài liệu cũ tự tạo.

## Tích hợp về sau

Chưa chọn nhà cung cấp model, hình thức lưu lịch sử hoặc backend. Các lựa chọn có ảnh hưởng tới chi phí, dữ liệu gửi ra ngoài và quyền truy cập cần được xác định trước khi kết nối. Khi tích hợp streaming, chỉ công bố/lưu kết quả chuẩn sau khi JSON hoàn chỉnh và đã kiểm tra; bản xem trước phải được đánh dấu tạm thời. Tách hai lần sinh kết quả không tự bảo đảm chúng nhất quán.

## Nguồn quy tắc schema

- [JSON Schema: object, required và additionalProperties](https://json-schema.org/understanding-json-schema/reference/object).
- [JSON Schema: conditional validation](https://json-schema.org/understanding-json-schema/reference/conditionals).

Schema tài liệu đã được đọc bằng JSON.parse và rà soát trường/ref. Môi trường hiện chưa có validator JSON Schema đầy đủ; chưa chạy kiểm tra conformance bằng validator, cũng chưa thử đầu ra LLM trên bài viết/tài liệu thật. Bộ chuẩn và prompt không tự chứng minh độ chính xác của các đầu ra tương lai.
