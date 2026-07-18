-- Thêm cột lưu tên file đẹp (có dấu, đúng cấu trúc yyyymmdd_HDV Họ tên dd.ddTm.docx)
-- để hiển thị khi tải xuống — khác với storage key nội bộ (không dấu).
alter table ho_so_hop_dong_files add column if not exists file_name text;
