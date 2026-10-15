# Xuất bản bản tin qua GitHub và Cloudflare Workers

Đây là bước xuất bản sau quy trình tổng hợp hiện có, không phải quy trình thu thập tin mới. Không tạo thêm automation, API, database hoặc dùng OpenAI API key. Chỉ cập nhật nội dung bản tin, giữ giao diện và tính năng hiện tại.

## Đích xuất bản chính — GitHub và Cloudflare

Theo yêu cầu mới của người dùng, sau mỗi bản tin phải tự commit/push lên repository hiện có và cập nhật Cloudflare Workers. Lịch hiện tại là 21:30 giờ Việt Nam (Asia/Ho_Chi_Minh), thay cho lượt sáng. Giữ nguyên nội dung bản tin, giao diện và pipeline; writer hỗ trợ thêm lịch kinh tế tùy chọn theo `docs/economic-calendar.md`. Không tạo automation khác, API, database, nguồn thu thập tin, Worker hoặc domain mới.

Bản tin tối tổng kết thông tin từ 00:00 cùng ngày đến mốc chốt thực tế; ưu tiên chứng khoán Việt Nam sau đóng cửa và giá vàng cuối ngày hoặc báo giá gần nhất có đủ nguồn/thời điểm. Chỉ gọi là giá chốt khi nguồn xác nhận. Thị trường quốc tế có thể vẫn đang giao dịch lúc 21:30; phải ghi trạng thái và giờ dữ liệu. Lịch theo dõi ưu tiên tối còn lại và phiên kế tiếp. Không tạo thêm lượt sáng.

- Workspace: `/Users/quanghuyvu/Documents/Workspace/Claude Code/projects/information-collection` (macOS có thể trả tên thư mục `Claude code`).
- Repository: `https://github.com/huy31032007/information-collection-daily.git`; remote `origin`, nhánh đích `main`.
- Worker: `information-collection-daily`, do người dùng xác nhận bằng URL và ảnh dashboard.
- URL: `https://information-collection-daily.vuquanghuybill.workers.dev/`.
- `wrangler.json` chỉ phục vụ tệp tĩnh trong `dist/`. Không cần framework mới hoặc script backend.

Ảnh dashboard xác nhận Worker và liên kết repository; liên kết một mình chưa chứng minh tự động deploy đang hoạt động. Mỗi lượt phải kiểm tra URL thực tế. Không dùng helper Sites thay cho push `origin`; không tự publish thêm Sites trong lượt thường kỳ. Site cũ và `.openai/hosting.json` được giữ nguyên để bảo toàn website trước đây, không xóa hoặc đổi audience.

### Cấu hình Workers Builds cần kiểm chứng

Trong Worker, Settings > Builds cần dùng repository trên, production branch `main`, root là gốc repository và deploy command `npx wrangler deploy`. Website có sẵn trong `dist`, không có script `npm run build`. Build command có thể dùng `npm run check && npm test`. Quyền deploy nằm trong Git integration của Cloudflare; không đưa token vào Git, frontend, log, ảnh hoặc chat. Không tạo token hay sửa quyền tài khoản khi chưa được yêu cầu. Nếu thiếu quyền/cấu hình ngoài dự án, hỏi đúng thông tin còn thiếu.

Đã đối chiếu dashboard ngày 13/10/2026: repository đúng, production branch `main`, root `/`, deploy command `npx wrangler deploy`, build command để trống, Disable builds tắt và Include paths là `*`. Người dùng đã xác nhận cấp quyền repository bản tin cho GitHub App Cloudflare Workers and Pages; cảnh báo mất kết nối đã biến mất. Nếu cảnh báo này quay lại, kiểm tra danh sách repository được cấp quyền qua Manage; không tự mở rộng quyền ứng dụng. Vẫn phải đối chiếu bản tin trên URL thật sau mỗi lượt, vì cấu hình đúng chưa bảo đảm một lần deploy thành công.

Tài liệu: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [cấu hình build/deploy](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [tệp tĩnh](https://developers.cloudflare.com/workers/static-assets/binding/).

### Quy trình thường kỳ

Đọc [chính sách chọn nguồn](docs/source-policy.md) trong cùng lượt nghiên cứu: ưu tiên nguồn gốc theo thông tin cần xác minh, bổ sung tiền tệ/trái phiếu khi liên quan, dùng RSS hiện có để phát hiện link rồi mở bài gốc. Nhãn vai trò nguồn không thay kiểm chứng. Writer và dữ liệu xuất bản giữ nguyên.

Trước khi soạn bản tin, đọc [quy chuẩn biên tập](docs/financial-editorial-standard.md): kết luận trước, bằng chứng và mốc so sánh, cơ chế tác động, phản biện và tín hiệu theo dõi. Giữ chín mục, giải thích cho người mới học và mọi ràng buộc nguồn/thời điểm; không dùng ngưỡng dòng tiền như bằng chứng tự động về gian lận.

1. Tạo một bản tin chuẩn theo đầy đủ hướng dẫn nghiên cứu hiện tại; dùng nguyên văn cho chat và web, giữ chín mục, nguồn, đơn vị, thời điểm và nhãn chắc chắn. Không research thêm để tạo bản khác cho website.
2. Kiểm tra đúng workspace, `wrangler.json`, nhánh `main`, remote `origin` khớp repository trên và trạng thái Git. Không đoán endpoint/credential hoặc thay remote. Nếu có công việc ngoài phạm vi, bảo toàn và dừng bước commit/push để báo rõ; không stage lẫn.
3. Dùng `node scripts/write-newsletter.mjs` với JSON qua stdin gồm title, reportDate, cutoffAt, coverageStart, coverageEnd, timezone=Asia/Ho_Chi_Minh, sourceThreadId, markdown nguyên văn. Có thể dùng tệp tạm trong `.sites-runtime/` đã ignore. coverageEnd=cutoffAt. Nếu có lịch đã xác minh, thêm trường tùy chọn economic_calendar theo docs/economic-calendar.md; không gắn dữ liệu kiểm tra sau cutoffAt. Writer tự ghi exportedAt, giữ archive và cập nhật atomically, bảo vệ bản mới hơn. Không sửa/xóa tệp để vượt xung đột cùng mốc chốt.
4. Kiểm tra chỉ các tệp dữ liệu do writer tạo được thay đổi: latest.json, archive/index.json, archive ngày và economic-calendar.json nếu có cập nhật lịch. Giữ các ngày cũ, không dựng dữ liệu ngày thiếu. Chạy `npm run check` và `npm test`; khi chỉ dữ liệu đổi, không cài dependency hoặc chạy lại toàn bộ responsive suite.
5. Fetch `origin main`, xác minh nhánh remote là tổ tiên của HEAD. Nếu GitHub có lịch sử chưa có trong local, bảo toàn cả hai phía và báo cần xử lý; không force-push, reset hoặc xóa lịch sử. Chỉ stage dữ liệu writer tạo, kiểm tra staged diff và commit ghi ngày bản tin. Nếu đã commit thì dùng commit đó, không commit rỗng.
6. Push bằng `git push origin HEAD:main`, dùng xác thực Git đã có. Người dùng đã cho phép thao tác này sau mỗi bản tin; không xin lại xác nhận thường kỳ. Không tự tạo/lưu credential mới. Sau push, kiểm tra SHA refs/heads/main trên origin trùng HEAD.
7. Push sẽ kích hoạt Workers Builds nếu Git integration đã bật đúng. Theo dõi qua công cụ/dashboard hiện có khi truy cập được; chờ có giới hạn, giãn khoảng kiểm tra, không tạo automation giám sát. Pending/building không phải thành công. Không tự deploy sang tài khoản/Worker khác hoặc sửa quyền/cấu hình tài khoản để vượt lỗi.
8. Mở URL Cloudflare và đối chiếu data/latest.json, data/archive/index.json cùng archive vừa ghi: reportDate, cutoffAt và toàn văn markdown phải trùng local. Kiểm tra ngày mới, chọn ngày đúng và tổng hợp tuần thứ Hai–Chủ nhật giữ số ngày đã lưu/thiếu. Khi có lịch mới, đối chiếu data/economic-calendar.json cùng checkedAt, toàn bộ sự kiện và dữ liệu kết quả; kiểm tra sự kiện và bản tin cùng ngày trong lịch chung. Lịch theo bản tin cũ chỉ dùng snapshot lưu trong archive. HTTP 200 hoặc build thành công một mình chưa chứng minh nội dung mới đúng. Nếu HTTP bị chặn mà trình duyệt mở được, đọc/đối chiếu bằng trình duyệt; không tắt/bỏ qua bảo vệ truy cập.
9. Vẫn đăng bản tin vào chat nếu một bước lỗi. Báo đúng trạng thái commit/push/deploy/readback và URL thật. Nếu Cloudflare còn nội dung cũ, nói rõ chưa hoàn tất deploy; không tuyên bố đã cập nhật. Giữ dữ liệu để retry, không nghiên cứu lại hoặc đè bản mới hơn bằng bản cũ.

Lịch sử và tuần dùng writer/web hiện có; commit/push cả archive do writer tạo, không cần research hoặc automation riêng. Lịch vẫn local, chỉ chạy khi máy/mạng/ứng dụng khả dụng.

## Sites cũ — thông tin tham khảo

- Site ID: `appgprj_6accb515f02c8191ba2fc9928624502b`.
- Workspace: `/Users/quanghuyvu/Documents/Workspace/Claude Code/projects/information-collection`.
- Manifest: `.openai/hosting.json`; kiểm tra ID trùng trước mỗi lần ghi.
- Bản tin chuẩn: `dist/data/latest.json`.
- Kho ngày: `dist/data/archive/YYYY-MM-DD.json`; danh sách lịch: `dist/data/archive/index.json`. Writer hiện có tự giữ bản ngày trước và cập nhật bản mới nhất của từng ngày. Không xóa hoặc tự điền các ngày thiếu.
- Helper Sites đã dùng: `/Users/quanghuyvu/.codex/plugins/cache/openai-curated-remote/sites/1.0.1/scripts/site-workflow.mjs`.
- Heartbeat: `b-n-tin-kinh-t-th-tr-ng-09-00-vi-t-nam`, giữ nguyên lịch và hướng dẫn tài chính gốc.

## Quy trình Sites — chỉ dùng khi người dùng yêu cầu đồng bộ thêm

1. Tạo bản tin theo đầy đủ hướng dẫn hiện tại. Dùng một bản nội dung chuẩn cho chat và web; giữ nguyên mọi nguồn, nhãn chắc chắn, đơn vị và thời điểm. Không bổ sung dữ liệu mẫu hoặc research mới riêng cho website. Có đủ chín mục, kể cả mục không có cập nhật.
2. Đọc skill Sites hiện có. Gọi native `get_site` với chính xác Site ID trên để kiểm tra quyền, trạng thái, audience và lấy URL thật. Không đổi audience. Lấy credential mới bằng `create_source_repository_write_credential` cho cùng Site, giữ credential trong bộ nhớ tác vụ. Không ghi, hiển thị hay thêm token vào prompt/file/environment/frontend.
3. Mở source qua `site-workflow.mjs --project-id <ID>` từ workspace, tty=true. Sau dòng `Ready for Site workflow JSON on stdin (input is hidden).`, gửi một JSON gồm credential bằng stdin; không truyền credential trong argv. Omit archivePath khi mở. Dùng nguyên `checkout_path` và kết quả source trả về.
4. Kiểm tra `git status --porcelain`. Nếu có thay đổi ngoài file bản tin dự kiến, dừng bước publish và báo rõ; helper stage toàn checkout nên không được lẫn công việc khác. Nếu repository/history không khớp hoặc push bị từ chối, giữ nội dung và commit; không force-push hoặc reset/xóa dữ liệu.
5. Chuẩn bị JSON đầu vào gồm: title, reportDate (YYYY-MM-DD), cutoffAt, coverageStart, coverageEnd, timezone=Asia/Ho_Chi_Minh, sourceThreadId và markdown nguyên văn. Các thời điểm ISO phải dựa trên bản tin/clock thật; coverageEnd=cutoffAt. Không biến thời điểm chạy writer thành thời điểm của giá. Truyền JSON qua stdin vào `node scripts/write-newsletter.mjs`, ví dụ dùng `exec_command(tty:true)` và `write_stdin`, hoặc file nội dung tạm trong `.sites-runtime/` đã được ignore. Writer kiểm tra bản cũ/xung đột, tự ghi exportedAt, lưu ngày cũ/ngày mới vào archive và cập nhật index trước latest, với từng tệp ghi atomically. Lượt chạy có thể thay đổi latest.json, archive/index.json và các tệp archive ngày do chính writer tạo; kiểm tra diff chỉ chứa các tệp dữ liệu dự kiến, giữ toàn văn/mốc gốc, không xóa ngày cũ. Nếu writer gặp xung đột kho ngày, giữ dữ liệu và báo lỗi; không tự sửa/xóa bản cũ để vượt kiểm tra. Không sửa dữ liệu qua phép ghép chuỗi shell hoặc command substitution.
6. Chạy `npm run check` và `npm test`. Khi chỉ nội dung thay đổi và checks pass, không cần cài dependency, build lại framework, sửa CSS hoặc chạy lại toàn bộ responsive suite.
7. Gọi lại source helper với cùng credential còn hiệu lực, nguyên kết quả source đã mở, commands=[] và archivePath tuyệt đối nằm trong `.sites-runtime/`. Helper commit/push bình thường, kiểm tra remote và đóng gói đúng commit. Nếu credential hết hạn, lấy lại credential cho cùng Site; không tạo Site mới.
8. Dùng nguyên project_id, commit_sha và archive từ helper cho native publish theo skill Sites. Với owner-private đã xác nhận, dùng `save_version_and_deploy_private` hoặc flow private tương đương có sẵn. Không lưu/deploy lần hai nếu có publication-on-push đã được chấp nhận; khi đó kiểm tra phiên bản/deployment tương ứng. Poll status chỉ khi pending/building/publishing.
9. Mở URL production thật và đọc data/latest.json, data/archive/index.json cùng tệp archive của ngày vừa ghi qua quyền riêng tư được hỗ trợ. Nếu get_site trả service token, chỉ gửi nó trong header OAI-Sites-Authorization tới đúng Site origin; không đưa token vào URL hoặc áp dụng global header cho link báo bên ngoài. So sánh cutoffAt, reportDate và toàn văn markdown với bản chuẩn vừa tạo; kiểm tra lịch mở đúng ngày và tổng hợp tuần giữ phạm vi ngày có dữ liệu. HTTP200 hoặc status deploy một mình chưa chứng minh nội dung mới hiển thị. Web tự tổng hợp tuần từ các bản tin đã lưu; không tạo thêm một bản tin khác hoặc nghiên cứu lại để lấp ngày thiếu.
10. Đăng bản tin vào chat và ghi ngắn trạng thái web cùng URL literal đã xác minh. Nếu push/deploy/readback bị lỗi, nói rõ giai đoạn thất bại, vẫn đăng bản tin trong chat và giữ website đã xuất bản trước đó. Không báo cập nhật thành công khi chưa readback. Bản ghi cùng cutoff/nội dung có thể retry; bản cũ không được đè bản mới hơn.

## Giới hạn vận hành

Lịch là local và chỉ thực hiện khi môi trường chạy khả dụng. Lưu thành công hướng dẫn không bảo đảm lượt chạy tương lai. Đường xuất bản cần kiểm chứng thực tế; không chờ tới 21:30 lượt kế tiếp chỉ để kiểm tra bước ghi/publish/readback. Không dùng JavaScript polling trên trình duyệt thay cho lịch tạo và xuất bản bản tin.

## Lịch sự kiện kinh tế

Thực hiện [hợp đồng và quy trình lịch](docs/economic-calendar.md) trong cùng lượt tổng hợp 21:30. Không thêm automation, nguồn dự báo không có quyền sử dụng hoặc research bản tin khác riêng cho web. Lịch chính thức lấy BLS/Fed/BEA; Forex Factory chỉ có liên kết tham khảo khi chưa xác minh quyền tái xuất bản.
