-- Thêm 3 field "Thông tin chương trình" cấp đoàn (không phải cấp hồ sơ
-- từng người) — cùng nhóm với ten_doan/hanh_trinh/ngay_di/ngay_ve/sl_khach
-- đã có sẵn, dùng chung cho MỌI hồ sơ trong đoàn khi xuất hợp đồng, tránh
-- phải nhập lại cho từng người. Xem buildMergeData (lib/docx-merge.ts) và
-- trang Biểu mẫu hợp đồng cho placeholder {{diem_don_tra}}/
-- {{dieu_hanh_phu_trach}}/{{dieu_hanh_dien_thoai}}.
ALTER TABLE doan ADD COLUMN IF NOT EXISTS diem_don_tra TEXT;
ALTER TABLE doan ADD COLUMN IF NOT EXISTS dieu_hanh_phu_trach TEXT;
ALTER TABLE doan ADD COLUMN IF NOT EXISTS dieu_hanh_dien_thoai TEXT;
