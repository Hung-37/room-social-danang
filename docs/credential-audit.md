# Kiểm tra credential — 16/11/2026

Không ghi giá trị mật khẩu hoặc hash thật vào báo cáo này.

## Thay đổi

- `scripts/generate-admin-hash.mjs` đọc `ADMIN_PASSWORD`, báo lỗi khi thiếu và chỉ xuất `salt:hash` bằng scrypt, tương thích `lib/server/user-db.ts`. Không nhận mật khẩu qua đối số để tránh lưu trong lịch sử lệnh.
- `database/setup_admin.sql` chứa mật khẩu cũ và hash: giữ riêng, loại khỏi Git, Docker context và gói standalone.
- `database/setup_admin.example.sql` chỉ chứa mẫu có placeholder, câu SQL được comment để tránh thực thi nhầm.
- Thêm hai unit test: thiếu biến môi trường và kiểm tra hash/ngẫu nhiên/không in mật khẩu.

## Dấu vết

Tìm bằng cả tiền tố và toàn bộ mật khẩu với `git log --all -S` trả về 12 commit có thay đổi chuỗi. Quét mã nguồn (gồm docs, tests, fixtures và README) trước khi sửa tìm thấy chuỗi ở script, SQL riêng và `lib/server/admin-auth.ts`. Trong file auth, đây là credential development mặc định; production không dùng fallback này. Không sửa logic đăng nhập hoặc viết lại lịch sử Git.

Quét 43 file văn bản ứng viên sau khi sửa không thấy mật khẩu cũ, URL MySQL chứa credential, private key hoặc mẫu GitHub token được kiểm tra. Đây là kiểm tra theo mẫu, không phải bảo đảm phát hiện mọi loại secret. Các file admin đang sửa ngoài phạm vi không thuộc commit bảo mật này.

## Kiểm chứng

- `npm ci`: đạt sau khi dừng tiến trình Next.js local đang khóa SWC; audit 0 vulnerabilities.
- `npm run typecheck`: đạt.
- `npm run build`: đạt; xác nhận standalone không chứa `database/setup_admin.sql`.
- `npm test`: 73/73 đạt.
- `tests/browser/ui-redesign.cjs`: đạt 27 lượt mở trang, 9 bố cục giả lập trong bộ nhớ, 17 lượt axe và kiểm tra tương tác. Báo cáo local ở `work/security-ui-check/`, không đưa vào Git.
- Năm trang `/`, `/bang-tin`, `/thao-luan`, `/khu-vuc`, `/dang-nhap` ở 375px và 1280px: 10/10 response 200, không tràn ngang, không có `pageerror`. Có 20 console error trong phiên khách; probe riêng trang chủ xác nhận `/api/auth/me` và `/api/favorites` trả 401. Không tuyên bố console hoàn toàn sạch.
- `npm run test:pages`: chặn vì thiếu môi trường localhost và database kiểm thử cô lập.
- `npm run test:browser`: chặn vì thiếu URL và credential test của môi trường cô lập.
- Docker engine không khả dụng (`docker_engine` pipe không tồn tại), kể cả sau khi thử mở Docker Desktop. Không khởi tạo database thay thế hoặc dùng database thật để vượt qua điều kiện test.

Chưa đạt cổng kiểm tra để push/PR. Các phần B–D vẫn chờ theo yêu cầu thực hiện tuần tự; chưa chẩn đoán hay thay đổi Railway trong bước này.

## Nếu mật khẩu cũ đang dùng thật

Chủ dự án cần đổi mật khẩu vì chuỗi đã có trong lịch sử Git. Cập nhật `ADMIN_PASSWORD` trong biến môi trường Railway cho cơ chế đăng nhập admin bằng môi trường; cập nhật bản local tương ứng nếu có dùng. Với tài khoản đăng nhập qua bảng `users`, tạo hash mới bằng script và cập nhật đúng `users.password_hash` sau khi xác nhận tài khoản đích. Hai cơ chế đăng nhập này khác nhau; đổi một nơi không tự đổi nơi còn lại. Không tự chạy file SQL riêng hoặc init lại database production. Báo cáo này không khẳng định mật khẩu đang được dùng trên production.
