-- Bảng contacts (CRM, cùng Supabase project) chưa có field ghi chú tự do —
-- cần khi kế toán tạo liên hệ mới ngay từ modal "Liên hệ phụ trách" ở
-- Danh mục khách hàng VMB (vd ghi lại bối cảnh quen biết/nguồn giới thiệu).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS note TEXT;
