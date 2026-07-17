-- Hồ sơ & hợp đồng HDV/MC/NS — schema khởi tạo
-- Xem plan: nguyên tắc "chừa chỗ" cho Giai đoạn 2 (tích hợp AMIS WeSign) —
-- xem cột file_hop_dong_url / amis_document_id / ngay_ky, không dùng ở v1.

create extension if not exists "pgcrypto";

-- ─── nhansu: danh bạ HDV/MC/NS, tái dùng qua nhiều đoàn, khớp theo CCCD ───
create table if not exists nhansu (
  id uuid primary key default gen_random_uuid(),
  prefix text not null default 'HDV', -- HDV / MC / NS
  ho_ten text not null,
  dia_chi text,
  so_cccd text unique,
  ngay_sinh date,
  ngay_cap date,
  noi_cap text,
  ma_so_thue_tncn text,
  sdt text,
  so_the_hdv text,
  loai_the_hdv text,
  han_the_hdv date,
  stk text,
  ten_ngan_hang text,
  email text,
  created_at timestamptz not null default now()
);

-- ─── doan: đoàn tour ───
create table if not exists doan (
  id uuid primary key default gen_random_uuid(),
  ten_doan text not null,
  hanh_trinh text,
  ngay_di date not null,
  ngay_ve date,
  sl_khach integer,
  created_at timestamptz not null default now()
);

-- ─── ho_so: 1 dòng = 1 người trong 1 đoàn — khớp 2 sheet Excel gốc ───
create table if not exists ho_so (
  id uuid primary key default gen_random_uuid(),
  doan_id uuid not null references doan(id) on delete cascade,
  nhansu_id uuid not null references nhansu(id) on delete cascade,
  ngay_dich_vu date,
  so_ngay_cong_tac numeric,
  don_gia_ngay numeric,
  so_tien_chi_tra numeric,
  thue_nop numeric, -- auto = 10% so_tien_chi_tra
  chi_tra numeric,  -- auto = so_tien_chi_tra - thue_nop
  loai_hop_dong text,          -- vd "HĐ điện tử" — sheet "Theo dõi hợp đồng"
  tinh_trang_thanh_toan text,  -- vd "Ngày 17/01/2026 - TCB017"
  trang_thai text not null default 'cho_xac_nhan_ai',
    -- cho_xac_nhan_ai | da_xac_nhan | da_thanh_toan
    -- Giai đoạn 2 mở rộng thêm: da_xuat_hd | da_gui_ky_amis | da_ky_xong (không đổi cấu trúc cột)
  ngay_duyet date,
  nhap_misa boolean not null default false,
  anh_cccd_truoc_url text,
  anh_cccd_sau_url text,
  anh_the_hdv_url text,
  anh_xac_nhan_url text,
  -- chừa sẵn cho Giai đoạn 2 (AMIS WeSign) — không dùng ở v1
  so_hop_dong text,
  file_hop_dong_url text,
  amis_document_id text,
  ngay_ky date,
  created_at timestamptz not null default now()
);

create index if not exists idx_ho_so_doan on ho_so(doan_id);
create index if not exists idx_ho_so_nhansu on ho_so(nhansu_id);

-- ─── bot_session: trạng thái hội thoại Telegram theo chat_id ───
-- Bắt buộc vì route handler serverless không giữ state trong bộ nhớ giữa các lần gọi.
create table if not exists bot_session (
  chat_id bigint primary key,
  state text not null default 'idle',
    -- idle | waiting_doan_choice | waiting_image_type | waiting_confirm
  current_doan_id uuid references doan(id) on delete set null,
  draft_json jsonb not null default '{}'::jsonb,
  pending_image_urls jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── RLS ───
alter table nhansu enable row level security;
alter table doan enable row level security;
alter table ho_so enable row level security;
alter table bot_session enable row level security;

-- Route handler dùng service role (bypass RLS) cho Telegram webhook/AI extract.
-- Dashboard dùng server client theo session — chỉ user đã đăng nhập mới đọc/ghi được.
create policy "authenticated_read_nhansu" on nhansu for select to authenticated using (true);
create policy "authenticated_write_nhansu" on nhansu for all to authenticated using (true) with check (true);

create policy "authenticated_read_doan" on doan for select to authenticated using (true);
create policy "authenticated_write_doan" on doan for all to authenticated using (true) with check (true);

create policy "authenticated_read_ho_so" on ho_so for select to authenticated using (true);
create policy "authenticated_write_ho_so" on ho_so for all to authenticated using (true) with check (true);

-- bot_session: không cấp policy cho authenticated — chỉ service role (webhook) mới đọc/ghi.
