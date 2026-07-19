-- Thêm cột "đến ngày" để tách ngày dịch vụ thành khoảng "từ ngày - đến ngày"
-- trên form và hợp đồng. Cột ngay_dich_vu hiện có được dùng làm "từ ngày".
alter table ho_so add column if not exists ngay_ket_thuc date;
