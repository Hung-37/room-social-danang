# Deploy production và smoke test ngày 27/11/2026

Railway xác nhận service `fantastic-rebirth` trong project `perpetual-commitment`, môi trường `production`, ở trạng thái **Active**. Deployment lấy mã từ nhánh `main` tại SHA `bea421a8dfb5de96a39af5edc8e3bc661031a1ee`. Lệnh pre-deploy để trống. [Deployment trên Railway](https://railway.com/project/149432ce-7072-4280-86b0-9468ab7eebb3/service/7a6ab775-6074-4c99-9ee0-0fd8df95cc65?environmentId=51603c14-8ba5-483f-b64e-6f4277ae7f30&id=e6e9128d-7e80-4870-a53d-1330c9070e7f#details)

## Kết quả sau deploy

Các phép kiểm tra dùng GET trên `https://fantastic-rebirth-production-9b02da1f.up.railway.app`.

| Đường dẫn | HTTP | Kết quả quan sát |
|---|---:|---|
| `/` | 200 | Trang chủ hiển thị “Tìm phòng trọ uy tín tại Đà Nẵng” và “Tin đăng mới nhất”. |
| `/bang-tin` | 200 | Trang hiển thị mục “Danh sách phòng”. |
| `/api/listings?limit=6` | 200 | Trả 6 tin từ database, mỗi tin có mã và tiêu đề. API báo tổng cộng 136 tin tại thời điểm kiểm tra. |
| `/api/health` | 200 | `{"status":"ok","version":"0.17.5"}` |
| `/api/health/ready` | 200 | `status: "ok"` khi gọi trong chính tab Chrome đã xác thực tại `/admin` trên cùng origin production. |

Trước khi có phiên Admin hợp lệ, readiness trả HTTP 401. Trong phiên đã xác thực, endpoint xác nhận có cấu hình kết nối và phiên người dùng, kết nối DB thành công, bảng `users` có đủ năm cột yêu cầu và có chỉ mục duy nhất cho email. Kết quả gồm `databaseReadOnly: false` và `writePrivilegeReported: true`. Endpoint kiểm tra quyền qua thông tin cấp quyền của DB. Toàn bộ smoke test chỉ đọc.
