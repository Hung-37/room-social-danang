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

## Giai đoạn 2 — production và so sánh local (22/11/2026)

### Phạm vi và an toàn

Production được mở tại `https://fantastic-rebirth-production-9b02da1f.up.railway.app/`.
Trang chủ trả HTTP 200; lần đo xác minh cuối là 370 ms. Đã kiểm tra 23 route template
(18 route phía người dùng, 5 route admin) ở 7 viewport: 320, 375, 430, 768,
1024, 1280 và 1440 px. Có 20 route tĩnh và 4 URL động cụ thể được phát hiện từ
liên kết công khai; tổng cộng 168 lượt xem. Không đoán ID, không đăng nhập, không
gửi form, không ghi dữ liệu, không chạy crawler và không deploy. Script chặn mọi
request khác GET/HEAD; có 0 lần thử ghi.

### Kiểm kê route và kết quả production

Responsive = 7 viewport đã kiểm tra cho các URL public; `0 tràn` là không thấy
document horizontal overflow. Với trang bị chuyển hướng hoặc yêu cầu quyền, đây
chỉ là kết quả của trạng thái khách, không xác nhận giao diện sau đăng nhập.

| Route | Vai trò | Production | Local | Responsive | Kết quả |
|---|---|---|---|---|---|
| `/` | Khách | 200 | Đã có audit local đại diện | 7 cỡ | 0 tràn; menu mobile mở nhưng hiển thị thành dải link chưa được style |
| `/bang-tin` | Khách | 200 | Đã audit local, gồm truy vấn tìm kiếm | 7 cỡ | 0 tràn; danh sách và bộ lọc công khai hiển thị |
| `/bai/[id]` | Khách | 2 URL public, 200 | Fixture detail | 7 cỡ/URL | 0 tràn; accessibility có lỗi tên nhãn ảnh bìa |
| `/cum` | Khách | 200 | Chưa audit local | 7 cỡ | 0 tràn; trạng thái công khai |
| `/cum/[id]` | Khách | 2 URL public, 200 | Chưa audit local | 7 cỡ/URL | 0 tràn; trang public |
| `/khu-vuc` | Khách | 200 | Chưa audit local | 7 cỡ | 0 tràn; trạng thái công khai |
| `/thao-luan` | Khách | 200 | Chưa audit local | 7 cỡ | 0 tràn; trạng thái công khai |
| `/quy-dinh` | Khách | 200 | Chưa audit local | 7 cỡ | 0 tràn; trạng thái công khai |
| `/dang-nhap` | Khách | Chuyển tới `/?openLogin=true` | Chưa audit local | 7 cỡ | Chưa xác minh form đăng nhập; không gửi dữ liệu |
| `/dang-ky` | Khách | Chuyển tới `/?openRegister=true` | Chưa audit local | 7 cỡ | Chưa xác minh form đăng ký; không gửi dữ liệu |
| `/bai-viet-cua-toi` | Đăng nhập | Shell khách; API 401 | Chưa audit local | 7 cỡ | Chưa xác minh nội dung riêng tư |
| `/dang-phong` | Đăng nhập/chủ trọ | Shell khách; API 401 | Chưa audit local | 7 cỡ | Chưa xác minh form và quyền chủ trọ |
| `/lich-xem-phong` | Đăng nhập | Shell khách; API 401 | Đã audit fixture local | 7 cỡ | Chưa xác minh dữ liệu/lịch thật |
| `/profile` | Đăng nhập | Shell khách; API 401 | Đã audit fixture local | 7 cỡ | Chưa xác minh hồ sơ thật |
| `/quan-ly-phong` | Chủ trọ | Shell khách; API 401/403 | Đã audit fixture local | 7 cỡ | Chưa xác minh danh sách thật |
| `/quan-ly-phong/[id]` | Chủ trọ | Không có ID public để mở hợp lệ | Chưa audit local | Chưa thể kiểm tra | NOT VERIFIED; không đoán ID hoặc vượt quyền |
| `/thong-bao` | Đăng nhập | Shell khách; API 401 | Đã audit fixture local | 7 cỡ | Chưa xác minh thông báo thật |
| `/tin-nhan` | Đăng nhập | Shell khách; API 401 | Chưa audit local | 7 cỡ | Chưa xác minh hội thoại |
| `/admin` | Admin | Chuyển tới `/?openLogin=true` | Guest redirect fixture | 7 cỡ | NOT VERIFIED; dashboard không được mở |
| `/admin/cau-hinh` | Admin | Chuyển tới login | Chưa audit local | 7 cỡ | NOT VERIFIED |
| `/admin/chu-tro` | Admin | Chuyển tới login | Chưa audit local | 7 cỡ | NOT VERIFIED |
| `/admin/nguoi-dung` | Admin | Chuyển tới login | Chưa audit local | 7 cỡ | NOT VERIFIED |
| `/admin/tin-nhan` | Admin | Chuyển tới login | Chưa audit local | 7 cỡ | NOT VERIFIED |

Local audit trước đó bao phủ 9 đường dẫn đại diện × 7 viewport (63 lượt xem),
21 fixture layout, 29 axe scans, không phát hiện overflow hoặc lỗi JavaScript.
Đó không phải kiểm tra local đủ 23 trang; dữ liệu DB và quyền QA vẫn chưa có.

### Lỗi và khác biệt đã quan sát

| Trang | Viewport | Lỗi | Mức độ | File liên quan | Trạng thái |
|---|---|---|---|---|---|
| Trang chủ production | 320–768 | Menu mở thành hàng link thô; ở 375px nút hamburger không có glyph nhìn thấy nên khó nhận ra | Cao | Production chưa xác định; local WIP tại `components/Header.tsx`, `app/styles/header.css` | Chỉ quan sát; local có menu được style, chưa deploy |
| Trang chủ production | 375 | Axe `color-contrast` nghiêm trọng tại nội dung `.area-schools` | Serious | Bản production; không xác định chính xác commit đang chạy | Chưa sửa production; local audit hiện tại không tái hiện |
| Chi tiết bài production | 7 cỡ × 2 URL | Axe `label-content-name-mismatch` nghiêm trọng ở `.detail-cover` | Serious | Production chưa xác định; `components/RoomPhotoGallery.tsx` | Local đã sửa `aria-label` để chứa chữ “Xem ảnh đầy đủ”; production chưa deploy/xác minh |
| Các trang được chuyển hướng | 320–1440 | 401/403 từ API phiên, yêu thích và dữ liệu cá nhân | Thông tin | API production, ngoài phạm vi UI | Mong đợi cho khách; không 5xx, không sửa |
| Production và local | Mọi cỡ | Hero/search trên home khác đáng kể; production hiển thị bản cũ hơn giao diện local | Cao | Phiên bản deploy chưa xác minh | Không suy đoán commit; không deploy theo yêu cầu |

Menu được bấm mở ở 320/375/430/768px; tại 1024px nút menu mobile không hiện,
phù hợp điều hướng desktop. Production home/feed/detail đã được xem bằng ảnh thực;
không kết luận các heuristic cắt text/chồng lấn của script là lỗi đã xác minh
(nhiều kết quả là `.sr-only` hoặc mô tả card chủ ý giới hạn dòng). Console ghi
nhận các lỗi tương ứng với response 401/403; có 0 lỗi page-level JavaScript,
0 request thất bại ở transport và 0 response 5xx.

Ảnh production được giữ ở thư mục `work/production-audit/` bị Git ignore vì ảnh
chứa nội dung tin đăng công khai; report máy: `../work/production-audit/report.json`.
Ví dụ: [home 375](../work/production-audit/home--375.png),
[menu mở 375](../work/production-audit/home-menu-open--375.png),
[bảng tin 375](../work/production-audit/bang-tin--375.png). Đây là ảnh local-only,
không được đưa vào commit.

### Kiểm thử cập nhật

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Unit tests | PASS | 73/73 |
| TypeScript | FAIL | 4 import thiếu trong các worktree nằm dưới `work/`; không sửa/xóa worktree theo rào chắn |
| Build | FAIL | Compile được; dừng tại cùng lỗi TypeScript trong `work/` |
| Playwright production | PASS có giới hạn | 168 lượt xem; không thao tác ghi; trang cần quyền chưa xác minh |
| Playwright local UI | FAIL khi chạy lại sau sửa nhỏ | Edge bị sandbox đóng; lần chạy quyền thường lệ sau đó không kết nối được máy chủ local ở `127.0.0.1:3033`, nên không tính là audit lại thành công. Kết quả 63 lượt bên trên là audit trước đó |
| Header audit local | PASS phạm vi header | 12 layout; menu/dialog/focus không được thay đổi trong giai đoạn production audit |
| Accessibility production | FAIL | 154 violation records mức serious trên 10 lượt route có vi phạm; thuộc 2 rule duy nhất: contrast và tên nhãn cover; có kết quả lặp khi route chuyển về home |
| Responsive production | PASS giới hạn | 0 horizontal overflow trên 168 lượt; menu home có lỗi trình bày đã ghi nhận |
| `npm run lint` | NOT RUN | Không có script lint trong `package.json` |

`npm test`, typecheck và build được chạy lại trong lượt này. Sau khi chỉnh nhãn
ảnh, lần thử audit Playwright local không hoàn tất do Edge/server local không kết
nối; vì vậy sửa nhãn chưa có kết quả axe sau sửa. Build local có lần đầu
bị sandbox chặn tạo junction `sharp`; lần chạy được cấp quyền tiếp tục compile rồi
thất bại ở các import trong worktree. Không thay đổi `next-env.d.ts` sau build.

### Xác minh phạm vi và việc tiếp theo

Trong lượt kiểm tra production, không sửa backend, API, DB, routes, nghiệp vụ,
dependencies hay cấu hình deploy. Không đăng nhập hoặc ghi dữ liệu và không deploy.
Các thay đổi giao diện/header đang có trong working tree là WIP từ trước; không
được tính là thay đổi mới của lượt này. Script audit production mới
`tests/browser/production-readonly.cjs` và báo cáo này là phần bổ sung của lượt.

Để kết thúc kiểm tra các trang private cần tài khoản QA được cấp quyền hợp lệ và
một môi trường dữ liệu QA. Cần xác định commit/version production và xử lý hai
lỗi accessibility trên đúng source đang deploy trước khi có thể xác nhận bản live
đã hết lỗi. Typecheck/build cần xử lý riêng các import thiếu trong worktree; theo
yêu cầu, không sửa phạm vi TypeScript hay xóa worktree ở đây.

## Giai đoạn 3 — sửa lỗi còn lại và xác minh local (22/11/2026)

### Trạng thái trước khi làm

Working tree đã có WIP từ các lượt trước ở header/layout/admin, `tests/browser`,
`docs/ui-review.md` và các screenshot header. Giữ nguyên các thay đổi đó; không
reset, commit, deploy hoặc xóa worktree. Trong lượt này, không đổi thứ tự menu,
logic mở/đóng, focus trap, xử lý route hoặc cấu hình giao diện tổng thể.

### Sửa và xác minh

| Khu vực | Kết quả | Thay đổi |
|---|---|---|
| Menu mobile | PASS | Giao diện local có drawer và icon đã được thêm trong WIP trước đó. Audit guest/member ở 320, 375, 390, 430, 768, 1024, 1440 px: 14 layout, 24 axe scans, không overflow/lỗi console; 5 nhóm keyboard/focus/route/resize đều đạt. 1024 px dùng menu desktop như thiết kế. |
| Nội dung menu | PASS | Kiểm tra bounds từng link nằm trong viewport, không cắt chữ, không chồng dọc. Thứ tự navigation không đổi. Test xác nhận Escape, nút đóng, backdrop, route change, resize lên desktop, focus trap và trả focus về nút mở. Focus bàn phím có outline rõ. |
| Trang chủ / tương phản | PASS local | `.area-schools` dùng `--muted: #526b75` trên card trắng `#fff`, tỷ lệ 5.65:1; đạt WCAG AA cho text thường. Không đổi màu vì lỗi production không tái hiện trong theme local. Bản production có thể chạy source cũ; không deploy. |
| Gallery detail | PASS fixture tập trung | Xóa `aria-label` ghi đè trên nút ảnh để tên truy cập được ghép từ alt ảnh cùng nhãn/bộ đếm hiển thị, tránh mismatch khi ảnh lỗi và fallback “Ảnh chưa tải được” xuất hiện. Không đổi click/open, thumbnails, nguồn ảnh hay dữ liệu. Axe không còn `label-content-name-mismatch`; nút mở dialog và Escape đóng dialog thành công ở 375×844. |
| Giao diện các route khác | NOT VERIFIED đầy đủ | Đã thử chạy lại `ui-redesign.cjs`, nhưng Next dev dừng giữa lượt kiểm tra sau khi hiển thị cảnh báo bảo mật; các lượt sau nhận `ERR_CONNECTION_REFUSED`. Không tính audit toàn route là PASS. Audit 63 lượt/9 đường dẫn từ giai đoạn 2 là kết quả trước đó, không phải kiểm tra lại sau sửa. |

Ảnh local sau sửa: [menu 320 mở](../work/phase3-browser-app/work/header-phase3-verified/guest-320-open.png),
[menu 375 mở](../work/phase3-browser-app/work/header-phase3-verified/guest-375-open.png),
[chi tiết phòng 375](../work/phase3-browser-app/work/room-photo-a11y-final/detail-375.png).
Ảnh đối chiếu production trước sửa menu: [menu production 375](../work/production-audit/home-menu-open--375.png).
Các ảnh/report giữ trong `work/` bị Git ignore và không được commit.

### Kiểm thử

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `npm test` | PASS | 73/73, chạy lại sau sửa gallery |
| `npm run typecheck` | FAIL | Bốn lỗi đều trong worktree dưới `work/`; xem chẩn đoán bên dưới |
| `npm run build` | FAIL | Turbopack compile thành công; dừng ở cùng bốn lỗi TypeScript. Lần chạy thường lệ trước đó bị chặn tạo junction `sharp`; lần chạy tiếp theo vượt qua giới hạn này |
| Header Playwright | PASS | 14 layout guest/member, 24 axe scans, 5 nhóm assertion, 0 overflow, 0 page errors; widths gồm đủ 320/375/390/430/768/1024 |
| Gallery + axe Playwright | PASS | Fixture fallback ảnh ở 375×844; tên truy cập gồm nhãn hiển thị và counter, 0 axe violation, mở/đóng gallery hoạt động |
| Full `ui-redesign.cjs` | NOT VERIFIED | Các lần chạy bị server local dừng giữa chừng; không báo PASS |
| Accessibility trang chủ | PASS local | Header audit không có axe violations; `.area-schools` đạt contrast 5.65:1 trên nền card |
| `git diff --check` | PASS | Chỉ có cảnh báo CRLF của Git, không có whitespace error |

### Chẩn đoán TypeScript/build

`tsconfig.json` có `include` là `**/*.ts` và `**/*.tsx`, nhưng `exclude` chỉ có
`node_modules`; do đó các checkout lồng trong `work/` cũng được nạp vào chương
trình TypeScript. Các import `@/*` của những file đó tiếp tục dùng alias root
`./*` của repo chính thay vì thư mục tương ứng trong worktree. `--explainFiles`
đã xác nhận file từ nhiều worktree được đưa vào chương trình.

Lỗi hiện tại:

- `work/fix-production-qa/app/api/auth/register/route.ts`,
  `work/fix-register-diagnostics/app/api/auth/register/route.ts` và
  `work/railway-stabilization/app/api/auth/register/route.ts`: không tìm thấy
  `@/lib/server/register-diagnostics.js`.
- `work/ui-polish/app/admin/AdminCollectorClient.tsx`: không tìm thấy
  `@/components/FormField`.

Build đã compile source thành công trước bước typecheck; không có lỗi TypeScript
khác được báo từ ứng dụng chính. Cách sửa tối thiểu để xem xét riêng là thêm
`work/**` vào `exclude` của `tsconfig.json`; lượt này không thay đổi cấu hình.

### Phạm vi Git và giới hạn

Thay đổi thuộc lượt này: `components/RoomPhotoGallery.tsx`,
`tests/browser/header.cjs`, `tests/browser/ui-redesign.cjs`, thêm
`tests/browser/room-photo-accessibility.cjs` và mục báo cáo giai đoạn 3. CSS
header/menu và nội dung backend không đổi trong lượt này; các thay đổi ở
`app/layout.tsx`, `app/styles/admin.css`, `components/Header.tsx` và screenshot
header đã tồn tại từ WIP trước.

Không sửa backend/API/database/auth/authorization/business logic/routes/dependency
hoặc `tsconfig.json`; không ghi production, không commit và không deploy. Next.js
hiện tại phát thông báo advisory bảo mật và ngắt dev server trong quá trình audit.
Không nâng dependency vì yêu cầu giai đoạn này cấm thay đổi dependency.

## Giai đoạn 4 — thiết kế lại pagination và xác minh local (22/11/2026)

### Thay đổi

Chuẩn hóa pagination dùng chung và các bộ phân trang độc lập ở trang quản trị người dùng, bài viết của tôi, collector và bài cộng đồng. Điều chỉnh spacing, trạng thái hover/disabled/current, focus ring và vùng bấm tối thiểu 44px; mobile thu gọn nút trước/sau thành mũi tên nhưng giữ aria-label, đồng thời vẫn hiển thị trang đầu, hiện tại và cuối ở pager nhiều trang. Thêm `nav` có nhãn truy cập và chip trạng thái trang hiện tại cho các pager độc lập. Không đổi phép tính trang, offset, callback, API, query/filter/sort, route hoặc dữ liệu.

File pagination: `components/ManagementPager.tsx`, `app/styles/management.css`, `app/styles/admin-controls.css`, `app/admin/nguoi-dung/UsersClient.tsx`, `app/bai-viet-cua-toi/OwnedPosts.tsx`, `app/admin/AdminCollectorClient.tsx`; test mới `tests/browser/pagination.cjs`. `AdminCollectorClient.tsx` còn một hunk xóa comment cũ không liên quan trong WIP; hunk đó không thuộc pagination và không được stage.

Ảnh kiểm tra: [pagination mobile 375px](../work/pagination-audit-phase4/many-pages-mobile-375.png), [pagination desktop 1280px](../work/pagination-audit-phase4/many-pages-desktop-1280.png). Ảnh nằm trong `work/` bị ignore, không đưa vào Git.

### Kết quả kiểm thử

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Browser pagination | PASS | 21 kịch bản: 320, 375, 430, 768, 1024, 1280, 1440px × 1, 2, 10 trang. Không tràn ngang; trạng thái nút đầu/cuối, trang hiện tại, chuyển tới trang 5, và query/filter được giữ qua request + back navigation. |
| axe pagination | PASS | 0 violations tại 320, 768, 1440px. |
| `npm test` | PASS | 73/73. |
| `npm run typecheck` | FAIL | Bốn lỗi import thiếu vẫn chỉ ở các worktree dưới `work/`; không phát hiện lỗi từ phần pagination trong output. |
| `npm run build` | FAIL | Lần sandbox thường bị Windows từ chối tạo junction `sharp`. Lần chạy được cấp quyền biên dịch thành công, rồi dừng tại cùng bốn lỗi TypeScript trong worktree. |
| `git diff --check` | PASS | Không có whitespace error; Git chỉ cảnh báo chuẩn hóa LF/CRLF. |

Playwright phải chạy ngoài sandbox do Edge headless bị Crashpad pipe đóng trong lần sandbox; lần chạy local được cấp quyền đã hoàn tất đủ 21 kịch bản. Server chỉ phục vụ localhost và API được giả lập bởi fixture trình duyệt, không gọi production.

### Phạm vi Git

Chỉ các hunk pagination trong các file liệt kê ở trên và test `tests/browser/pagination.cjs` thuộc thay đổi Phase 4. WIP từ các giai đoạn trước trong `docs/ui-review.md`, `AdminCollectorClient.tsx` và các file khác được giữ nguyên; không commit các hunk đó. Không deploy hoặc thay đổi backend, API, database, auth, route, nghiệp vụ, dependency hay cấu hình build.

### Cập nhật sau yêu cầu deploy production (22/11/2026)

Người dùng sau đó cho phép push/deploy để cập nhật giao diện. Vì Railway đang theo dõi `railway-production`, tạo commit `6e9b300` trên base `4ec419f` của nhánh đó, chỉ mang đúng 7 file pagination/test; Dockerfile và `.dockerignore` của production được giữ nguyên. Push fast-forward thành công. Railway deployment `90f9f9a8-83b3-4b5b-809e-9572d57cf53b` hoàn tất build và ở trạng thái Active; healthcheck `/api/health` thành công.

Đã mở production `/bang-tin`: pagination hiển thị 1–10/136, sau khi bấm Trang 2 hiển thị 11–20/136 và trang 2 được đánh dấu hiện tại. Log startup ghi “Database schema initialized. Existing tables and data were preserved.” Không reset volume hoặc database. Ảnh production đã xem trong phiên trình duyệt; ảnh không được lưu vào repository. Bản cập nhật báo cáo này được giữ local vì `docs/ui-review.md` chứa WIP báo cáo G2/G3 không thuộc commit triển khai.

## Giai đoạn 5 — kiểm tra production, GitHub và Railway (23/11/2026)

### Trạng thái trước khi cập nhật

- Workspace: `fix-header`, HEAD `586e0d6c1f2414c44619e34156bba19979db9fde` (`style(ui): improve responsive pagination`). Remote `origin/railway-production` được xác minh lại bằng `git fetch` thành công, vẫn ở `6e9b30031ef522506d0ccc753ee3b2835fc231a6`; không có commit mới hơn để đồng bộ.
- WIP đang có trước giai đoạn này được giữ nguyên. Không stage, commit hoặc sửa thêm các WIP đó. `git diff --check` PASS; chỉ có cảnh báo chuyển dòng LF/CRLF.
- Railway service `fantastic-rebirth` trong project `perpetual-commitment`, môi trường `production`, đang Online trên domain bên dưới. Dashboard có trạng thái chưa nhất quán cho deployment `90f9f9a8-83b3-4b5b-809e-9572d57cf53b`: danh sách bên cạnh hiện `BUILDING`, phần chi tiết hiện `Active`; log của deployment ghi startup hoàn tất, Next.js Ready và “Database schema initialized. Existing tables and data were preserved.” Vì trạng thái trên dashboard mâu thuẫn, không kết luận deployment mới nhất đã Active chắc chắn. Deployment trước `5d0989e8-feac-45c4-afa3-8ab5497a71ca` được hiển thị `ACTIVE`.
- Trang production tải được qua browser. Một lượt gọi `/bang-tin` ban đầu còn trạng thái tải; sau khi chờ, trang hiển thị 10/136 tin. Chuyển Trang 2 cho thấy 11–20/136 và trạng thái Trang 2; điều hướng đọc này không gửi thao tác ghi.

### Production UI đã quan sát

| Trang / luồng | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| Trang chủ `/` | PASS ở viewport trình duyệt hiện có | Có heading chính, liên kết Tìm phòng/Thảo luận/Khu vực, các tin và khu vực phổ biến; các nút/đường dẫn tải trong cây accessibility. |
| Tìm phòng `/bang-tin` | PASS ở viewport hiện có | Bộ lọc tìm kiếm/khu vực/giá/sắp xếp và pagination hiển thị; 136 kết quả, 10 tin ở trang đầu. |
| Pagination trang 1 → 2 | PASS | Trang 2 hiển thị 11–20/136, trang hiện tại được đánh dấu, có điều hướng Trang trước/Trang 3/Trang sau. Không kiểm tra filter/query trên production trong lượt này. |
| Chi tiết tin `/bai/thuephongtro-da-nang%3A2f28d58a16e35430cd2f58374f8a5d16` | FAIL accessibility label | Nút gallery có accessible name “Xem ảnh phòng 1 kích thước đầy đủ”, trong khi text hiển thị là “Xem ảnh đầy đủ” và bộ đếm 1/1. WIP local đã bỏ `aria-label` ghi đè; test fixture/axe trước đó trong G3 báo PASS, nhưng thay đổi chưa có trong production. Click mở gallery không được thử trong production lượt này. |
| Cộng đồng `/thao-luan` | PASS ở viewport hiện có | Bộ lọc, danh sách thảo luận và nội dung hiển thị sau khi tải. Không gửi bài hoặc thay đổi dữ liệu. |
| Đăng nhập | PASS hiển thị form | Điều hướng `/dang-nhap` mở modal đăng nhập trên trang chủ; email/mật khẩu và nút Đăng nhập/Đăng ký hiện diện. Không đăng nhập hay gửi thông tin. |
| Đăng ký | NOT VERIFIED | Không submit form, không tạo tài khoản, không kiểm tra backend. |
| `/admin` | PASS chỉ về khả năng đọc | Phiên trình duyệt sẵn có được xác thực admin và hiển thị dashboard. Chỉ quan sát; không kích hoạt thu thập, tạo cấu hình, duyệt, sửa hoặc xóa dữ liệu. |
| Hồ sơ và quản lý chủ trọ | NOT VERIFIED | Không xác minh session QA hợp lệ cho các khu vực này; không tìm cách vượt qua xác thực. |
| Viewport responsive 320, 375, 390, 430, 768, 1024, 1280, 1440 | NOT VERIFIED production | Công cụ browser hiện dùng viewport khoảng 1180×717 và không cung cấp thao tác đổi viewport trong phiên. Vì vậy không suy rộng kết quả desktop sang các cỡ khác. |
| Console/network audit toàn route, axe production | NOT VERIFIED | Playwright readonly audit không khởi chạy được: Node `fetch` tới production trả `fetch failed` trong môi trường terminal. Browser accessibility tree được đọc thủ công, không thay cho axe hoặc audit toàn bộ route. Không có ảnh production được ghi thành file trong repo; ảnh detail được xem trực tiếp trong phiên browser. |

### Test local trong lượt này

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `npm test` | PASS | 73/73. |
| `npm run typecheck` | FAIL do phạm vi worktree | Bốn import lỗi chỉ đến file trong `work/fix-production-qa`, `work/fix-register-diagnostics`, `work/railway-stabilization`, `work/ui-polish`; không sửa/xóa worktree hay thay `tsconfig`. |
| `npm run build` | FAIL môi trường | Next 16.4.3/Turbopack dừng khi tạo junction cho `sharp` trong `.next` do Windows trả Access denied. Vì build này không xác minh được candidate hiện tại nên không được coi PASS. |
| Playwright production readonly | NOT VERIFIED | Kết thúc ngay với `fetch failed`; không ghi vào production. |
| Header, gallery, pagination browser tests | Chưa chạy lại ở Phase 5 | Kết quả local trước đó được giữ ở các mục G3/G4; không được tính là kiểm tra mới trong giai đoạn này. |

### GitHub / deploy và quyết định phát hành

Fetch remote xác nhận nhánh production vẫn là `6e9b300`. GitHub browser page còn hiển thị lịch sử cũ đến `4ec419f`, không khớp dữ liệu fetch; dùng remote ref sau fetch làm mốc và không kết luận từ trang web stale. Không có thay đổi nào được stage, commit hoặc push trong Phase 5. Không tạo deployment mới, không rollback, không chỉnh cấu hình Railway.

**Chưa phát hành WIP header/admin/gallery** vì build local chưa xác nhận được thành công cho candidate; không kích hoạt một deployment có build chưa kiểm chứng. Pagination commit `6e9b300` đã được push ở giai đoạn trước; deployment `90f9f9a8-83b3-4b5b-809e-9572d57cf53b` là bản liên quan commit đó và dashboard chưa nhất quán về trạng thái như ghi phía trên.

Files WIP còn nguyên: `app/admin/AdminCollectorClient.tsx`, `app/layout.tsx`, `app/styles/admin.css`, `app/styles/header.css`, `components/Header.tsx`, `components/RoomPhotoGallery.tsx`, các test browser và báo cáo hiện có. Không thay backend/API/database/migration/route/dependency/Docker/deploy config; không chạy migration, reset DB, ghi dữ liệu production hoặc thay biến môi trường. Không commit/push ở giai đoạn này.

## Giai đoạn 5 — kết quả phát hành sau khi tiếp tục (23/11/2026)

Phần dưới đây cập nhật kết quả thực tế sau khi hoàn tất các bước còn lại; các ghi chú “chưa phát hành” phía trên là trạng thái trước thời điểm này.

- Đã tạo commit `da9e9c2bac64a066b8bd9a35eda24d3dce722857` trên parent `6e9b30031ef522506d0ccc753ee3b2835fc231a6` và push fast-forward lên `railway-production`. Commit chỉ gồm 8 file: header, stylesheet header, import stylesheet, tương phản `.area-schools`, gallery accessible name, hai audit browser và fixture header. Không đưa admin CSS, database, API, route, dependency, Docker hay cấu hình deploy vào commit.
- Candidate độc lập: `npm test` PASS 62/62; `npm run typecheck` PASS; `npm run build` PASS sau khi chạy lại theo cảnh báo bảo mật Next.js. Build phát cảnh báo Next.js 16.4.3 có security advisory; không nâng dependency trong phạm vi UI này.
- Playwright local: header PASS 14 layout, 24 axe scan, 5 nhóm tương tác; gallery PASS ở 375×844, accessible name khớp action/counter, mở/đóng được, axe 0 violation. Audit `ui-redesign.cjs` toàn ứng dụng vẫn NOT VERIFIED do fixture nội dung không khớp dữ liệu của nhánh production; không thêm nội dung hoặc hành vi nghiệp vụ để làm test cũ đạt.
- Railway deployment `10a80609-523d-4329-a6f8-5597797e357b` (commit `da9e9c2`) lên `Active`; build Docker thành công, healthcheck `/api/health` thành công, container Next.js Ready. Trang chủ production đã tải lại và hiển thị header mới (Trang chủ, Tìm phòng, Thảo luận, Khu vực; menu “Thêm” và Đăng nhập). Trang chi tiết gallery chưa được kiểm tra lại trực tiếp trên production; screenshot production không được lưu vào repository.
- **Tác động database cần ghi nhận:** cấu hình Railway hiện có pre-deploy command `node scripts/db/init.mjs`. Log của deployment mới ghi `Database schema initialized. Existing tables and data were preserved.` Script này chạy `database/schema.sql` và `upgradeCommunityMutations` (có thể thêm cột/index nếu thiếu). Tôi không thay script, schema hoặc dữ liệu ứng dụng; log Railway xác nhận các bảng/dữ liệu hiện có được giữ nguyên. Tuy nhiên initializer production đã chạy trong deployment này, nên không thể khẳng định “không có thao tác schema/DDL”. Không thực hiện thêm thao tác database nào.
- Workspace `fix-header` và các WIP ban đầu vẫn được giữ nguyên; commit phát hành được tạo trực tiếp từ candidate qua Git index tạm, không checkout/merge/reset branch làm việc. `docs/ui-review.md` chỉ được bổ sung addendum này sau deploy và hiện vẫn là WIP local, không thuộc commit phát hành.
