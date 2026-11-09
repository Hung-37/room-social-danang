# Data layout

- `cached-listings.json`: cache runtime của collector; không chỉnh tay nếu không cần khôi phục dữ liệu.
- `collector-runs.json`: lịch sử các lần chạy collector.
- `fixtures/`: dữ liệu mẫu dùng cho test/import thủ công, không phải dữ liệu production.
- `community-posts.json` và `community-interactions.json`: fallback file khi MySQL không khả dụng.

Dữ liệu production ưu tiên MySQL. Các file runtime được bảo vệ trong `.gitignore`.
