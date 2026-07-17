-- Thông báo cho kế toán khi bot Telegram xác nhận xong 1 hồ sơ (hoặc sự kiện khác sau này).
-- Đội chỉ 1-2 kế toán, dùng chung 1 allowlist (is_ke_toan()) nên không cần bảng
-- riêng theo từng người — 1 feed chung, "đã đọc" xác định bằng mốc thời gian
-- lưu ở localStorage phía client (không cần đồng bộ trạng thái đọc qua server).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
create policy "ke_toan_read_notifications" on notifications for select to authenticated using (is_ke_toan());
-- Không cấp policy ghi cho authenticated — chỉ service role (Telegram webhook) mới tạo thông báo mới.
