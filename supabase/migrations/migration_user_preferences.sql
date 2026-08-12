-- Bảng lưu cài đặt UI cá nhân hóa theo từng người dùng — DÙNG CHUNG với
-- hns-crm (đã tồn tại thật trong Supabase project chung, tạo bởi
-- hns-crm/supabase/migrations/20260714_user_preferences.sql). Copy
-- idempotent sang đây để repo ketoan tự chứa đủ migration, an toàn chạy
-- lại dù bảng/policy đã có sẵn.
--   key = "<scope>.<setting>"  VD: "ui.theme", "view_mode.don_hang_moi"
--   value = jsonb              VD: {"theme":"dense"}, {"mode":"grid"}

create table if not exists user_preferences (
  user_id    uuid        not null references users(id) on delete cascade,
  key        text        not null,
  value      jsonb       not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_preferences_user_id_idx on user_preferences (user_id);

alter table user_preferences enable row level security;

-- create policy không có IF NOT EXISTS chuẩn — bọc DO block để chạy lại an
-- toàn nếu policy đã tồn tại từ trước (do hns-crm tạo).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_preferences' and policyname = 'user_preferences_own'
  ) then
    create policy "user_preferences_own"
      on user_preferences for all
      using  (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
