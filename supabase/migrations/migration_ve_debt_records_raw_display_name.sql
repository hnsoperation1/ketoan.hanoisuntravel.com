-- Tên hiển thị tuỳ chỉnh cho 1 lô upload (đổi qua double-click/chuột phải
-- tab "sheet" ở trang /ve-may-bay/cong-no-ncc) — KHÔNG đụng source_file
-- (tên file gốc lúc upload, vẫn giữ nguyên để truy vết). NULL = chưa đổi
-- tên, hiển thị dùng source_file như trước.
ALTER TABLE ve_debt_records_raw ADD COLUMN IF NOT EXISTS display_name TEXT;
