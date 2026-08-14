-- Checkbox "Kế toán trưởng duyệt" — bước duyệt riêng của kế toán trưởng
-- trước khi thanh toán, ĐỘC LẬP với 2 checkbox "Đủ hồ sơ/chứng từ"/"Đã trả
-- đồ đoàn" đã có (2 cái đó do kế toán phụ trách tự tick, đây là bước duyệt
-- cấp trên) — hiện ở tab "Cần thanh toán"/"Đã thanh toán" trang /nhan-su.
ALTER TABLE ho_so ADD COLUMN IF NOT EXISTS ke_toan_truong_duyet BOOLEAN NOT NULL DEFAULT false;
