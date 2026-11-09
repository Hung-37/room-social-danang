# Cấu trúc project

## Runtime production

- `app/`: pages, API routes và màn hình admin của Next.js.
- `components/`: component giao diện dùng chung.
- `lib/`: database, auth, storage, roles, notifications và nghiệp vụ server.
- `js/collector.js`: parser/collector; `js/collector-service.js`: điều phối retry/concurrency.
- `database/schema.sql` và `database/migration-*.sql`: schema/migration MySQL.

## Dữ liệu và kiểm thử

- `data/`: cache/runtime fallback; xem [data/README.md](../data/README.md).
- `data/fixtures/`: CSV/JSON mẫu.
- `tests/`: test collector và database fallback.
- `scripts/`: công cụ vận hành.

## Legacy

- `legacy/`: prototype HTML/CSS/JavaScript cũ, không dùng trong production; xem [legacy/README.md](../legacy/README.md).

## Quy tắc tổ chức

1. API server đặt trong `app/api`, logic tái sử dụng đặt trong `lib`.
2. Không đưa secret, database dump hoặc cache runtime vào source control.
3. Parser collector chỉ chuẩn hóa dữ liệu; quyền truy cập và persistence xử lý ở service/API.
4. Dữ liệu mới luôn bắt đầu ở `needs_review`, không hiển thị công khai trước khi duyệt.
