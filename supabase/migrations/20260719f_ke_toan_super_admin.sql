-- Thêm phân quyền "super admin" trong nội bộ kế toán — mặc định ai cũng là
-- kế toán thường (false), chỉ super admin mới thấy/vào được mục Cài đặt >
-- Biểu mẫu hợp đồng.
alter table ke_toan_allowlist add column if not exists is_super_admin boolean not null default false;

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_super_admin from ke_toan_allowlist where email = auth.jwt() ->> 'email'),
    false
  );
$$;

-- Chạy tay sau khi migration này xong: nâng (các) email cần quyền super admin.
-- update ke_toan_allowlist set is_super_admin = true where email = 'ketoan@hanoisuntravel.com';
