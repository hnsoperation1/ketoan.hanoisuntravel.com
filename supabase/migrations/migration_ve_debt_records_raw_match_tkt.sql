-- Cột "TKT" cho bảng công nợ NCC raw (4 tab FCVN/SAO ĐỎ/VIETJET/SUN PQC) —
-- gắn tay giống hệt tkt_tag ở bảng ve_debt_records (Tổng hợp), free text
-- có gợi ý theo danh mục TKT thật (bảng ve_tkt), không ép quan hệ khoá
-- ngoài vì có thể gõ tự do khi TKT chưa có trong danh mục.
ALTER TABLE ve_debt_records_raw_match ADD COLUMN IF NOT EXISTS tkt_tag TEXT;
