# Xuất bản cùng bản tin hằng ngày

Đây là bước xuất bản sau quy trình tổng hợp hiện có, không phải quy trình thu thập tin mới. Không tạo thêm automation, API, database hoặc dùng OpenAI API key. Chỉ cập nhật nội dung bản tin, giữ giao diện và tính năng hiện tại.

## Danh tính và thư mục

- Site ID: `appgprj_6accb515f02c8191ba2fc9928624502b`.
- Workspace: `/Users/quanghuyvu/Documents/Workspace/Code/projects/information-collection`.
- Manifest: `.openai/hosting.json`; kiểm tra ID trùng trước mỗi lần ghi.
- Bản tin chuẩn: `dist/data/latest.json`.
- Helper Sites đã dùng: `/Users/quanghuyvu/.codex/plugins/cache/openai-curated-remote/sites/1.0.1/scripts/site-workflow.mjs`.
- Heartbeat: `b-n-tin-kinh-t-th-tr-ng-09-00-vi-t-nam`, giữ nguyên lịch và hướng dẫn tài chính gốc.

## Quy trình mỗi lượt chạy

1. Tạo bản tin theo đầy đủ hướng dẫn hiện tại. Dùng một bản nội dung chuẩn cho chat và web; giữ nguyên mọi nguồn, nhãn chắc chắn, đơn vị và thời điểm. Không bổ sung dữ liệu mẫu hoặc research mới riêng cho website. Có đủ chín mục, kể cả mục không có cập nhật.
2. Đọc skill Sites hiện có. Gọi native `get_site` với chính xác Site ID trên để kiểm tra quyền, trạng thái, audience và lấy URL thật. Không đổi audience. Lấy credential mới bằng `create_source_repository_write_credential` cho cùng Site, giữ credential trong bộ nhớ tác vụ. Không ghi, hiển thị hay thêm token vào prompt/file/environment/frontend.
3. Mở source qua `site-workflow.mjs --project-id <ID>` từ workspace, tty=true. Sau dòng `Ready for Site workflow JSON on stdin (input is hidden).`, gửi một JSON gồm credential bằng stdin; không truyền credential trong argv. Omit archivePath khi mở. Dùng nguyên `checkout_path` và kết quả source trả về.
4. Kiểm tra `git status --porcelain`. Nếu có thay đổi ngoài file bản tin dự kiến, dừng bước publish và báo rõ; helper stage toàn checkout nên không được lẫn công việc khác. Nếu repository/history không khớp hoặc push bị từ chối, giữ nội dung và commit; không force-push hoặc reset/xóa dữ liệu.
5. Chuẩn bị JSON đầu vào gồm: title, reportDate (YYYY-MM-DD), cutoffAt, coverageStart, coverageEnd, timezone=Asia/Ho_Chi_Minh, sourceThreadId và markdown nguyên văn. Các thời điểm ISO phải dựa trên bản tin/clock thật; coverageEnd=cutoffAt. Không biến thời điểm chạy writer thành thời điểm của giá. Truyền JSON qua stdin vào `node scripts/write-newsletter.mjs`, ví dụ dùng `exec_command(tty:true)` và `write_stdin`, hoặc file nội dung tạm trong `.sites-runtime/` đã được ignore. Writer kiểm tra bản cũ/xung đột, tự ghi exportedAt và thay file atomically. Không sửa dữ liệu qua phép ghép chuỗi shell hoặc command substitution.
6. Chạy `npm run check` và `npm test`. Khi chỉ nội dung thay đổi và checks pass, không cần cài dependency, build lại framework, sửa CSS hoặc chạy lại toàn bộ responsive suite.
7. Gọi lại source helper với cùng credential còn hiệu lực, nguyên kết quả source đã mở, commands=[] và archivePath tuyệt đối nằm trong `.sites-runtime/`. Helper commit/push bình thường, kiểm tra remote và đóng gói đúng commit. Nếu credential hết hạn, lấy lại credential cho cùng Site; không tạo Site mới.
8. Dùng nguyên project_id, commit_sha và archive từ helper cho native publish theo skill Sites. Với owner-private đã xác nhận, dùng `save_version_and_deploy_private` hoặc flow private tương đương có sẵn. Không lưu/deploy lần hai nếu có publication-on-push đã được chấp nhận; khi đó kiểm tra phiên bản/deployment tương ứng. Poll status chỉ khi pending/building/publishing.
9. Mở URL production thật và đọc `data/latest.json` qua quyền riêng tư được hỗ trợ. Nếu get_site trả service token, chỉ gửi nó trong header OAI-Sites-Authorization tới đúng Site origin; không đưa token vào URL hoặc áp dụng global header cho link báo bên ngoài. So sánh cutoffAt, reportDate và toàn văn markdown với bản chuẩn vừa tạo; kiểm tra trang tải bản tin. HTTP200 hoặc status deploy một mình chưa chứng minh nội dung mới hiển thị.
10. Đăng bản tin vào chat và ghi ngắn trạng thái web cùng URL literal đã xác minh. Nếu push/deploy/readback bị lỗi, nói rõ giai đoạn thất bại, vẫn đăng bản tin trong chat và giữ website đã xuất bản trước đó. Không báo cập nhật thành công khi chưa readback. Bản ghi cùng cutoff/nội dung có thể retry; bản cũ không được đè bản mới hơn.

## Giới hạn vận hành

Lịch là local và chỉ thực hiện khi môi trường chạy khả dụng. Lưu thành công hướng dẫn không bảo đảm lượt chạy tương lai. Đường xuất bản cần kiểm chứng thực tế; không chờ tới 09:00 hôm sau chỉ để kiểm tra bước ghi/publish/readback. Không dùng JavaScript polling trên trình duyệt thay cho lịch tạo và xuất bản bản tin.
