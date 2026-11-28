# Nhận diện tin gần trùng

Chạy `node scripts/train-listing-model.mjs` để đánh giá và tạo lại `lib/server/collector/listing-model.json` hoàn toàn ngoại tuyến. Tập huấn luyện lưu mã tin đầy đủ, nhãn rà thủ công và vector đặc trưng quan sát được. 30 cặp là các gợi ý của bản 6288cb0 trong lượt rà production: 13 bài đăng lại, 9 báo nhầm và 8 chưa rõ. Tệp `uncertain-listing-pairs.json` giữ riêng mã của 8 cặp chưa rõ. Script huấn luyện chỉ đọc `reviewed-listing-pairs.json`.

Vector đặc trưng theo thứ tự gồm độ trùng từ của tiêu đề, mô tả, địa chỉ; mức gần và mức khác của ảnh bìa; số nhà cùng đường (+1 trùng, −1 khác); độ trùng địa chỉ chỉ ở cấp địa phương; độ trùng mô tả khi ít nhất một bên chỉ chứa ngày. Ba đặc trưng văn bản và hệ số chặn giữ trọng số từ mô hình cũ. Các hệ số bổ sung được học bằng hồi quy logistic có điều chuẩn. Ảnh bìa dùng dấu vân tay chênh lệch độ sáng 256 bit. Ảnh thiếu, gần như trống, ngoài danh sách host cho phép, quá giới hạn dung lượng hoặc thời gian tải cho tín hiệu trung tính. So khớp số nhà dùng phần địa chỉ đứng trước dấu phẩy.

## Đánh giá trên tập đã rà

Giữ nguyên ngưỡng 0,70. Chia 22 cặp có nhãn thành 19 nhóm liên thông theo mã tin. Mỗi lượt huấn luyện bỏ toàn bộ nhóm đang chấm. Sau đánh giá, huấn luyện bản dùng trong ứng dụng trên cả 22 cặp. Kết quả theo thứ tự dương đúng / báo nhầm / âm đúng / bỏ sót:

- Bản cũ: 13 / 9 / 0 / 0.
- Bản mới: 12 / 1 / 8 / 1.
- Bản mới khi thiếu toàn bộ ảnh lúc suy luận: 12 / 3 / 6 / 1.

Bộ mẫu chỉ gồm các cặp do bản cũ đề xuất. Kết quả đo khả năng lọc lại danh sách đó. Cần tập tin độc lập và các cặp chưa từng được đề xuất để đo khả năng phát hiện trên toàn kho.

Cào thủ công trả gợi ý trong `meta.similarListings`. Kiểm tra bằng giao diện Admin dùng cùng bộ chấm, tối đa 200 tin và 30 cặp. Các URL gốc trùng sau chuẩn hóa tiếp tục đi qua luồng đối chiếu URL. Điểm AI chỉ phục vụ rà thủ công.

Nút kiểm tra bảo vệ trang chủ dùng những tiêu chí HTTP riêng biệt.
