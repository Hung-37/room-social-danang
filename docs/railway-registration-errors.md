# Tra cứu lỗi đăng ký trên Railway

Áp dụng khi deployment Active của service web đã chứa bản sửa đăng ký từ [PR #2](https://github.com/Hung-37/room-social-danang/pull/2). Kiểm tra branch và commit trong tab **Deployments** của đúng environment. [Tài liệu Railway về deployments](https://docs.railway.com/deployments/reference)

Ghi lại HTTP status, mã `code`, mã hỗ trợ `X-Request-Id` và thời điểm theo múi giờ. Trong deployment Active, mở **Deploy Logs** và tìm theo `requestId`. Bản ghi chẩn đoán có thể chứa tên biến thiếu, mã lỗi MySQL, `errno` hoặc `sqlState`. Khi trao đổi, chỉ chia sẻ các trường chẩn đoán cần thiết. [Tài liệu Railway về logs](https://docs.railway.com/observability/logs)

| Mã | HTTP | Nguyên nhân khả dĩ | Kiểm tra trên Railway | Cách xử lý cho chủ dự án |
|---|---:|---|---|---|
| `SERVER_MISCONFIGURED` | 500 | `MYSQL_URL` hoặc `USER_SESSION_SECRET` thiếu hay rỗng. | Mở **Variables** của service web trong environment production. Đối chiếu trường `missing` trong log và kiểm tra tham chiếu biến MySQL. | Khôi phục biến thiếu từ nguồn được phê duyệt, đúng service và environment. Nếu phải đổi secret ký phiên, dự kiến người dùng sẽ cần đăng nhập lại. |
| `REGISTER_SCHEMA_ERROR` | 500 | MySQL báo thiếu bảng hoặc cột khi xử lý đăng ký. Ứng dụng có thể trỏ nhầm database hoặc schema có thể cũ. | Đối chiếu database trong tham chiếu service. Kiểm tra metadata chỉ đọc của bảng `users`, gồm `external_id`, `name`, `email`, `password_hash`, `role` và unique index riêng trên `email`. So sánh với schema của commit Active. | Sửa tham chiếu nếu trỏ nhầm. Nếu xác nhận schema lệch, chuẩn bị bản sao, xác định migration cụ thể, kiểm thử và xin phê duyệt trước khi áp dụng. |
| `REGISTER_WRITE_FORBIDDEN` | 500 | MySQL từ chối quyền trên bảng hoặc database, hoặc kết nối đang trỏ tới nơi chỉ đọc. | Đối chiếu endpoint ghi, cờ `read_only` và quyền hiệu lực của tài khoản ứng dụng trên `users`. Xem mã MySQL cùng mã hỗ trợ. | Dùng endpoint ghi đúng. Nếu thiếu quyền, nhờ người quản trị DB cấp quyền tối thiểu cần cho ứng dụng theo quy trình phê duyệt. |
| `DATABASE_UNAVAILABLE` | 503 | Kết nối bị từ chối, timeout, mất kết nối, pool quá tải hoặc đạt giới hạn kết nối. | Đối chiếu log web và MySQL cùng thời điểm. Xem trạng thái service, host, port, private network, yêu cầu TLS và số kết nối. | Xử lý đúng nguyên nhân đã xác nhận, như khôi phục service, sửa tham chiếu hoặc điều chỉnh ngân sách kết nối sau khi đo tải. |
| `REGISTER_FAILED` | 500 | Lỗi ngoài các nhóm trên, chẳng hạn xác thực MySQL, ràng buộc dữ liệu hoặc ngoại lệ ứng dụng chưa có mã riêng. | Dùng mã hỗ trợ để tìm `mysqlCode`, `errno`, `sqlState` nếu có. Đối chiếu commit Active và tái hiện trên môi trường cô lập nếu các trường này rỗng. | Sửa cấu hình nếu log xác nhận lỗi kết nối hoặc xác thực. Nếu là lỗi ứng dụng, mở issue kèm mã hỗ trợ, mã lỗi và commit rồi sửa qua PR. |

[Tài liệu Railway về biến service](https://docs.railway.com/variables)

Sau khi bản sửa đã Active, `GET /api/health/ready` với phiên admin hợp lệ giúp kiểm tra sự hiện diện của biến, metadata schema, unique index và quyền ghi được báo cáo. Endpoint chỉ đọc. `writePrivilegeReported: false` có thể do `SHOW GRANTS` không khả dụng hoặc quyền được cấp qua cơ chế mà phép kiểm hiện tại không nhận ra. Xác minh quyền hiệu lực trước khi đề xuất thay đổi.

Lần QA sau deploy dùng lại đúng bí danh đã cấp và gửi một yêu cầu đăng ký. Nếu nhận `EMAIL_TAKEN` (409), dừng vì bí danh đã tồn tại. Nếu nhận `ACCOUNT_CREATED_LOGIN_REQUIRED` (201), tài khoản đã được ghi nhưng chưa có phiên, nên dừng đăng ký. Với 201 thông thường, ghi nhận thành công. Báo cáo HTTP status, mã lỗi nếu có và mã hỗ trợ. Giữ giá trị biến, mật khẩu, cookie, chuỗi kết nối và dữ liệu người dùng ngoài tài liệu và báo cáo.
