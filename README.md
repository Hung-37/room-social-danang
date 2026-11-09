# RoomĐàNẵng

Ứng dụng cộng đồng tìm phòng trọ tại Đà Nẵng, gồm bảng tin, trang cụm khu vực, trang chi tiết và khu vực quản trị dữ liệu. Đây là MVP/demo; xác thực và tương tác cộng đồng chưa phải hệ thống production.

## Tính năng
- Bảng tin tìm kiếm/lọc, trang chi tiết và 5 cụm sinh viên cùng nhóm “Chưa phân cụm”.
- Collector cho ba trang nguồn Đà Nẵng, hỗ trợ metadata HTML/JSON-LD và JSON/RSS HTTPS được cấp quyền.
- Tin mới được lọc khu vực, khử trùng, gắn nguồn và đưa vào hàng chờ `needs_review`.
- Admin chạy collector, nhập CSV/JSON, xem hàng chờ và duyệt/từ chối tin.
- Public API và trang chi tiết chỉ trả tin `verified`; Admin có thể duyệt bằng cache local khi MySQL offline.
- Đăng nhập, lưu/thích và tương tác cộng đồng hiện là MVP; một số dữ liệu tương tác chưa lưu bền vững.

## Backend
- Next.js App Router/API routes.
- MySQL lưu các listing đã normalize qua `database/schema.sql` và `MYSQL_URL`.
- Ollama local phân tích bài đăng qua `POST /api/ai/analyze` (mặc định model `llama3.2:3b`).
- Admin nhận CSV/JSON hoặc nội dung dán qua `POST /api/import/listings`, lọc tin liên quan và tùy chọn chỉnh lý bằng Ollama.
- Bảng tin chỉ hiển thị tin có trạng thái `verified`; tin thu thập mới nằm trong hàng chờ duyệt.
- Collector chạy tuần tự qua `/api/collector/run`; có thể chạy thủ công từ Admin hoặc theo lịch Vercel Cron mỗi 6 giờ.
- Cache runtime nằm ngoài `public/` tại `data/cached-listings.json`; cấu hình MySQL được khuyến nghị cho môi trường production/serverless.
- Có thể đặt `PUBLIC_FEED_URL` cho một JSON feed đã được cấp phép; không dùng URL trang HTML tìm kiếm/listing để bypass điều khoản.
- Đặt `COLLECTOR_USE_AI=true` nếu muốn Ollama phân tích tối đa 20 tin trong mỗi lượt đồng bộ tự động.
- Import có thể nhận `phone` và `imageUrl`/`image_url` từ dữ liệu bạn có quyền sử dụng; hệ thống không tự lấy số điện thoại/hình ảnh từ website bên ngoài.
- Meta chỉ được gọi qua Official Graph API tại `GET /api/meta/feed`, dùng `META_PAGE_ID` và `META_ACCESS_TOKEN` ở server.
- Production admin dùng session cookie HttpOnly; cần cấu hình `ADMIN_EMAIL`, `ADMIN_PASSWORD` và `ADMIN_SESSION_SECRET`. LocalStorage chỉ còn phục vụ trạng thái người dùng demo, không được dùng để bảo vệ API quản trị.
- Listing không được cập nhật trong `LISTING_STALE_DAYS` sẽ bị đánh dấu stale và ẩn khỏi feed công khai; dữ liệu quá `LISTING_RETENTION_DAYS` sẽ được dọn khi cache được ghi lại.
- Khi có `MYSQL_URL`, tài khoản, bài viết cộng đồng và bình luận được lưu trong MySQL; nếu database offline hệ thống vẫn fallback sang file local.
- Collector tự retry tối đa 3 lần, ghi lịch sử chạy vào `data/collector-runs.json` và cung cấp thống kê qua `/api/admin/stats`.
- API `/api/listings` hỗ trợ `minPrice`, `maxPrice`, `minArea`, `maxArea` và `sort=price_asc|price_desc|area_desc`.

Khởi tạo local:
```bash
copy .env.example .env.local
# Chạy database/schema.sql trong MySQL
ollama pull llama3.2:3b
npm run dev
```

Không đưa `META_ACCESS_TOKEN` lên client. Nếu MySQL không khả dụng, collector lưu vào `data/cached-listings.json`; production/serverless nên dùng MySQL.

## Xác thực
Hệ thống sử dụng localStorage để lưu trạng thái đăng nhập (demo). Trong production, cần thay thế bằng authentication system thật (NextAuth, Auth0, v.v.).

### Tính năng xác thực
- Đăng ký/Đăng nhập cơ bản
- Chỉ cho phép bình luận khi đã đăng nhập
- Chỉ cho phép đánh giá (thích/lưu/báo cáo) khi đã đăng nhập
- Chỉ cho phép đăng bài khi đã đăng nhập
- Header hiển thị trạng thái đăng nhập và nút đăng xuất

## Thu thập dữ liệu
Ba nguồn HTML Đà Nẵng được cấu hình sẵn trong `js/collector.js`: Phongtro123, Trọ Mới và Thuephongtro. Parser dùng JSON-LD khi có để lấy tiêu đề, mô tả, giá, diện tích và địa chỉ; không lưu số điện thoại hoặc ảnh. Tin được lọc theo khu vực, loại trùng giữa các nguồn và đánh dấu `needs_review`.

Collector chỉ đọc trang danh sách gốc, không theo tham số phân trang bị robots.txt chặn. Việc truy cập công khai không tự động cấp quyền tái xuất bản nội dung; cần xác nhận quyền sử dụng/attribution với từng nhà cung cấp trước khi vận hành. Không đăng nhập, vượt CAPTCHA, lấy thông tin liên hệ cá nhân hoặc bỏ qua robots.txt/điều khoản. Tin hiển thị kèm đường dẫn để người dùng mở website nguồn. Cấu hình localhost/domain mẫu bị vô hiệu hóa; bản ghi `example.com` không được phục vụ.

Collector cũng hỗ trợ JSON/RSS HTTPS công khai qua `PUBLIC_FEED_URL(S)` và `PUBLIC_RSS_URL(S)`. URL localhost, IP private và domain mẫu (`example.com`, `.test`) tự bị tắt; listing có URL placeholder bị loại khỏi cache. Nguồn Meta chỉ được gọi qua Official Graph API. Các nguồn khác cần được allowlist và cấp quyền trước khi bật.

## HTML Crawler
Hệ thống hỗ trợ HTML crawler cho các nguồn đã cho phép truy cập. Không tự động cào Nhà Tốt, Batdongsan hoặc các nguồn có anti-crawler.

### Cấu hình HTML Crawler
Thêm vào `.env.local`:
```bash
HTML_CRAWLER_URL=https://example.com/listings
HTML_ITEM_SELECTOR=div.listing-item
HTML_TITLE_SELECTOR=h2.title
HTML_DESCRIPTION_SELECTOR=div.description
HTML_PRICE_SELECTOR=span.price
HTML_AREA_SELECTOR=span.area
HTML_ADDRESS_SELECTOR=div.address
```

### Các Endpoint
- `GET /api/collector/check` - Kiểm tra trạng thái các nguồn (bao gồm HTML sources)
- `POST /api/collector/check` - Tạo cấu hình HTML crawler mới
- `POST /api/collector/run` - Chạy crawler thủ công từ Admin
- `GET /api/collector/run` - Chạy theo lịch; production yêu cầu `Authorization: Bearer $CRON_SECRET`

### Cron Job Tự Động
Sử dụng Vercel Cron Jobs hoặc external cron service:
```json
{
  "crons": [
    {
      "path": "/api/collector/run",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Chính Sách
- Chỉ cào các nguồn có robots.txt cho phép hoặc có văn bản đồng ý
- Không bypass CAPTCHA, login gates, hoặc rate limiting
- Tôn trọng robots.txt và terms of service
- Mọi bản ghi mới có trạng thái `needs_review`; API bảng tin chỉ trả tin đã `verified`

## Trang Chi Tiết Mở Rộng
Trang chi tiết bài đăng đã được nâng cấp với các tính năng mới:

### Thống kê bài viết
- Số lượt xem
- Số đánh giá hữu ích
- Số bình luận

### Thông tin cụm
- Mô tả vị trí cụm
- Tags liên quan đến khu vực
- Thông tin về trường/nhà xung quanh

### Bài tương tự
- Hiển thị các bài đăng trong cùng cụm
- Có thể ẩn/hiện danh sách
- Responsive grid layout

### Tương tác có điều kiện
- Yêu cầu đăng nhập để bình luận
- Yêu cầu đăng nhập để đánh giá
- Yêu cầu đăng nhập để báo cáo

## Chạy
```bash
npm install
npm run dev
```
Sau đó mở http://localhost:3000
