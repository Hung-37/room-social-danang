# Room Đà Nẵng — 0.17.5

Ứng dụng cộng đồng phòng trọ sinh viên dùng **Next.js + MySQL**: tìm phòng, thảo luận/bình luận, lưu phòng, hồ sơ, nhắn tin riêng, lịch xem phòng và kiểm duyệt. Đây là tài liệu chính duy nhất của dự án. Hướng dẫn chạy XAMPP và kết quả kiểm tra mới nhất nằm ở cuối tài liệu.

## Chạy dự án

Cần Node.js **22.13 trở lên** (khuyến nghị Node 24), npm và MySQL 8 hoặc MariaDB 11 đang chạy. Thư mục ứng dụng phải có quyền ghi dữ liệu/ảnh tải lên.

```sh
npm ci
```

Sao chép `.env.example` thành `.env.local`. Trên macOS/Linux dùng `cp .env.example .env.local`; PowerShell dùng `Copy-Item .env.example .env.local`.

Tạo database trước, ví dụ:

```sql
CREATE DATABASE room_danang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Cấu hình các biến sau trong `.env.local` hoặc Variables của hosting:

| Biến | Ý nghĩa |
| --- | --- |
| `MYSQL_URL` | URL kết nối MySQL vào database đã tạo; percent-encode ký tự đặc biệt trong mật khẩu URL. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Thông tin đăng nhập Admin; thay toàn bộ giá trị mẫu. |
| `ADMIN_SESSION_SECRET`, `USER_SESSION_SECRET` | Hai chuỗi ngẫu nhiên **khác nhau**, mỗi chuỗi ít nhất 32 ký tự. |
| `PORT` | Cổng web, mặc định 3000. Hosting thường tự cấp biến này. |
| `LISTING_STALE_DAYS` | Số ngày tin còn hiệu lực, mặc định 30. |
| `MYSQL_POOL_LIMIT`, `MYSQL_QUEUE_LIMIT` | Giới hạn kết nối/hàng đợi mỗi process, mặc định 10/100. |

Có thể tạo từng secret trên máy của bạn bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Không commit `.env.local` hoặc đưa secret vào mã nguồn.

```sh
npm run db:init
npm run db:optimize
npm run doctor
npm test
npm run typecheck
npm run build
npm start
```

Mở **http://localhost:3000**. Dừng bằng Ctrl+C. Dùng `npm run dev` khi phát triển. Các lệnh database tự đọc `.env.local`; biến đã đặt trong terminal/hosting được ưu tiên.

Database mới có 23 bảng. Chương trình không tự tạo dịch vụ MySQL và không tự nạp tài khoản/nội dung giả vào database đang chạy.

### Kết nối MySQL online thay cho XAMPP

Ứng dụng kết nối qua `MYSQL_URL`, không phụ thuộc XAMPP. Có thể dùng MySQL managed/online tương thích MySQL 8 hoặc MariaDB 11 bằng cách thay URL trong `.env.local` trên máy chạy ứng dụng, hoặc đặt `MYSQL_URL` trong Variables của hosting:

```text
MYSQL_URL=mysql://USER:PERCENT_ENCODED_PASSWORD@HOST:PORT/DATABASE
```

Lấy host, port, tên database và yêu cầu TLS từ nhà cung cấp. Mật khẩu có ký tự đặc biệt phải percent-encode. Nhà cung cấp phải cho phép kết nối từ máy chạy ứng dụng; nếu có IP allowlist, chỉ thêm IP cần thiết và không mở database công khai cho mọi địa chỉ. Không gửi URL có mật khẩu qua chat, không commit `.env.local`.

Trước khi chuyển database đang có dữ liệu, sao lưu XAMPP rồi xuất/nhập dữ liệu sang database online; không chạy khởi tạo trên database production chưa sao lưu. Khi đã cấu hình URL và quyền truy cập, chạy `npm run doctor` để kiểm tra kết nối/schema. Với database mới, chạy `npm run db:init`; với database cũ, chạy các migration còn thiếu theo thứ tự ở mục bên dưới. XAMPP không cần chạy nếu ứng dụng đã trỏ tới database online.

### Nâng cấp database cũ

Sao lưu trước khi nâng cấp. Chạy các migration còn thiếu theo thứ tự:

```sh
npm run db:social
npm run db:upgrade-v8
npm run db:upgrade-v9
npm run db:upgrade-v10
npm run db:upgrade-v15
npm run db:upgrade-v17
npm run db:optimize
npm run doctor
```

V17 thêm version/deleted_at cho nội dung và bảng chống gửi trùng `mutation_requests`. Từ 0.17.0 đến **0.17.5 không có migration mới**. Chạy lại migration không xóa dữ liệu; vẫn cần backup trước mọi lần nâng cấp. Chỉ khởi động mã mới sau khi schema đã sẵn sàng.

## Các trang và cách sử dụng

| Trang | Người sử dụng và chức năng |
| --- | --- |
| `/` | Trang chủ, tìm kiếm nhanh và nội dung mới. |
| `/bang-tin` | Khách: tìm/lọc/sắp xếp phòng đã duyệt, mở chi tiết. |
| `/thao-luan` | Xem thảo luận; tài khoản đăng bài chờ duyệt. |
| `/cum`, `/khu-vuc` | Xem các khu vực và số phòng/thảo luận. |
| `/cum/[id]` | Nội dung theo khu vực; ví dụ `/cum/hai-chau`. |
| `/bai/[id]` | Chi tiết phòng/thảo luận thật, ảnh, bình luận và tương tác. Không nhập nguyên `[id]` vào URL. |
| `/quy-dinh` | Quy định sử dụng hiện hành, ảnh và kiểm duyệt. |
| `/dang-ky`, `/dang-nhap` | Đăng ký thành viên/chủ trọ, đăng nhập người dùng hoặc Admin. |
| `/profile` | Hồ sơ, sửa tên và nội dung đã lưu của tài khoản. |
| `/bai-viet-cua-toi` | Quản lý, sửa/xóa thảo luận của chính mình. |
| `/thong-bao` | Đọc/xóa từng thông báo và đồng bộ số chưa đọc. |
| `/tin-nhan` | Hội thoại riêng; chọn phòng hoặc hội thoại để trao đổi. |
| `/lich-xem-phong` | Lịch đề xuất/xác nhận từ hội thoại giữa người tìm phòng và chủ trọ. |
| `/dang-phong` | Chủ trọ đã được xác minh: đăng phòng chờ duyệt. |
| `/quan-ly-phong` | Chủ trọ: tìm/lọc, phân trang và quản lý đủ phòng của mình; tổng số lấy từ database. |
| `/quan-ly-phong/[id]` | Sửa phòng thuộc tài khoản; người khác không được truy cập nội dung riêng. |
| `/admin` | Admin: thu thập/nhập dữ liệu, duyệt phòng/thảo luận, báo cáo và nhật ký. |
| `/admin/chu-tro` | Tìm tên/email, lọc trạng thái, phân trang và xác minh/thu hồi chủ trọ. |
| `/admin/nguoi-dung` | Tìm/lọc và khóa/mở tài khoản, có lý do và kiểm tra phiên bản. |
| `/admin/cau-hinh` | Tên website, quy định, nguồn dữ liệu, collector và AI. |
| `/admin/tin-nhan` | Báo cáo do thành viên hội thoại gửi; không tự mở toàn bộ tin nhắn riêng. |

Khách mở trang cá nhân sẽ được hướng dẫn đăng nhập; mở trang Admin sẽ chuyển về đăng nhập. Tài khoản thường không thể tự cấp quyền Admin. Trang dữ liệu trống không có nghĩa là lỗi: database mới cần nội dung được gửi và duyệt trước.

### Luồng và phân quyền

1. Admin xác minh chủ trọ → chủ trọ đăng phòng → Admin duyệt → phòng còn hiệu lực được công khai.
2. Chủ trọ sửa nội dung/ảnh → phòng về chờ duyệt. Phòng ẩn/hết phòng cần chủ trọ gửi lại; Admin không tự công khai từ trạng thái này.
3. Thu hồi xác minh → phòng đang công khai về chờ duyệt; xác minh lại không tự công khai.
4. Tác giả sửa thảo luận → chờ duyệt lại. Chỉ tác giả sửa/xóa bài hoặc bình luận của mình; phản hồi con vẫn được giữ khi bình luận gốc bị xóa.
5. Admin muốn xóa phòng phải từ chối tin trước, nhập lý do và xác nhận. Xóa dọn dữ liệu liên quan, lưu nhật ký/tombstone chống nhập lại cùng mã; giữ lịch sử hội thoại/lịch hẹn.
6. Tin nhắn chỉ dành cho thành viên hội thoại. Lịch hẹn kiểm tra thành viên, trạng thái phòng, thời gian và xung đột lịch.

UI kiểm duyệt gửi `reviewRevision`; khi nội dung thay đổi, server trả 409 để tải/xem lại. Client API cũ bỏ trường này chỉ áp dụng quyết định lên trạng thái hiện tại, vẫn chịu kiểm tra quyền/trạng thái. Biểu mẫu tạo phòng/thảo luận dùng Idempotency-Key trong MySQL để gửi lại sau lỗi mạng không tạo trùng; khóa chưa được giữ qua việc đóng/tải lại trình duyệt.

## Tìm kiếm và phân trang quản lý

Hai lỗi chỉ hiển thị 200 chủ trọ/phòng được sửa ở 0.17.5. Trang quản lý phòng tải 10 phòng mỗi trang; trang quản lý chủ trọ tải 20 mục, có nút trước/sau ở đầu và cuối danh sách, tìm kiếm và lọc trạng thái. Số tổng được đếm ở MySQL theo bộ lọc; không dùng độ dài trang hiện tại làm số tổng. Đổi bộ lọc trở về trang đầu; nếu một mục vừa rời trang cuối sau thao tác, ứng dụng tự về trang hợp lệ.

- `GET /api/admin/landlords`: `q` tìm tên/email, `status` là pending/verified/rejected; cần phiên Admin.
- `GET /api/landlord`: `q` tìm tiêu đề/địa chỉ, `status` là needs_review/verified/rejected/hidden/rented; chỉ trả phòng của chủ trọ trong phiên hiện tại.
- Cả hai nhận `limit` (mặc định 20, tối đa 100) và `offset`. Giữ hình dạng `data` cũ; thêm `meta` gồm total/count/limit/offset/hasMore/nextOffset. Client cần đọc nhiều trang phải tiếp tục theo meta, không coi mảng đầu là toàn bộ dữ liệu.
- Khi mạng lỗi có thử lại; tìm kiếm vẫn sửa được trong lúc đang tải, phản hồi cũ bị loại bỏ. Sau 10 giây không nhận được dữ liệu, màn hình báo chậm kết nối để thử lại. Mất phiên xóa dữ liệu riêng đang hiển thị.
- Xác nhận ẩn/gửi lại phòng được đưa vào vùng nhìn và nhận focus; Hủy/Escape trả focus về thao tác trước. Trang Admin có nút đăng xuất; chỉ chuyển trang khi server xác nhận thành công.

## Quy chuẩn ảnh

- Tối đa 4 ảnh JPG/PNG/WebP, mỗi ảnh tối đa 5 MB; nên dùng ảnh thực tế khoảng 1200 × 900 px. Ảnh đầu là ảnh bìa, có thể đổi thứ tự trong trình sửa.
- Server chỉ nhận ảnh tĩnh hợp lệ, giới hạn 20 megapixel, xoay theo EXIF, co vừa tối đa 1600 px mỗi cạnh và lưu WebP; không phóng lớn ảnh nhỏ.
- Thẻ danh sách: khung 4:3, cắt giữa bằng cover. Chi tiết: ảnh chính 16:10 dùng contain, có ảnh thu nhỏ và xem lớn bằng bàn phím/Escape.
- Ảnh thiếu/hỏng có khung thay thế. Ảnh riêng/chưa được duyệt không được công khai qua API.

## Dữ liệu, collector và AI

Trong Admin, cấu hình nguồn được phép sử dụng → chạy collector/nhập JSON hoặc CSV → kiểm tra số tin thực sự lưu MySQL → kiểm tra địa chỉ, giá, ảnh → duyệt thủ công. Nguồn HTML có selector theo từng website; thay đổi cấu trúc nguồn có thể làm crawler ngừng hoạt động.

JSON/RSS công khai có thể cấu hình bằng `PUBLIC_FEED_URLS`, `PUBLIC_RSS_URLS`. URL/redirect phải qua kiểm tra host và chống mạng nội bộ. Không dùng phiên đăng nhập, nhóm kín, CAPTCHA hoặc nguồn chưa được phép thu thập.

AI tùy chọn, mặc định tắt. Chạy Ollama và tải model trên dịch vụ có thể kết nối; đặt `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, kiểm tra trong Admin rồi bật cùng quota. Trong Docker, `127.0.0.1` là container ứng dụng; cần dùng địa chỉ dịch vụ Ollama thực. `AI_DISABLED=true` ngăn bật AI từ Admin. AI chỉ gợi ý, không tự xác minh chủ trọ hoặc tự xuất bản tin.

Dữ liệu tùy chọn, không tự nạp khi khởi động:

- `npm run db:seed-demo`: nội dung có nhãn `[Mẫu]`, tài khoản mẫu bị khóa và không có mật khẩu đăng nhập công bố.
- `database/seeds/`: snapshot/dữ liệu mẫu cũ, không bảo đảm tin còn hiệu lực; chỉ nhập khi cần và kiểm duyệt lại.
- `fixtures/listings.json`: mẫu collector dành cho phát triển; `COLLECTOR_INCLUDE_DEMO` mặc định false.
- `npm run db:export-data`: xuất snapshot theo cấu hình của script. Không đưa dữ liệu cá nhân/secret vào gói nguồn công khai.

Thư mục `data/` chứa cache/runtime của collector, lịch sử chạy, fallback file khi MySQL không khả dụng và file ảnh. Không chỉnh tay các file runtime nếu không cần khôi phục dữ liệu; dữ liệu mẫu trong `data/fixtures/` chỉ dùng cho test/import thủ công, không phải dữ liệu production. Các file runtime được bảo vệ trong `.gitignore`.

`legacy/` là prototype HTML/CSS/JavaScript trước khi chuyển sang Next.js, không được dùng trong production. Giữ lại để tham khảo giao diện cũ; tính năng mới cần phát triển trong `app/`, `components/` và `lib/`. Có thể mở `legacy/index.html` trực tiếp trong trình duyệt.

## Cấu trúc thư mục

```text
app/          Trang Next.js, API và CSS theo tính năng
components/   Thành phần giao diện dùng chung
lib/          Dịch vụ, phân quyền, transaction, collector và quy tắc dữ liệu
scripts/      Start/build/doctor/hosting và scripts/db cho migration, index, seed
database/    Schema, contract, index, migration và seed tùy chọn
fixtures/     Dữ liệu local cho phát triển
public/       Tài nguyên công khai và service worker
tests/       Unit, API, browser và fixture kiểm thử
README.md     Hướng dẫn chính duy nhất
```

Một pool MySQL có giới hạn cho mỗi process. API dùng truy vấn tham số; thao tác nhiều bảng có transaction. Service worker chỉ cache tài nguyên build có hash, không cache API/dữ liệu riêng. Dữ liệu runtime/ảnh nằm trong `data/`; phải giữ thư mục này khi cập nhật hoặc gắn volume khi triển khai Docker.

## Kiểm thử

```sh
npm test
npm run typecheck
npm run build
```

Kiểm thử API/browser có ghi dữ liệu: chỉ chạy trên database QA riêng, không dùng database chính. Tạo schema bằng `db:init`, chạy server với cùng database và secret thử. Đặt `TEST_BASE_URL` localhost, `TEST_ISOLATED_DB=1`, `MYSQL_URL` QA, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`; không dùng secret thật trong lệnh chia sẻ.

- `npm run test:pages`: tự tạo tài khoản/nội dung tổng hợp, mở các trang ngoài trang chủ theo từng quyền, kiểm tra desktop/mobile, dữ liệu, tương tác, retry và axe. Cần Playwright Chromium; đặt `CHROMIUM_PATH` nếu dùng browser hệ thống, `TEST_SCREENSHOT_DIR` để lưu kết quả/ảnh ngoài gói nguồn.
- Các nhóm API hiện có: `test:integration`, `test:comments`, `test:social`, `test:management`, `test:viewings`, `test:collector`, `test:recluster`, `test:areas`, `test:photos`, `test:deletions`, `test:errors`, `test:sessions`, `test:mutations`, `test:content`.
- Browser tương ứng dùng fixture do bộ API cùng nhóm xuất. Đặt biến `TEST_*_FIXTURES` mà script yêu cầu; fixture chứa cookie, không chia sẻ. `test:content:browser` cần fixture mới mỗi lượt vì có sửa/xóa nội dung.
- `test:workflow-conflicts` và `test:workflow-conflicts:browser`: trạng thái phòng, thu hồi/xác minh, snapshot cũ và quyết định đồng thời.
- `test:notification-concurrency`: thêm MYSQL_URL QA/test và quyền CREATE TRIGGER trong QA để tạo trễ có kiểm soát; 20 cặp xóa/gửi, tự gỡ trigger trong finally. Không cấp quyền này cho production chỉ để chạy test.
- `test:read-load`: cần fixture `node tests/fixtures/data-loading.mjs` trong database QA trống riêng (1.080 phòng/88 thảo luận); kiểm tra 900 request với mức đồng thời 5/20/50. `TEST_LOAD_REPORT` chọn tệp JSON.
- `test:schema-health`: sáu server localhost cho schema đủ/rỗng/thiếu bảng/thiếu cột/không cấu hình/mất kết nối. Đặt `TEST_BASE_URL`, `TEST_EMPTY_BASE_URL`, `TEST_PARTIAL_BASE_URL`, `TEST_OLD_BASE_URL`, `TEST_UNCONFIGURED_BASE_URL`, `TEST_FAILURE_BASE_URL`.
- `test:landlord-pagination`: thêm MYSQL_URL QA và TEST_PAGINATION_FIXTURES để tạo/check 201 chủ trọ và 201 phòng, phân trang đủ/không trùng, tổng/lọc/quyền. `test:landlord-pagination:browser` dùng fixture đó, kiểm tra hai cỡ màn hình, hủy/xác nhận, mạng chậm/lỗi, phản hồi cũ, mất phiên và đăng xuất. Mỗi lần UI cần fixture mới vì có thay đổi trạng thái.
- `npm run test:ai-fixture`: model giả lập dành riêng cho QA, không phải model AI thật.

Không chạy đồng thời các bộ thay đổi nguồn/cấu hình trên cùng database. Khởi động lại server QA giữa các đợt thử đăng nhập để không trộn quota; không tắt rate limit của ứng dụng để làm test qua. Log/ảnh/fixture là đầu ra thử nghiệm, không nằm trong ZIP nguồn.

## Triển khai Railway

1. Tạo tài khoản Railway và project có dịch vụ MySQL.
2. Đưa mã lên kho Git riêng, tạo service ứng dụng từ kho; root phải chứa `package.json`. Có sẵn `Dockerfile`, `railway.toml`.
3. Đặt MYSQL_URL bằng reference tới MySQL, cấu hình thông tin Admin và hai session secret trong Variables. Không đưa secret vào Git.
4. Pre-deploy chạy `node scripts/db/init.mjs`; với database cũ, bảo đảm các migration còn thiếu đã chạy. Gắn volume cho `/app/data` nếu dùng ảnh tải lên/runtime files.
5. Generate Domain và chờ `/api/health` trả 200. Kiểm tra luồng xác minh → đăng → duyệt từ tài khoản thử riêng.
6. Chạy `HOSTING_URL=https://ten-mien-cua-ban npm run verify:hosting`; PowerShell đặt biến môi trường trước lệnh. Đây là kiểm tra đọc/permission cơ bản, không thay kiểm thử đầy đủ.

Giữ một replica: một số khóa/rate limit còn trong process. Muốn mở rộng nhiều instance cần điều phối/rate limit dùng chung và lưu ảnh dùng chung. Chi phí/hạn mức do Railway quyết định.

## Chẩn đoán

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| `npm ci` lỗi | Dùng Node phù hợp, đúng thư mục và package-lock.json, kiểm tra kết nối registry. |
| Không kết nối MySQL/health 503 | Kiểm tra MYSQL_URL, MySQL đang chạy, schema/migration; chạy doctor. Health kiểm tra bảng/cột nhưng không chứng nhận mọi index/enum/quyền ghi ảnh. |
| `EADDRINUSE` hoặc bản cũ vẫn hiện | Dừng server cũ, build lại và start đúng thư mục/cổng. |
| 401 | Phiên chưa đăng nhập/hết hạn; đăng nhập lại. |
| 403 | Sai vai trò, bị chặn hoặc chủ trọ chưa được xác minh. |
| 409 | Nội dung/trạng thái đã đổi; tải và xem lại trước khi gửi. |
| 404 với nội dung | Kiểm tra ID, trạng thái duyệt, còn hiệu lực hoặc đã bị ẩn/xóa. `/cum` và `/khu-vuc` đều là URL hợp lệ. |
| Ảnh hoặc nguồn ngoài lỗi | Kiểm tra URL/quyền nguồn; có thể dùng ảnh tải lên. Nguồn ngoài không được bảo đảm luôn tồn tại. |

## Kết quả kiểm tra và giới hạn

<!-- PAGE_CHECK_RESULTS -->
Kiểm tra ngày 12/11/2026 trên Linux, Node 24 và MariaDB, dùng dữ liệu QA riêng:

- **Hai lỗi QA-01/QA-02 được sửa**: đọc đủ 201 chủ trọ và 201 phòng qua nhiều trang, không lặp/thiếu bản ghi; tìm được bản ghi nằm ngoài giới hạn 200 cũ. Tổng số và bộ lọc đúng, kiểm tra quyền không lộ phòng của chủ trọ khác.
- **88 kiểm tra API phân trang** và **60 kiểm tra trình duyệt mới** đạt, gồm 4 lượt axe desktop/mobile, tìm kiếm chậm, hủy/xác nhận, ẩn/gửi lại phòng, tự về trang hợp lệ, retry, timeout, mất phiên và đăng xuất Admin.
- Chạy lại **1.962 kiểm tra API nghiệp vụ**: đạt; cộng bộ phân trang thành **2.050 kiểm tra API**. Chạy lại **59 unit test**, TypeScript và production build: đạt.
- Dùng thử **22 mẫu đường dẫn ngoài trang chủ qua 78 trường hợp**, 68 lượt axe và 6 thao tác thực tế: đạt. Bộ UI quản lý phòng, hội thoại, lịch xem, cấu hình Admin và xung đột cũng chạy qua. Không thấy lỗi JavaScript hoặc tràn ngang trong các viewport thử 1440/390 px.
- Cài theo lockfile từ ZIP sạch, init/migration/optimize lặp lại, doctor 23 bảng, build và TypeScript sau build: **18 lệnh kiểm tra đều đạt**; mã ứng dụng trong gói khớp bản đã build sạch.
- Production 0.17.5 chạy cổng 3000 trong môi trường làm việc, health 200. Kiểm tra trang chủ, URL khu vực, API Admin còn đủ và đường dẫn sai 404: đạt. Dữ liệu chính 33 phòng, 12 thảo luận, 16 bình luận giữ nguyên.

Đánh giá theo trải nghiệm sử dụng: các luồng chính của MVP có thể dùng để tìm phòng, lưu/trao đổi, gửi/duyệt tin và quản lý dữ liệu. Chủ trọ/Admin đã có cách tìm bản ghi cũ, xem tổng thật và chuyển trang; phản hồi lỗi/phân quyền và bước xác nhận rõ hơn. Đây là dùng thử bằng trình duyệt và kiểm thử có kịch bản, chưa phải nghiên cứu trải nghiệm với nhóm người dùng thực tế.
<!-- END_PAGE_CHECK_RESULTS -->

Đã loại tài liệu/báo cáo trùng và tệp sinh tự động khỏi gói nguồn; giữ code, migration, fixture phát triển và test cần thiết. Chưa triển khai hosting/HTTPS bên ngoài hoặc đánh giá chất lượng model AI thật. Các kết quả Linux localhost không chứng minh mọi thiết bị, hệ điều hành hoặc mức tải. Đây là bản nâng cấp mã workspace; tệp .7z lớn trước đó chưa được đối chiếu.


## Tài liệu hợp nhất

Các phần dưới bảo toàn nội dung tài liệu cũ để tra cứu. Báo cáo kiểm thử, checklist và trạng thái tính năng ở đây là lịch sử, không phải kết quả xác minh hiện tại. Khi có mâu thuẫn, ưu tiên hướng dẫn vận hành phía trên. AGENTS.md và CLAUDE.md là chỉ dẫn cho công cụ, được giữ riêng.

### Tài liệu gốc: docs/PROJECT-STRUCTURE.md

<details>
<summary>Nội dung lưu trữ</summary>

# Cấu trúc project

## Runtime production

- `app/`: pages, API routes và màn hình admin của Next.js.
- `components/`: component giao diện dùng chung.
- `lib/`: database, auth, storage, roles, notifications và nghiệp vụ server.
- `js/collector.js`: parser/collector; `js/collector-service.js`: điều phối retry/concurrency.
- `database/schema.sql` và `database/migration-*.sql`: schema/migration MySQL.

## Dữ liệu và kiểm thử

- `data/`: cache/runtime fallback và fixtures; xem mục dữ liệu trong [README.md](#du-lieu-collector-va-ai).
- `data/fixtures/`: CSV/JSON mẫu.
- `tests/`: test collector và database fallback.
- `scripts/`: công cụ vận hành.

## Legacy

- `legacy/`: prototype HTML/CSS/JavaScript cũ, không dùng trong production; xem mục Legacy trong [README.md](#du-lieu-collector-va-ai).

## Quy tắc tổ chức

1. API server đặt trong `app/api`, logic tái sử dụng đặt trong `lib`.
2. Không đưa secret, database dump hoặc cache runtime vào source control.
3. Parser collector chỉ chuẩn hóa dữ liệu; quyền truy cập và persistence xử lý ở service/API.
4. Dữ liệu mới luôn bắt đầu ở `needs_review`, không hiển thị công khai trước khi duyệt.


</details>

### Tài liệu gốc: docs/COLLECTOR-SOURCES.md

<details>
<summary>Nội dung lưu trữ</summary>

# Danh sách nguồn đã cấu hình và cách cào lại

Các URL bên dưới **đã tồn tại trong `js/collector.js` của bản dự án**, không phải nguồn mới được xác minh quyền thu thập.

| Nguồn | URL | Trạng thái mặc định |
|---|---|---|
| Phongtro123 Đà Nẵng | https://phongtro123.com/tinh-thanh/da-nang | Cần kiểm tra quyền, robots và cấu trúc trang |
| Trọ Mới Đà Nẵng | https://tromoi.com/phong-tro-tai-da-nang | Cần kiểm tra quyền, robots và cấu trúc trang |
| Thuê Phòng Trọ Đà Nẵng | https://thuephongtro.com/cho-thue-phong-tro-da-nang | Cần kiểm tra quyền, robots và attribution |
| CafeLand | https://nhadat.cafeland.vn/cho-thue/phong-tro/ | Chỉ xem thủ công (`manual_review`), không được bật crawler |

## Cào lại một nguồn

1. Đăng nhập tài khoản admin và vào tab Collector.
2. Mở liên kết nguồn để kiểm tra trang, điều khoản và quyền sử dụng dữ liệu.
3. Nếu được phép, bật nguồn và chọn **Cào lại nguồn này**; hoặc chọn **Chạy ngay** để chạy mọi nguồn đang bật.
4. Kiểm tra kết quả `count`, lỗi parser, trạng thái lưu MySQL và duyệt tin trước khi xuất bản.

Endpoint `POST /api/collector/run` chấp nhận JSON `{ "sourceId": "phongtro123-da-nang" }` để chạy riêng một nguồn **đang bật**, yêu cầu phiên admin. Cron GET vẫn chạy toàn bộ nguồn bật. Danh sách nguồn lấy từ `GET /api/collector/check` (admin). URL mới trong form HTML hiện chỉ sinh hướng dẫn cấu hình `.env.local`, **không lưu tự động**.

## Chưa đạt production

- Không coi `robots.txt` cho phép là giấy phép sử dụng nội dung; cần kiểm tra điều khoản và quyền thu thập của từng website.
- Collector lock và rate-limit hiện chỉ trong một process; cần Redis/distributed lock khi chạy nhiều instance.
- Chưa kiểm thử E2E với MySQL thực tế và chưa xác nhận mọi adapter HTML lấy đúng tin.
- Production phải có MySQL hoạt động; lỗi DB không được thay bằng thông báo lưu thành công vào cache.
- Cần giới hạn và kiểm soát các URL cấu hình để chống SSRF và redirect tới mạng nội bộ.


</details>

### Tài liệu gốc: CHECK_STATUS.md

<details>
<summary>Nội dung lưu trữ</summary>

# Trạng thái kiểm tra (2026-11-09)

- `node --check js/collector.js`: PASS.
- `npm test`: 6 PASS / 1 FAIL (collector.test.mjs không nạp được `cheerio` do chưa cài dependencies).
- `npm run doctor`: báo thiếu `next`, `react`, `react-dom`, `cheerio`, `mysql2` trong môi trường kiểm tra.
- `npm ci --offline`: ENOTCACHED (thiếu `whatwg-mimetype` trong npm cache).
- `npm ci` online: npm báo `Exit handler never called!` trong môi trường kiểm tra.
- Chưa xác minh `npm run build`, server HTTP, MySQL thật, hoặc E2E.

## Thay đổi
- Collector dùng `fetchPublicUrl` để kiểm tra URL ở mỗi lần chuyển hướng, giới hạn 5 lần, từ chối chuyển domain và URL không an toàn; áp dụng cho HEAD kiểm tra nguồn, HTML collector và generic URL collector.
- Bổ sung `npm run doctor` để chẩn đoán thiếu dependencies trước khi chạy.

## Còn cần làm trước khi production
- Cài dependencies trên máy/CI có mạng bằng `npm ci`.
- Chạy `npm test`, `npm run build`, kiểm thử MySQL và luồng người dùng thật.
- Bảo vệ DNS rebinding/địa chỉ IP private sau DNS resolution ở tầng mạng, egress firewall; kiểm tra tất cả các fetch khác của collector.
- Cấu hình secrets, backup, monitoring và rà soát quyền thu thập từng nguồn.


</details>

### Tài liệu gốc: IMPROVEMENTS.md

<details>
<summary>Nội dung lưu trữ</summary>

# Cải tiến và Tối ưu hóa - RoomĐàNẵng

## 📊 Tổng quan các cải tiến

### ✅ Đã hoàn thành (8/10)

#### 1. Authentication Improvements
- ✅ Email validation với regex
- ✅ Password strength indicator (Yếu/Trung bình/Mạnh/Rất mạnh)
- ✅ Nút hiện/ẩn mật khẩu
- ✅ Loading state khi submit
- ✅ Better error messages

#### 2. Profile Page Enhancements
- ✅ Tabs: Tổng quan, Hoạt động, Cài đặt
- ✅ Edit profile functionality
- ✅ Activity history tracking
- ✅ Join date tracking
- ✅ UI improvements với badges display

#### 3. User Features - Reputation & Badges
- ✅ Hệ thống điểm uy tín (reputation)
- ✅ Huy hiệu tự động:
  - 📝 Nhà sáng tạo (1 bài)
  - ✨ Tích cực (5 bài)
  - 🌟 Cộng đồng viên (10 bài)
  - 💬 Thảo luận viên (10 bình luận)
  - 👍 Hữu ích (5 votes)
  - 🏆 Đáng tin cậy (20 votes)
  - 👁 Kiểm chứng viên (3 báo cáo)
- ✅ User stats tracking

#### 4. UI/UX Improvements
- ✅ Loading spinner components
- ✅ Loading states trong Header, PostDetail
- ✅ Better error states
- ✅ Improved loading messages
- ✅ Mobile responsive improvements

#### 5. Social Media Features
- ✅ Notification Dropdown với badge count
- ✅ Profile Menu Dropdown
- ✅ Reaction System (👍❤️😂😮😢🔥)
- ✅ Improved PostCard với:
  - Author avatar
  - Social action buttons
  - Better visual hierarchy
  - Hover effects
- ✅ Share functionality

#### 6. Performance Optimizations
- ✅ React.memo cho PostCard, ClusterCard, SocialHome
- ✅ useCallback cho event handlers
- ✅ useMemo cho expensive computations
- ✅ Custom useDebounce hook
- ✅ Lazy loading cho images
- ✅ Image optimization config
- ✅ Service Worker cho caching
- ✅ Font preloading
- ✅ Bundle optimization
- ✅ Compression enabled

### ✅ Đã bổ sung sau MVP

- Database schema cho users, community posts/comments, moderation logs, collector runs và notifications.
- Community API ưu tiên MySQL, fallback file khi database offline.
- Admin dashboard cơ bản với số tin theo trạng thái và lỗi collector gần nhất.
- Collector retry, run history, rate limiting cho login/import/collector.
- Advanced listing filters theo giá, diện tích và thứ tự sắp xếp.
- Stale/retention policy cho cache và database.

### ⏳ Còn có thể mở rộng

#### 7. Toast Notification System
- ❌ Toast component
- ❌ Toast context provider
- ❌ Integration với các components

#### 8. Admin Panel Improvements
- ❌ Dashboard UI
- ❌ User management
- ❌ Analytics visualization

## 🚀 Performance Metrics

### Bundle Size Optimization
- **React.memo**: Giảm re-renders cho PostCard, ClusterCard
- **useCallback**: Giảm function recreation
- **useMemo**: Cache expensive computations
- **Code splitting**: Automatic với Next.js dynamic imports
- **Tree shaking**: Unused code removed

### Image Optimization
- **Lazy loading**: Images chỉ load khi visible
- **Modern formats**: AVIF, WebP support
- **Responsive sizes**: Optimal sizes cho devices khác nhau
- **Decoding async**: Non-blocking image rendering

### Caching Strategy
- **Service Worker**: Cache static assets
- **Browser cache**: Leverage HTTP caching
- **LocalStorage**: User data persistence
- **Memoization**: Component-level caching

### Network Optimization
- **Debounce**: Giảm API calls cho search
- **Pagination**: Load data in chunks
- **Optimistic UI**: Instant feedback
- **Error boundaries**: Graceful degradation

## 📱 Responsive Design

### Mobile (< 640px)
- Single column layouts
- Touch-friendly buttons
- Proper spacing
- Collapsible menus
- Optimized images

### Tablet (640px - 1000px)
- 2-column grids
- Adjusted spacing
- Responsive navigation

### Desktop (> 1000px)
- Full grid layouts
- Hover effects
- Dropdown menus
- Maximum content width

## 🔧 Technical Improvements

### Code Quality
- TypeScript strict mode
- ESLint ready
- Consistent naming
- Proper error handling
- DRY principles

### Architecture
- Component composition
- Custom hooks
- Context-ready structure
- API route separation
- Type safety

### Developer Experience
- Hot module replacement
- Fast refresh
- Clear error messages
- Development-only warnings
- Source maps disabled in production

## 📈 Next Steps

### Priority 1 (High)
1. Toast notification system
2. Real-time notifications (WebSocket/SSE)

### Priority 2 (Medium)
1. ✅ Advanced search with filters
2. ✅ Dark mode support
3. ✅ Push notifications (PWA)

### Priority 3 (Low)
1. ✅ Analytics dashboard
2. ✅ User reporting system
3. ✅ Advanced admin features

## 🎯 Key Features Highlight

### Gamification
- Reputation points
- Achievement badges
- User rankings
- Activity streaks

### Social Features
- Real-time reactions
- Comment threads
- Share functionality
- Notification system

### Performance
- < 2s initial load
- < 100ms interaction response
- Smooth 60fps animations
- Offline support

## 📝 Configuration Files

### next.config.ts
- Image optimization
- Bundle optimization
- Compression
- Environment-specific settings

### package.json
- Next.js 16.4.0
- React 19.2.8
- TypeScript 7.0.2
- Production-ready dependencies

### Environment Variables
- Database connection
- Ollama AI endpoint
- Cron job secrets
- Feature flags

## 🔒 Security

- Input validation
- XSS prevention
- CSRF protection
- Secure headers
- Environment variable protection
- Rate limiting ready

## 🌐 SEO & Accessibility

- Meta tags
- Open Graph
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support

---

**Last Updated**: 2026-10-16
**Version**: 0.2.0
**Status**: Production-oriented MVP; cần chạy database migration và cấu hình secret trước khi triển khai production.


</details>

### Tài liệu gốc: PRODUCTION_READINESS.md

<details>
<summary>Nội dung lưu trữ</summary>

# Production readiness / Triển khai thực tế

## Changes in this hardening pass
- User listing writes now persist to MySQL first and return 503 on failure; no silent fallback to local files in production.
- Community post/comment writes fail closed if MySQL is unavailable.
- Community post IDs are generated by the server with UUIDs.
- AI endpoint requires an authenticated session and explicit `ENABLE_AI_ANALYSIS=true` in production.
- Community post list responses are private and not shared-cacheable when admin status changes visibility.
- Social feed authentication is driven by `/api/auth/me`, not stale localStorage.

## Required before accepting real users
1. Configure managed MySQL, apply `database/schema.sql` and migrations, and verify backup/restore. Set `MYSQL_URL`.
2. Configure long random `USER_SESSION_SECRET`, `ADMIN_SESSION_SECRET`, and strong admin credentials. Rotate any secrets previously shared in archives.
3. Verify TLS/HTTPS, secure cookies, domain, rate limits on a shared store (Redis), bot protection, and CSRF/origin protections for state-changing endpoints.
4. Audit remaining routes for file fallback, access control, ID ownership, SQL errors and PII; migrate all production writes to DB.
5. Add monitoring, alerting, logging without PII, retention/deletion policy, and image upload controls.
6. Run `npm ci`, `npm test`, `npm run build`, and browser end-to-end tests with a staging MySQL database.
7. Validate collector permissions and AI request quotas; keep AI disabled unless protected by a shared rate limiter.

**Status: NOT production certified.** This is a targeted hardening pass, not a full security audit or verified deployment.


</details>

## Chuyển sang Aiven MySQL (12/11/2026)

Chọn Aiven MySQL để giữ nguyên mysql2 và SQL hiện có. Gói Free dành cho thử nghiệm nhỏ: 1 GB lưu trữ, 1 GB RAM, 76 kết nối tối đa; không có SLA và có thể tắt khi không hoạt động. Xem [giới hạn chính thức](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier). Chưa tạo dịch vụ hay chuyển dữ liệu trong lượt chỉnh sửa này.

1. Tạo tài khoản tại Aiven Console, tạo dịch vụ MySQL Free và chờ Running. Kiểm tra đúng gói Free trước khi tạo.
2. Lấy Service URI, tên database và tải CA certificate trong Connection information. Đặt MYSQL_URL trong .env.local (không dùng tiền tố NEXT_PUBLIC_). Dùng URL mysql://user:password@host:port/database, bỏ tham số sslmode của công cụ khác. Percent-encode mật khẩu.
3. Đặt MYSQL_SSL=true và MYSQL_SSL_CA_PATH tới đường dẫn tuyệt đối của chứng chỉ CA; trên hosting có thể dùng MYSQL_SSL_CA chứa PEM thay cho đường dẫn. Không tắt xác minh chứng chỉ. Cấu hình này dùng chung cho app, doctor và scripts/db. Xem [TLS Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).
4. Đặt MYSQL_POOL_LIMIT=5 khi thử nghiệm. Giới hạn áp dụng mỗi process; tổng mọi instance và công cụ phải nằm dưới hạn mức dịch vụ.
5. Database mới trống: chạy npm run db:init, npm run db:optimize, npm run doctor. Không cần XAMPP.
6. Nếu cần dữ liệu cũ: tạm dừng ghi, xuất SQL từ database cũ, nhập vào database Aiven đã chọn, rồi chạy các migration còn thiếu và doctor. Dùng mysqldump/phpMyAdmin để sao lưu đầy đủ; db:export-data chỉ xuất seed được chọn, không phải backup đầy đủ. Giữ nguyên bản sao lưu và cấu hình cũ để phục hồi. Chuyển riêng cả data/ chứa ảnh vì ảnh không nằm trong database.
7. Khởi động lại app; thử đăng nhập, đọc phòng, tạo/duyệt bài và kiểm tra /api/health. Chỉ chạy integration test ghi dữ liệu trên database QA riêng.

Các lỗi cần phân biệt: timeout/ECONNREFUSED là host, port hoặc mạng; Access denied là thông tin đăng nhập/quyền; lỗi certificate là CA hoặc hostname; missing tables/columns cần init/migration; Too many connections cần giảm pool/instance. Chưa có tài khoản và endpoint Aiven nên chưa thể xác nhận kết nối cloud hay migration dữ liệu thật thành công.

## Kiểm tra workspace Windows ngày 12/11/2026

Kết quả thực hiện sau khi hợp nhất tài liệu và thêm cấu hình TLS (ưu tiên phần này hơn báo cáo lịch sử):

- `npm test`: 62/62 đạt, gồm 3 kiểm tra cấu hình TLS mới.
- `npm run typecheck`: không đạt. Các API `app/api/files/[id]/content`, `[id]`, `[id]/toggle`, `create`, `list` import các hàm không được export từ `lib/file-storage.ts`: `getManagedJsonFilePath`, `readFileSettings`, `writeFileSetting`. Các API này không được sửa trong lượt chuyển cấu hình database.
- `npm run build`: không đạt, báo thiếu các export quản lý file nói trên.
- `npm run doctor`: dependencies và biến cấu hình bắt buộc đạt; kiểm tra kết nối/cấu hình database thất bại. Chưa xác định là dịch vụ đang tắt, URL/quyền hay schema; không sửa `.env.local` và không chạy migration trên dữ liệu hiện tại.
- Chưa có dịch vụ Aiven/endpoint/CA nên chưa kiểm thử TLS qua mạng, SQL/schema trên Aiven, nhập dữ liệu hay E2E cloud. Chưa thể kết luận chuyển database không có lỗi.


## Chạy lại với XAMPP và phân trang 10 phòng — 12/11/2026

XAMPP cung cấp MySQL/MariaDB; ứng dụng Next.js được build và chạy bằng Node.js, không chép vào htdocs để chạy bằng Apache. Trên máy này đã có C:/xampp, MariaDB 10.4.32, database room_social tại 127.0.0.1:3306. Phiên bản này đã qua doctor và kiểm tra đọc bên dưới; chưa kiểm thử toàn bộ nghiệp vụ trên MariaDB 10.4.

1. Trong XAMPP Control Panel, bật MySQL (nếu đã chạy thì không khởi động thêm). Apache không bắt buộc.
2. Giữ MYSQL_URL trong .env.local trỏ tới database local và thông tin đăng nhập của bạn. Không cần cấu hình CA cho kết nối local hiện tại.
3. Chạy npm run doctor, npm run build, npm start rồi mở http://localhost:3000. Không chạy db:init để thay thế dữ liệu đã có.
4. Bản chạy kiểm tra của lượt này dùng http://127.0.0.1:3011.

Bảng tin /bang-tin và trang quản lý phòng hiển thị tối đa 10 phòng/trang, có nút số trang, trước/sau. Bảng tin thay danh sách khi chuyển trang, không cộng dồn bằng Xem thêm; đổi bộ lọc trở về trang đầu. Trang chủ vẫn là phần giới thiệu một số phòng.

Đã xóa 5 tệp tài liệu dư sau khi lưu nội dung vào phần Tài liệu hợp nhất: CHECK_STATUS.md, IMPROVEMENTS.md, PRODUCTION_READINESS.md, docs/PROJECT-STRUCTURE.md, docs/COLLECTOR-SOURCES.md. Giữ AGENTS.md và CLAUDE.md làm chỉ dẫn công cụ.

Đã sửa build bằng cách chuyển các route trình sửa file cũ về handler FEATURE_RETIRED hiện có: Admin nhận 410, người chưa đăng nhập nhận 401; dùng Nhập JSON/CSV và Cấu hình nguồn thay thế. Không khôi phục trình sửa file đã ngừng hỗ trợ.

Kết quả mới nhất (thay thế kết quả lỗi build/database ở phần trước):
- npm run typecheck: đạt.
- npm run build: đạt, tạo standalone runtime.
- npm test: 62/62 đạt.
- npm run doctor với XAMPP: đạt 23 bảng và cột V17; AI đang tắt.
- Bản production: /api/health trả 200; hai trang API đầu mỗi trang trả 10/33 phòng.
- Edge headless: trang 1 hiển thị 1–10/33, bấm số 2 hiển thị 11–20/33, tổng 4 trang. Ở viewport 390px không tràn ngang.
- Chưa chạy lại toàn bộ E2E ghi dữ liệu/quyền chủ trọ. Không chuyển dữ liệu sang Aiven trong lượt này.


## Chạy nhanh và QA XAMPP mở rộng — 12/11/2026

Bật MySQL trong XAMPP, sau đó chỉ chạy `npm run serve`: tự kiểm tra database, build và chạy production tại http://localhost:3000. Trên Windows có thể mở `chay-web.cmd`. Cần cài dependencies một lần bằng npm ci. Dừng server cũ bằng Ctrl+C trước khi build lại để tránh EBUSY trên Windows. Khi không sửa code, dùng npm start để chạy bản đã build; khi phát triển dùng npm run dev. Không tự tạo/xóa database trong lệnh chạy nhanh.

Gói standalone loại trừ database/mysql-data (các tệp dữ liệu MySQL thô); chỉ mang schema/migration/seed cần thiết.

### Kết quả xác minh mới

- 736 kiểm tra API qua 9 nhóm: flow 50, management 115, deletions 93, sessions 121, mutations 31, workflow-conflicts 60, photos 39, content 140, collector 87. Tất cả đạt trên database QA riêng trong XAMPP.
- 32 kiểm tra trình duyệt quản lý phòng đạt; kiểm tra axe desktop/mobile không có vi phạm trong các màn hình đã thử.
- Sau sửa collector: 65 unit test, TypeScript và production build đạt; chạy lại 87 kiểm tra collector đạt.
- Nhập 120 tin tổng hợp và SELECT trực tiếp xác nhận đủ 120 bản ghi needs_review trong MySQL QA. Database chính giữ 33 phòng; không dùng dữ liệu chính cho kiểm thử ghi/xóa.
- Database chính ghi nhận 13 tin nguồn Phongtro123, 15 tin nguồn Trọ Mới và 5 tin mẫu nội bộ. Nhãn nguồn không chứng minh tin còn mới hay nguồn vẫn truy cập được hôm nay.
- Bản production mới tại cổng 3011 trả health 200 và API danh sách 200.

### Cào nhiều trang và lưu database

Trong Admin, nhập URL nguồn công khai được phép sử dụng rồi chọn tối đa 1/3/5/10/20/30/50 trang. Crawler theo liên kết trang kế tiếp cùng domain; sửa lỗi lấy nhầm liên kết trang cuối trong thanh số trang. Không tự sinh URL trang không tồn tại, không vượt đăng nhập/CAPTCHA hoặc robots.

Phân tích URL chỉ tạo preview, chưa ghi database. Bấm nhập preview vào hàng chờ duyệt để lưu MySQL; tối đa 500 tin/lượt, thay mức 100 trước đây. Giới hạn nhập file vẫn 2 MB. Chỉ thông báo thành công khi persistence.status là saved. Tin mới chờ Admin duyệt trước khi công khai. Collector chạy các nguồn đã cấu hình có đường lưu riêng qua cùng pipeline MySQL.

Kiểm tra mở rộng 50 trang dùng dữ liệu mạng giả lập; kiểm tra persistence dùng MySQL thật trong XAMPP. Chưa xác minh cào 50 trang trên từng website ngoài thực tế hoặc độ chính xác của model AI thật. Đây là các bộ kiểm thử có kịch bản, không phải bảo đảm không còn lỗi ở mọi trường hợp.

## Bộ chạy đầy đủ: Web + MySQL + Ollama

Cài Node.js >=22.13 và Docker Desktop (bật Linux containers), mở Docker Desktop rồi chạy `npm run stack:up` hoặc mở `chay-tat-ca.cmd` trên Windows. Không cần cài XAMPP, Ollama hay npm ci trên máy host cho cách chạy này; dependencies được cài trong Docker build.

Lệnh tạo `.env.docker` với mật khẩu/secret ngẫu nhiên, dựng MySQL 8.4, khởi tạo schema, chạy Ollama và tự tải model `llama3.2:3b`, sau đó chạy web tại http://localhost:3000. Lần đầu cần mạng và dung lượng cho Docker images/model (model hiện khoảng 2 GB); tải model trên CPU có thể lâu. Đọc ADMIN_EMAIL/ADMIN_PASSWORD trực tiếp trong `.env.docker` để đăng nhập. Không chia sẻ hoặc commit file này. Không ghi đè `.env.local` của XAMPP.

- `npm run stack:status`: xem tình trạng; `npm run stack:logs`: xem log web.
- `npm run stack:down`: dừng, giữ database/model/ảnh trong Docker volumes. Không thêm `-v` nếu muốn giữ dữ liệu.
- Đổi WEB_PORT trong `.env.docker` nếu cổng 3000 đang dùng. Web chỉ mở trên localhost; MySQL và Ollama nằm trong mạng Docker nội bộ.
- Đổi OLLAMA_MODEL trong `.env.docker`, rồi chạy lại stack:up để tải model mới. AI được bật mặc định cho database Docker mới; kiểm tra trong Admin → Cấu hình. CPU chậm có thể vượt timeout phân tích 20 giây hiện tại.
- Docker tạo database mới; không tự nhập 33 phòng từ XAMPP hoặc dữ liệu/tài khoản cá nhân. Muốn chuyển dữ liệu cần backup/restore riêng.

Repository chứa mã, schema, migrations, cấu hình và script tải dịch vụ/model. Không chứa binary Ollama, model 2 GB, node_modules, database thô, ảnh người dùng hay mật khẩu. Dùng [Docker image chính thức của Ollama](https://ollama.com/blog/ollama-is-now-available-as-an-official-docker-image). Máy phát triển hiện chưa cài Docker nên cấu hình Compose chưa được chạy kiểm thử end-to-end; các kiểm thử XAMPP phía trên vẫn là kết quả đã xác minh.
