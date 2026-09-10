-- Thêm cột người tạo cho bảng doan — phục vụ hiển thị "Ngày giờ tạo / Người
-- tạo" trên trang Danh sách đoàn. Tham chiếu users(id) (bảng dùng chung
-- Supabase project với hns-crm, giống cách hns-crm join creator:users!created_by
-- ở bảng opportunities) để lấy được full_name qua embedded select, thay vì
-- chỉ lưu auth.users id trơn không tra được tên.
ALTER TABLE doan ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
