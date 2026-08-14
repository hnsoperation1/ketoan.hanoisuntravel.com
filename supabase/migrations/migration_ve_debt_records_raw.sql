-- Lưu nguyên xi dữ liệu công nợ NCC theo đúng cột trong file Excel gốc
-- (không map/chuẩn hoá) — dùng cho 4 tab NCC cố định (FCVN/SAO ĐỎ/VIETJET/
-- SUN PQC) ở trang /ve-may-bay/cong-no. Mỗi lần upload 1 file = 1 dòng ở
-- đây (headers + rows lưu dạng JSON, y hệt file gốc). Bảng ve_debt_records
-- (đã chuẩn hoá) giữ nguyên, không đụng vào — dùng cho tab "Tổng hợp" và
-- các tính năng khác (đối chiếu công nợ KH, gán TKT/Sale...).
CREATE TABLE IF NOT EXISTS ve_debt_records_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncc TEXT NOT NULL,
  source_file TEXT,
  headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ve_debt_records_raw_ncc_idx ON ve_debt_records_raw (ncc);
