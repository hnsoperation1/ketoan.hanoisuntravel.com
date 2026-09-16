-- Quản lý kho quà tặng/lưu niệm (3 kho) — nhập/xuất/chuyển kho qua bot
-- Telegram, đọc tin nhắn tự nhiên (giống leaveRequestParser bên ihns.vn),
-- xác nhận qua nút bấm. Chuyển kho là quy trình 2 bước: kho nguồn xác nhận
-- gửi (trừ tồn ngay) -> kho đích xác nhận nhận (chỉ lúc đó mới cộng tồn kho
-- đích) -- để bắt được chênh lệch số lượng khi bốc dỡ giữa 2 kho.

create table if not exists kho (
  id uuid primary key default gen_random_uuid(),
  ten_kho text not null unique,
  dia_chi text,
  created_at timestamptz not null default now()
);

create table if not exists vat_pham (
  id uuid primary key default gen_random_uuid(),
  ten text not null unique,
  don_vi text not null default 'cái',
  created_at timestamptz not null default now()
);

-- Ai (theo telegram user id cá nhân — cb.from.id/message.from.id, không đổi
-- dù nhắn từ group nào) được thao tác kho nào. Đây là toàn bộ "hệ thống
-- đăng nhập" của thủ kho — họ không cần tài khoản web, chỉ cần nằm trong
-- bảng này.
create table if not exists kho_thu_kho (
  telegram_user_id bigint primary key,
  ho_ten text not null,
  kho_id uuid not null references kho(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Nhóm Telegram bot lắng nghe cho luồng kho (tách khỏi nhóm HCNS đang dùng
-- cho luồng hồ sơ CCCD) -- webhook dùng bảng này để biết 1 tin nhắn đến có
-- phải "chuyện kho" hay không.
create table if not exists kho_telegram_groups (
  chat_id bigint primary key,
  label text not null,
  created_at timestamptz not null default now()
);

-- 1 dòng = 1 phiếu, từ lúc bot tạo nháp tới lúc hoàn tất -- trạng thái nằm
-- ngay trên dòng này (không dùng bảng session riêng) để 1 nhóm chat nhiều
-- thủ kho cùng dùng chung mà không đụng nhau: tra theo (group_chat_id,
-- nguoi_tao_id, status) hoặc (group_chat_id, kho_dich_id, status).
-- nguoi_tao_id/nguoi_nhan_id KHÔNG FK sang kho_thu_kho -- cố tình, để phiếu
-- cũ vẫn đọc được nguyên vẹn (tên chụp lại tại thời điểm tạo) kể cả khi thủ
-- kho đó đã bị xoá khỏi kho_thu_kho sau này.
create table if not exists phieu_kho (
  id uuid primary key default gen_random_uuid(),
  -- ngắn hơn uuid nhiều -- nhét vào callback_data (Telegram giới hạn 64 byte).
  phieu_no bigint generated always as identity,
  loai text not null check (loai in ('nhap', 'xuat', 'chuyen')),
  kho_id uuid not null references kho(id) on delete restrict, -- nhap: kho nhận hàng; xuat/chuyen: kho nguồn
  kho_dich_id uuid references kho(id) on delete restrict,     -- chỉ 'chuyen'
  nguoi_tao_id bigint not null,
  nguoi_tao_ten text not null,
  nguoi_nhan_id bigint,
  nguoi_nhan_ten text,
  group_chat_id bigint not null,
  bot_message_id bigint,
  raw_text text not null,
  doan_ten text,  -- ghi tự do, không FK sang bảng doan -- đồng bộ đoàn tính sau
  ghi_chu text,
  -- khác NULL nghĩa đang chờ tin nhắn tiếp theo của đúng người/kho liên quan:
  -- 'items' (người tạo đang gửi lại toàn bộ nội dung phiếu để sửa) hoặc
  -- 'nhan_lech' (kho đích đang báo số lượng thực nhận).
  editing_field text,
  status text not null default 'soan' check (
    status in ('soan', 'cho_nhan', 'hoan_tat', 'hoan_tat_lech', 'huy')
  ),
  xac_nhan_tao_at timestamptz,
  xac_nhan_nhan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_phieu_kho_dich check (
    (loai = 'chuyen' and kho_dich_id is not null and kho_dich_id <> kho_id)
    or (loai <> 'chuyen' and kho_dich_id is null)
  )
);

create unique index if not exists idx_phieu_kho_no on phieu_kho(phieu_no);
create index if not exists idx_phieu_kho_nguoi_tao on phieu_kho(group_chat_id, nguoi_tao_id, status);
create index if not exists idx_phieu_kho_cho_nhan on phieu_kho(group_chat_id, kho_dich_id, status);
create index if not exists idx_phieu_kho_status on phieu_kho(status);

create table if not exists phieu_kho_chi_tiet (
  id uuid primary key default gen_random_uuid(),
  phieu_id uuid not null references phieu_kho(id) on delete cascade,
  vat_pham_id uuid not null references vat_pham(id) on delete restrict,
  so_luong numeric not null check (so_luong > 0),
  -- NULL = mặc định khớp đúng so_luong (kho đích chưa báo lệch gì).
  so_luong_thuc_nhan numeric check (so_luong_thuc_nhan >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_pkct_phieu on phieu_kho_chi_tiet(phieu_id);

-- ─── Tồn kho: view tính từ lịch sử phiếu, không lưu số dư riêng để khỏi
-- lệch giữa "số dư lưu" và "lịch sử thật" ───
-- security_invoker=on: view chạy với quyền của người GỌI (không phải chủ sở
-- hữu view) để RLS của phieu_kho/phieu_kho_chi_tiet áp đúng cho dashboard.
create or replace view kho_bien_dong
  with (security_invoker = on) as
  select pk.id as phieu_id, pk.kho_id, pkc.vat_pham_id, pkc.so_luong as so_luong
  from phieu_kho pk join phieu_kho_chi_tiet pkc on pkc.phieu_id = pk.id
  where pk.loai = 'nhap' and pk.status = 'hoan_tat'
  union all
  select pk.id, pk.kho_id, pkc.vat_pham_id, -pkc.so_luong
  from phieu_kho pk join phieu_kho_chi_tiet pkc on pkc.phieu_id = pk.id
  where pk.loai = 'xuat' and pk.status = 'hoan_tat'
  union all
  -- chuyển kho: trừ kho nguồn ngay khi gửi (cho_nhan), không đợi kho đích xác nhận
  select pk.id, pk.kho_id, pkc.vat_pham_id, -pkc.so_luong
  from phieu_kho pk join phieu_kho_chi_tiet pkc on pkc.phieu_id = pk.id
  where pk.loai = 'chuyen' and pk.status in ('cho_nhan', 'hoan_tat', 'hoan_tat_lech')
  union all
  -- chỉ cộng kho đích khi kho đích đã xác nhận nhận (hoan_tat/hoan_tat_lech)
  select pk.id, pk.kho_dich_id, pkc.vat_pham_id, coalesce(pkc.so_luong_thuc_nhan, pkc.so_luong)
  from phieu_kho pk join phieu_kho_chi_tiet pkc on pkc.phieu_id = pk.id
  where pk.loai = 'chuyen' and pk.status in ('hoan_tat', 'hoan_tat_lech');

create or replace view ton_kho
  with (security_invoker = on) as
  select kho_id, vat_pham_id, sum(so_luong)::numeric as so_luong
  from kho_bien_dong
  group by kho_id, vat_pham_id;

-- ─── RLS ───
alter table kho enable row level security;
alter table vat_pham enable row level security;
alter table kho_thu_kho enable row level security;
alter table kho_telegram_groups enable row level security;
alter table phieu_kho enable row level security;
alter table phieu_kho_chi_tiet enable row level security;

-- Webhook Telegram dùng service role (bỏ qua RLS). Policy dưới đây chỉ phục
-- vụ dashboard web (đăng nhập qua Supabase Auth), dùng is_ke_toan() có sẵn
-- (định nghĩa ở 20260718_restrict_ke_toan.sql) để khớp đúng mức siết đang
-- áp dụng cho nhansu/doan/ho_so.
create policy "ke_toan_read_kho" on kho for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_kho" on kho for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

create policy "ke_toan_read_vat_pham" on vat_pham for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_vat_pham" on vat_pham for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

create policy "ke_toan_read_kho_thu_kho" on kho_thu_kho for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_kho_thu_kho" on kho_thu_kho for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

create policy "ke_toan_read_kho_telegram_groups" on kho_telegram_groups for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_kho_telegram_groups" on kho_telegram_groups for all to authenticated using (is_ke_toan()) with check (is_ke_toan());

create policy "ke_toan_read_phieu_kho" on phieu_kho for select to authenticated using (is_ke_toan());
create policy "ke_toan_read_phieu_kho_chi_tiet" on phieu_kho_chi_tiet for select to authenticated using (is_ke_toan());
-- Không cấp write cho authenticated trên phieu_kho/phieu_kho_chi_tiet -- phiếu
-- chỉ được tạo/sửa qua bot (service role), dashboard chỉ xem lại lịch sử.
