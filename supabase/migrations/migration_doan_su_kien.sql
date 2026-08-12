-- Thêm loại đoàn "Sự kiện" (khác "Tour" mặc định) — dùng cho các hợp đồng
-- kiểu 1 buổi biểu diễn/sự kiện (vd nhóm múa) thay vì 1 chuyến tour nhiều
-- ngày, cần 3 field riêng để điền vào hợp đồng: tên chương trình/thời gian
-- tổ chức (text tự do, không phải date cứng — có thể ghi kèm giờ)/địa điểm
-- tổ chức. Xem buildMergeData (lib/docx-merge.ts) và trang Biểu mẫu hợp
-- đồng (cai-dat/bieu-mau-hop-dong) cho placeholder {{ten_chuong_trinh}}/
-- {{thoi_gian_chuong_trinh}}/{{dia_diem_chuong_trinh}}.
-- Các field cũ (hanh_trinh/ngay_di/ngay_ve/sl_khach) GIỮ NGUYÊN áp dụng cho
-- cả 2 loại — 3 field mới chỉ THÊM, không thay thế.
ALTER TABLE doan ADD COLUMN IF NOT EXISTS loai_doan TEXT NOT NULL DEFAULT 'tour';
ALTER TABLE doan ADD COLUMN IF NOT EXISTS ten_chuong_trinh TEXT;
ALTER TABLE doan ADD COLUMN IF NOT EXISTS thoi_gian_chuong_trinh TEXT;
ALTER TABLE doan ADD COLUMN IF NOT EXISTS dia_diem_chuong_trinh TEXT;
