-- Tách Tỉnh/Thành phố ra thành cột riêng (trước đây chỉ nằm chung trong địa chỉ
-- đầy đủ, không dán được vào cột "TỈNH" riêng của file Excel gốc).
alter table nhansu add column if not exists tinh_tp text;
