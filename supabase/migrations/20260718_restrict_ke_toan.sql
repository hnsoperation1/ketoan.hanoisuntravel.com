-- Dùng chung Supabase project với hns-crm (quyết định của bạn) — nghĩa là
-- toàn bộ nhân viên CRM (sale, cskh, mkt...) đều là 1 "authenticated" user
-- trong project này. Bảng users/role của CRM không có role "kế toán" riêng,
-- nên không dùng được để giới hạn quyền. Thay vào đó: 1 allowlist riêng theo
-- email, độc lập hoàn toàn với hệ thống role của CRM.

create table if not exists ke_toan_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Function security definer — bắt buộc để bypass RLS của chính bảng allowlist
-- khi được gọi từ trong policy của bảng khác (nếu không, subquery sẽ bị RLS
-- chặn luôn, luôn trả về false dù email có trong allowlist).
create or replace function is_ke_toan()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from ke_toan_allowlist where email = auth.jwt() ->> 'email'
  );
$$;

alter table ke_toan_allowlist enable row level security;
-- Không cấp policy nào cho authenticated — chỉ service role (Dashboard/SQL Editor)
-- mới thêm/xoá được người trong allowlist, tránh nhân viên tự ý thêm mình vào.

-- ─── Thay policy cũ (mọi authenticated) bằng policy giới hạn theo allowlist ───
drop policy if exists "authenticated_read_nhansu" on nhansu;
drop policy if exists "authenticated_write_nhansu" on nhansu;
create policy "ke_toan_read_nhansu" on nhansu for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_nhansu" on nhansu for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

drop policy if exists "authenticated_read_doan" on doan;
drop policy if exists "authenticated_write_doan" on doan;
create policy "ke_toan_read_doan" on doan for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_doan" on doan for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

drop policy if exists "authenticated_read_ho_so" on ho_so;
drop policy if exists "authenticated_write_ho_so" on ho_so;
create policy "ke_toan_read_ho_so" on ho_so for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_ho_so" on ho_so for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

-- ─── Chạy tay sau khi migration này xong: thêm (các) email kế toán được phép ───
-- insert into ke_toan_allowlist (email) values ('ketoan@hanoisuntravel.com');
