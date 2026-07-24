-- Loại nhân sự — danh mục do kế toán tự tạo (vd "HDV nội địa", "Lái xe", "Phiên dịch"...),
-- ĐỘC LẬP với prefix (HDV/MC/NS, dùng để khớp biểu mẫu hợp đồng) và với hop_dong_templates.loai.
-- Mục đích: nhóm nhân sự theo tính chất công việc, để sau này UI hiển thị thêm các trường
-- thông tin công việc riêng theo từng loại (khác với trường CCCD/ngân hàng/SĐT/email/MSTNCN/thẻ HDV
-- vốn dùng chung cho mọi loại).
create table if not exists loai_nhan_su (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  created_at timestamptz not null default now()
);

alter table loai_nhan_su enable row level security;
create policy "ke_toan_read_loai_nhan_su" on loai_nhan_su for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_loai_nhan_su" on loai_nhan_su for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

alter table nhansu add column if not exists loai_nhan_su_id uuid references loai_nhan_su(id);
