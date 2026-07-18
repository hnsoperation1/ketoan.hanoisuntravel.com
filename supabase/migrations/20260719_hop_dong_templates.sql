-- Biểu mẫu hợp đồng — kế toán upload file .docx chứa placeholder (vd {{ho_ten}}),
-- hệ thống dùng để merge dữ liệu sinh hợp đồng (Giai đoạn 2 — chưa xây pipeline
-- merge/PDF ở migration này, chỉ tạo chỗ lưu trữ + quản lý biểu mẫu trước).
create table if not exists hop_dong_templates (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  loai text, -- vd "HDV nội địa", "MC", để trống nếu dùng chung
  file_url text not null,
  file_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table hop_dong_templates enable row level security;
create policy "ke_toan_read_hop_dong_templates" on hop_dong_templates for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_hop_dong_templates" on hop_dong_templates for all to authenticated using (is_ke_toan()) with check (is_ke_toan());
