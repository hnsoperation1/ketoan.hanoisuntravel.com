-- Xóa mềm đoàn — không mất dữ liệu hồ sơ/hợp đồng liên quan, chỉ ẩn khỏi danh
-- sách. deleted_at null = đang hoạt động.
alter table doan add column if not exists deleted_at timestamptz;
