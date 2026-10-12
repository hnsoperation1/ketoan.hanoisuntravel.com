<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Làm mới chỉ tải lại vùng nội dung (quy tắc chung toàn ERP, 2026-10-12)

Áp dụng cho MỌI màn, kể cả màn thêm sau này.

- Nút Làm mới ở topbar (và mọi thao tác "làm mới" khác, vd bấm logo) KHÔNG tải lại cả trang — chỉ tải lại vùng nội dung, sidebar/topbar giữ nguyên.
- Cơ chế có sẵn ở khung chung: `refresh()` của `useTopbar()` (`src/contexts/topbar.tsx`) — trang có hàm tải lại riêng thì gọi hàm đó, còn lại `router.refresh()` + dựng lại vùng nội dung (`<ContentReload>` bọc trong khung). Màn mới nằm trong khung chung tự áp dụng, không cần làm gì thêm.
- Màn có bộ lọc / trạng thái muốn giữ khi làm mới: đăng ký `setOnRefresh(load)` trong `useEffect` và trả `setOnRefresh(null)` khi rời màn.
- Không dùng `window.location.reload()`. `npm run build` chạy `scripts/check-content-reload.mjs` trước `next build` và sẽ dừng nếu vi phạm (hoặc nếu khung bị gỡ cơ chế dựng lại vùng nội dung). Trường hợp bắt buộc tải lại cả trang (vd vừa đăng xuất) thì ghi chú `cho-phep-tai-lai-ca-trang: <lý do>` ở dòng đó.
