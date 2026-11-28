# Mô hình thử nghiệm nhận diện tin gần trùng

Chạy `node scripts/train-listing-model.mjs` từ thư mục gốc để tạo lại trọng số trong `lib/server/collector/listing-model.json`. Quá trình này chỉ đọc dữ liệu mẫu trong repo. Suy luận chạy bằng JavaScript trong ứng dụng.

Mô hình hồi quy logistic dùng ba đặc trưng: mức trùng từ của tiêu đề, mô tả và địa chỉ sau khi chuẩn hóa tiếng Việt. Các cặp đạt điểm 0,70 trở lên được xếp hạng để quản trị viên xem xét. Cào thủ công trả gợi ý trong `meta.similarListings`; trang quản trị tin trùng so sánh các tin mới cập nhật. Quy tắc xử lý URL gốc chuẩn hóa vẫn phụ trách các bản sao cùng URL.

## Dữ liệu và đánh giá

Mười tin mẫu được tách theo tin gốc trước khi tạo cặp: bảy tin dùng để huấn luyện, ba tin giữ riêng để kiểm tra. Biến thể của cùng tin tạo nhãn dương; các tin mẫu khác nhau tạo nhãn âm, gồm cả ví dụ dùng chung tiêu đề hoặc địa chỉ. Đây là nhãn mô phỏng. Kết quả trên 18 cặp kiểm tra là 6 dương đúng, 3 bỏ sót, 9 âm đúng và 0 báo nhầm. Cần đánh giá riêng bằng cặp tin thật đã được quản trị viên xác nhận để biết hiệu quả ngoài thực tế. Điểm xếp hạng chưa được hiệu chuẩn thành xác suất.

## Đánh giá trang chủ

Trong trang quản trị tin trùng, nút kiểm tra trang chủ gửi GET cùng origin, bỏ thông tin đăng nhập và đánh giá năm dấu hiệu bảo vệ trình duyệt. Mỗi tiêu chí đạt đóng góp một điểm. Phép đo chỉ áp dụng cho phản hồi quan sát được. Độ uy tín của người đăng, tình trạng phòng và an toàn giao dịch cần bằng chứng độc lập.
