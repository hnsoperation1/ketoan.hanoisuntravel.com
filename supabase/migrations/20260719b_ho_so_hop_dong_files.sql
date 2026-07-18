-- Lịch sử file hợp đồng đã xuất cho từng hồ sơ — mỗi lần bấm "Xuất hợp đồng" thêm
-- 1 dòng mới (không ghi đè), để kế toán xem lại các bản đã xuất trước đó.
-- ho_so.file_hop_dong_url vẫn giữ nguyên làm con trỏ "bản mới nhất" cho tab
-- "File hợp đồng" ở trang danh sách đoàn.
create table if not exists ho_so_hop_dong_files (
  id uuid primary key default gen_random_uuid(),
  ho_so_id uuid not null references ho_so(id) on delete cascade,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ho_so_hop_dong_files_ho_so on ho_so_hop_dong_files(ho_so_id);

alter table ho_so_hop_dong_files enable row level security;
create policy "ke_toan_read_ho_so_hop_dong_files" on ho_so_hop_dong_files for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_ho_so_hop_dong_files" on ho_so_hop_dong_files for all to authenticated using (is_ke_toan()) with check (is_ke_toan());
