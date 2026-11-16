# Kiểm tra credential và lịch sử

Không chứa mật khẩu hoặc hash thật trong báo cáo này.

- Backup chỉ local: backup/fix-header-before-clean-20261116; không push backup hoặc refs/agents.
- Nhánh sạch bắt đầu từ origin/main. Lịch sử origin và checkpoint giữ nguyên theo xác nhận của chủ dự án.
- Giá trị cũ có trong lịch sử origin và checkpoint local; chỉ kiểm tra dòng thêm/file mới của các commit mới là phạm vi chặn push. Không tuyên bố đã xóa giá trị khỏi lịch sử công khai.
- Không có mật khẩu admin mặc định. Production bắt buộc ADMIN_PASSWORD, ADMIN_SESSION_SECRET, USER_SESSION_SECRET. Thiếu/blank thì báo tên biến, thoát mã 1; build không cần secret thật.
- Script tạo hash chỉ đọc ADMIN_PASSWORD và xuất salt:hash bằng scrypt, giữ nguyên định dạng xác thực hiện tại.
- File setup_admin.sql riêng không được đưa vào Git, Docker hoặc standalone. Bản example chỉ có placeholder và SQL được comment.
- Nếu từng dùng credential cũ, chủ dự án cần đổi ADMIN_PASSWORD trên Railway và cập nhật đúng users.password_hash nếu tài khoản dùng database. Hai cơ chế không tự đồng bộ. Đổi session secret nếu nghi ngờ bị lộ sẽ vô hiệu hóa session hiện tại.
- Phải đặt đủ ba biến bắt buộc trên Railway TRƯỚC khi merge/deploy. Không tự thay đổi Railway hoặc dữ liệu production.

Kết quả kiểm thử cuối và giới hạn chẩn đoán nằm trong báo cáo phát hành riêng.
