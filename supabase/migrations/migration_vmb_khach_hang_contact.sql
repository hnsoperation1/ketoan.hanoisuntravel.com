-- Nối tạm 1 mã khách VMB với 1 liên hệ bên CRM (bảng contacts, cùng
-- Supabase project) để màn "Danh mục khách hàng" có thể hiện thêm
-- Người làm việc/SĐT/Email/Tên cty/MST mà không cần nhập lại tay.
-- CỐ TÌNH chưa gộp 2 khái niệm "khách hàng" (vmb_khach_hang vs
-- contacts/organizations) làm 1 — quyết định 2026-08-13, để giai đoạn sau
-- tính tiếp cách đồng bộ 2 bảng, hiện tại chỉ tham chiếu 1 chiều để hiển thị.
ALTER TABLE vmb_khach_hang ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Ghi chú riêng của kế toán cho từng mã khách (khác hẳn doi_tuong_quy_tac/
-- hinh_thuc_cong_no vốn là mô tả chính sách CẤP NHÓM) — hiện & sửa ở slide
-- over "Chi tiết liên hệ" bên phải màn Danh mục khách hàng, chế độ Đầy đủ.
ALTER TABLE vmb_khach_hang ADD COLUMN IF NOT EXISTS ghi_chu TEXT;

-- Địa chỉ công ty — CỐ TÌNH lưu thẳng ở đây (không join sang
-- organizations.address bên CRM) để đọc/hiện ra khỏi cần join, theo đúng
-- yêu cầu 2026-08-13. Khi tạo/đổi liên hệ qua modal "Liên hệ phụ trách"
-- (POST /api/ve-may-bay/contacts), giá trị này được ghi ĐỒNG THỜI ở cả 2
-- nơi: cột này (đọc nhanh, không join) và organizations.address bên CRM
-- (để dữ liệu CRM không bị lệch) — xem comment trong route đó.
ALTER TABLE vmb_khach_hang ADD COLUMN IF NOT EXISTS dia_chi TEXT;
