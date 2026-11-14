# Room Đà Nẵng

Ứng dụng cộng đồng tìm phòng trọ tại Đà Nẵng, xây dựng bằng **Next.js, React và MySQL**. Người xem có thể tìm phòng và xem thảo luận; thành viên có thể lưu phòng, nhắn tin và hẹn lịch xem; chủ trọ gửi tin để quản trị viên kiểm duyệt.

## Dự án có gì?

- Tìm kiếm, lọc và xem tin phòng; đăng ký, đăng nhập và quản lý hồ sơ.
- Thành viên lưu tin, thảo luận, nhắn tin riêng và lên lịch xem phòng.
- Chủ trọ đã xác minh quản lý tin của mình; quản trị viên duyệt nội dung, quản lý tài khoản và nguồn thu thập dữ liệu.
- API ứng dụng nằm trong `app/api/`; schema và các migration cơ sở dữ liệu nằm trong `database/`.

### Công nghệ và dữ liệu

| Thành phần | Công nghệ / vị trí |
| --- | --- |
| Giao diện và API | Next.js 16, React 19, TypeScript |
| Lưu dữ liệu chính | MySQL 8+ hoặc MariaDB 10.11+ |
| Kết nối database | Node.js `mysql2`; cấu hình bằng `MYSQL_URL` |
| Ảnh tải lên | Lưu trong bảng `listing_images` của MySQL, không phải thư mục XAMPP |
| Cache và một số dữ liệu runtime/fallback | Thư mục `data/` trên máy chạy ứng dụng |

Ứng dụng **không cần PHP, Apache hay XAMPP**. XAMPP chỉ là một lựa chọn để chạy MySQL trên máy cá nhân. Có thể thay bằng MySQL/MariaDB cài trực tiếp, MySQL trong Docker, hoặc database MySQL managed/online. Một ứng dụng khác cũng có thể đọc database bằng driver MySQL; xem mục [Đọc dữ liệu bằng ứng dụng khác](#đọc-dữ-liệu-bằng-ứng-dụng-khác).

## Chạy lần đầu

Yêu cầu: Node.js **22.13 trở lên**, npm và một trong các lựa chọn database bên dưới. Clone repo, mở terminal tại thư mục dự án:

```sh
git clone https://github.com/Hung-37/room-social-danang.git
cd room-social-danang
npm ci
```

### Cách A — Docker Compose (không cần cài XAMPP/MySQL riêng)

Cần Docker Desktop hoặc Docker Engine đang chạy. Trên Windows, có thể chạy lệnh npm trong PowerShell:

```powershell
npm run stack:up
npm run stack:status
```

`stack:up` tạo `.env.docker` với mật khẩu/secret ngẫu nhiên, khởi động MySQL và ứng dụng web, rồi khởi tạo schema. Mở `http://localhost:3000`. Thông tin tài khoản Admin khởi tạo nằm trong `.env.docker`; giữ kín file này.

Các lệnh tiện ích:

```powershell
npm run stack:logs
npm run stack:down
```

`stack:down` dừng dịch vụ nhưng giữ volume database và dữ liệu runtime. **Không xóa volume** nếu chưa sao lưu dữ liệu. Đổi `WEB_PORT` trong `.env.docker` nếu cổng 3000 đã được sử dụng.

### Cách B — Dùng MySQL/MariaDB đã có sẵn

Tạo database `room_danang` với charset `utf8mb4`, sau đó tạo `.env.local` từ file mẫu:

```powershell
Copy-Item .env.example .env.local
```

Sửa các giá trị phù hợp trong `.env.local`:

```dotenv
MYSQL_URL=mysql://USER:PASSWORD@127.0.0.1:3306/room_danang
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=thay-bang-mat-khau-manh
ADMIN_SESSION_SECRET=thay-bang-chuoi-ngau-nhien-it-nhat-32-ky-tu
USER_SESSION_SECRET=thay-bang-chuoi-khac-it-nhat-32-ky-tu
```

Hai session secret phải khác nhau. Mật khẩu có ký tự đặc biệt trong `MYSQL_URL` cần percent-encode. Không commit `.env.local` hoặc chia sẻ secret. Nếu dùng database managed yêu cầu TLS, xem các biến `MYSQL_SSL`, `MYSQL_SSL_CA_PATH` và `MYSQL_SSL_CA` trong `.env.example`.

Khởi tạo schema và chạy ứng dụng:

```powershell
npm run db:init
npm run db:optimize
npm run doctor
npm run dev
```

Mở `http://localhost:3000`. Chế độ phát triển chỉ cần `npm run dev`; để tạo và chạy bản production dùng `npm run build` rồi `npm start`. Database mới không được tự nạp dữ liệu mẫu; xem mục [Dữ liệu mẫu](#dữ-liệu-mẫu).

## Đọc dữ liệu bằng ứng dụng khác

Không bắt buộc dữ liệu phải đi qua XAMPP. Bất kỳ công cụ nào hỗ trợ MySQL, chẳng hạn DBeaver, MySQL Workbench, Metabase hoặc chương trình dùng Python/Node.js/Java, đều có thể kết nối trực tiếp nếu được cấp thông tin kết nối và quyền truy cập mạng.

- Với ứng dụng chạy cùng máy, dùng host/port database trong `MYSQL_URL` (thường là `127.0.0.1:3306`).
- Với database online, dùng thông tin kết nối/TLS do nhà cung cấp cấp và chỉ cho phép IP của ứng dụng cần kết nối.
- Cấu trúc bảng hiện tại được mô tả trong `database/schema.sql`; các thay đổi phiên bản nằm trong `database/migrations/` và các file migration ở `database/`.
- Dùng tài khoản **chỉ đọc** cho báo cáo/BI; không dùng tài khoản ứng dụng có quyền ghi nếu chỉ cần xem dữ liệu. Không mở MySQL công khai cho mọi IP.
- Có thể dùng API trong `app/api/` nếu muốn giữ quy tắc phân quyền/nghiệp vụ của ứng dụng. Không coi cấu trúc bảng nội bộ là API ổn định; tránh sửa trực tiếp dữ liệu ứng dụng bằng SQL.

Schema dùng cú pháp MySQL/MariaDB và phụ thuộc `mysql2`. PostgreSQL, SQLite hoặc một loại database khác **không thay thế trực tiếp được**; cần chuyển đổi schema và sửa lớp truy cập dữ liệu trước.

## Sao lưu và chuyển sang máy khác

Mã nguồn trong Git không chứa database, mật khẩu, ảnh người dùng hoặc dữ liệu runtime. `.env.local`, `.env.docker`, `database/mysql-data/` và phần lớn `data/` được loại khỏi Git. Vì vậy clone repo trên máy khác chỉ lấy được mã nguồn; muốn có lại dữ liệu cần sao lưu/chuyển riêng:

1. **Database:** xuất database từ MySQL/XAMPP hoặc máy nguồn thành SQL dump bằng `mysqldump` hoặc chức năng Export trong phpMyAdmin/MySQL Workbench. Dump database bao gồm các bảng ứng dụng và ảnh tải lên trong `listing_images`.
2. **Runtime files:** nếu cần giữ cache collector, trạng thái fallback/cấu hình cục bộ hoặc lịch sử runtime dạng JSON, sao chép thư mục `data/` của máy nguồn. Không chép đè `data/fixtures/` nếu muốn giữ fixture theo repo. Một số cấu hình/lịch sử ở production được lưu trong MySQL; không phải mọi file JSON đều là nguồn dữ liệu chính.
3. **Cấu hình:** cài ứng dụng và database trên máy đích, tạo `.env.local` hoặc cấu hình biến môi trường mới; đặt `MYSQL_URL` trỏ tới database đích. Giữ session secrets cũ nếu cần duy trì phiên đăng nhập hiện có; truyền secrets an toàn, không qua Git/chat.
4. **Khôi phục:** tạo database đích, nạp SQL dump bằng công cụ MySQL, triển khai các migration còn thiếu theo thứ tự ở phần bên dưới, sao chép `data/` cần giữ, rồi chạy `npm run doctor`.

Ví dụ xuất database MySQL cục bộ (nhập mật khẩu khi được hỏi, không ghi mật khẩu vào lệnh):

```sh
mysqldump --single-transaction --default-character-set=utf8mb4 -u USER -p room_danang > room_danang.sql
```

Trên máy đích, tạo database rỗng trước rồi nhập dump:

```sh
mysql -u USER -p -e "CREATE DATABASE room_danang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u USER -p room_danang < room_danang.sql
```

Các lệnh ví dụ dùng shell macOS/Linux/Git Bash; trên Windows có thể dùng terminal MySQL, MySQL Workbench hoặc phpMyAdmin để Export/Import. Với Docker Compose, database nằm trong Docker volume, không nằm trong repo; cần sao lưu volume/database riêng trước khi chuyển máy. Chỉ sao chép thư mục runtime khi ứng dụng đã dừng hoặc khi đã bảo đảm file không bị ghi đồng thời.

## Nâng cấp database hiện có

Sao lưu trước khi nâng cấp. Trên database cũ, chạy các migration còn thiếu theo thứ tự:

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

Không cần chạy lại migration đã áp dụng; `doctor` kiểm tra kết nối và một phần schema bắt buộc. Không dùng database production cho kiểm thử có ghi dữ liệu.

## Cấu trúc repo

```text
app/          Trang Next.js và API routes
components/   Thành phần giao diện dùng chung
lib/          Truy cập database, xác thực và nghiệp vụ
database/     Schema, migration, index và seed tùy chọn
data/         Runtime/cache cục bộ; data/fixtures/ dành cho mẫu
public/       Tài nguyên tĩnh
scripts/      Khởi chạy, kiểm tra và tác vụ database
tests/        Unit, integration và browser tests
```

## Kiểm tra

```sh
npm test
npm run typecheck
npm run build
```

Các bộ kiểm thử integration/browser có thể cần database QA và cấu hình riêng. Chỉ chạy test có ghi/xóa dữ liệu trên database QA riêng, không dùng database thật.

## Dữ liệu mẫu

Các seed trong `database/seeds/` và lệnh `npm run db:seed-demo` là tùy chọn; không tự chạy khi khởi động. Dữ liệu mẫu không đại diện cho tin thật hoặc tình trạng phòng hiện tại. Chỉ nhập khi cần thử nghiệm và kiểm duyệt lại.

## Khắc phục nhanh

| Vấn đề | Kiểm tra |
| --- | --- |
| Database không kết nối | Kiểm tra MySQL đang chạy, `MYSQL_URL`, thông tin đăng nhập, cổng và quyền truy cập mạng. |
| `/api/health` báo lỗi | Chạy `npm run doctor`; xác nhận đã init schema và chạy migration cần thiết. |
| Không đăng nhập được Admin | Kiểm tra `ADMIN_EMAIL`/`ADMIN_PASSWORD` của đúng môi trường; chế độ Docker đọc giá trị trong `.env.docker`. |
| Không còn ảnh hoặc dữ liệu sau khi chuyển máy | Database dump có chứa dữ liệu bảng/ảnh; kiểm tra đã import đúng database. Nếu cần cache/fallback cục bộ, sao chép thêm `data/`. |
| Cổng 3000 đang bận | Dừng tiến trình đang dùng cổng hoặc đổi `PORT` (chạy trực tiếp) / `WEB_PORT` (Docker). |
