-- Nối tạm 1 mã khách VMB với 1 liên hệ bên CRM (bảng contacts, cùng
-- Supabase project) để màn "Danh mục khách hàng" có thể hiện thêm
-- Người làm việc/SĐT/Email/Tên cty/MST mà không cần nhập lại tay.
-- CỐ TÌNH chưa gộp 2 khái niệm "khách hàng" (vmb_khach_hang vs
-- contacts/organizations) làm 1 — quyết định 2026-08-13, để giai đoạn sau
-- tính tiếp cách đồng bộ 2 bảng, hiện tại chỉ tham chiếu 1 chiều để hiển thị.
ALTER TABLE vmb_khach_hang ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
