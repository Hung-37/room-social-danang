# Rà soát giao diện — redesign-ui

## Trước khi sửa (16/11/2026)

Đã mở bằng Edge tại 375, 768 và 1280px: trang chủ, bảng tin, tìm kiếm,
chi tiết, quản lý phòng, lịch xem phòng, thông báo, hồ sơ và admin.
Ảnh tại `screenshots/before/` (375 và 1280px).

- Trang chủ: phần giới thiệu gần hết màn hình điện thoại, thiếu tìm kiếm trực tiếp;
  nhiều CTA lặp lại. Các tuyên bố “100%”, “uy tín” và “hàng ngàn” thiếu căn cứ.
- Header: menu và đăng nhập không hiện ở ảnh mobile; cần kiểm tra CSS ẩn nút.
- Bộ lọc: nhãn nhỏ, bố cục dày; hướng dẫn dài cạnh danh sách.
- Card: nguồn/thời gian/nút lưu nhỏ; nhãn tham khảo dài cần xuống dòng;
  giá/khu vực cần rõ hơn. Chưa kiểm tra card có dữ liệu thật do DB lỗi.
- CSS: nhiều giá trị xanh lá/kem và cỡ chữ 10–13px rải trong các file tính năng.
- Lịch hẹn: xác nhận hủy dùng nút chính xanh và nhãn chung “Đồng ý cập nhật”.
- Thông báo trên header: chưa có khóa pending và thông báo thành công tại chỗ.
- Các trang khách không tràn ngang ở ba độ rộng đã đo.

## Giới hạn môi trường

MySQL `127.0.0.1:3306`, database `room_social`: `ECONNREFUSED`.
Ảnh detail là lỗi kết nối; management/appointments/notifications/profile là
trạng thái khách. `/admin` chuyển về trang chủ, không phải ảnh dashboard admin.
Không kết luận các trang có dữ liệu hoặc phân quyền đã được kiểm tra end-to-end.
Không khởi tạo database hoặc ghi dữ liệu mẫu.
Docker CLI có sẵn nhưng engine không chạy (`docker_engine` named pipe không
tồn tại), nên chưa có môi trường QA Docker sẵn dùng để chạy test nghiệp vụ.

## Sau khi sửa

- Bảng màu teal/biển, nền trắng, viền và bóng nhẹ; chỉnh ngay các file CSS hiện có.
  Nâng cỡ chữ nhỏ lên 14px; sửa độ tương phản tên trường được axe phát hiện.
- Trang chủ có tìm kiếm theo từ khóa/khu vực, giữ tiếng Việt trong URL; bỏ
  khối quảng bá lặp lại. Menu mobile có biểu tượng và vùng chạm 44px.
- Thẻ phòng ưu tiên giá/khu vực, nguồn và thời gian vẫn hiện; nội dung tóm tắt
  dài nằm ở chi tiết. Nhãn tham khảo xuống dòng và dùng nền cảnh báo.
- Lưu tin có chữ “Đã lưu”, spinner khi chờ và khóa nút; lỗi giữ trạng thái đã
  xác nhận. Toast có live region. Bình luận, đăng tin, xóa tin, lịch và thông
  báo được bổ sung aria-busy; duyệt tin/bài/báo cáo có khóa pending.
- Xác nhận lịch nêu tên phòng và thời gian, nút hủy màu đỏ. Hộp xóa tin admin
  chuyển về nền sáng. Giữ xác nhận native hiện có cho xóa bình luận/thông báo;
  chưa thay toàn bộ xác nhận native bằng modal tùy chỉnh.
- Giữ cảnh báo chưa xác minh, điều kiện công khai, API và schema.
- Thêm favicon SVG; sửa đích skip-link trang chủ. Giữ 404/error/skeleton hiện
  có, điều chỉnh trình bày và tôn trọng reduced motion. Không thêm font mạng.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt |
| `npm test` | 71/71 đạt |
| `npm run build` | Đạt; gói standalone tạo thành công |
| `npm run lint` | Không có script lint trong package.json |
| `npm run doctor` | Dependency và cấu hình đạt; kết nối database thất bại |
| `npm run test:pages` | Dừng ở guard: thiếu cấu hình database QA tách biệt |
| `npm run test:browser` | Dừng ở guard: thiếu URL và tài khoản admin QA |
| `npm run test:viewings:browser` | Dừng ở guard: thiếu fixture QA |
| `node tests/browser/ui-redesign.cjs` | 27 lượt mở trang thật, 9 bố cục fixture, 17 axe scan A/AA; không tràn ngang hoặc lỗi JavaScript |

UI fixture kiểm tra pending/success/error của lưu tin, bình luận lỗi giữ nội
dung rồi thử lại thành công, hủy lịch có xác nhận đúng đối tượng, đánh dấu thông
báo đã đọc, tìm kiếm tiếng Việt và reduced motion. Báo cáo máy tại
`screenshots/after/ui-report.json`. Ảnh sau được chụp trên bản standalone local.
Đây không phải kiểm thử backend hoặc bằng chứng MySQL đã hoạt động.

Chưa xác minh end-to-end: đăng/sửa/xóa phòng thật, phân quyền admin/chủ trọ,
duyệt thật và toàn bộ trang sau đăng nhập với dữ liệu thật. Không có ảnh
dashboard admin hoặc card có dữ liệu thật trước khi sửa vì môi trường bị chặn.

## Selector và file

Giữ nguyên id, role, data-testid và aria-label sẵn có. Đổi tên hiển thị của nút
“Đồng ý cập nhật” thành động từ theo thao tác: “Xác nhận lịch hẹn”, “Hủy lịch xem
phòng”, “Từ chối lịch hẹn”, “Đánh dấu đã xem”. Cập nhật hai selector theo tên nút
trong `tests/browser/viewings.cjs`. Thêm id `main-content` cho trang chủ.

Các file của lượt thiết kế:

- `app/globals.css`; `app/styles/tokens.css`, `experience.css`, `redesign.css`,
  `management.css`, `appointments.css`, `admin-controls.css`, `room-photos.css`,
  `admin.css`.
- `components/SocialHome.tsx`, `FeedExplorer.tsx`, `PostCard.tsx`, `Header.tsx`,
  `Appointments.tsx`, `CommentThread.tsx`, `DeleteRejectedListing.tsx`, `Toast.tsx`.
- `app/bai/[id]/PostDetailClient.tsx`, `app/dang-phong/LandlordListingForm.tsx`,
  `app/thong-bao/Notifications.tsx`, `app/admin/AdminCollectorClient.tsx`, `app/icon.svg`.
- `tests/browser/ui-redesign.cjs`, `tests/browser/viewings.cjs`.
- `README.md`, `docs/ui-review.md`, `docs/screenshots/before/`, `docs/screenshots/after/`.

Commit `92cb567` giữ riêng các thay đổi an toàn tin tham khảo đã có trước lượt
thiết kế; các thay đổi server/data trong commit đó không thuộc redesign.

## Những việc lớn cần làm riêng

- Chạy lại kiểm thử nghiệp vụ và axe trên database QA tách biệt, có tài khoản
  admin, chủ trọ, người thuê và dữ liệu kiểm thử được phép tạo/xóa.
- Bộ lọc khoảng diện tích (cần kiểm tra hợp đồng API), dark mode và bản đồ.
- Ảnh chia sẻ SEO cần ảnh được phép sử dụng và URL triển khai chính thức.
- Không dùng ảnh tin tham khảo để trang trí khi chưa xác nhận quyền sử dụng.
