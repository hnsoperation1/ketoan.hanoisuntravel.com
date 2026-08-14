-- 2 checkbox kế toán tự tick khi duyệt cho từng lượt tham gia đoàn (ho_so)
-- — "Đã đủ hồ sơ/chứng từ" và "Đã trả đồ đoàn" — hiện ở tab "Tổng hợp"
-- trang /nhan-su. Không dùng trang_thai có sẵn vì đây là 2 việc kiểm tra
-- tay ĐỘC LẬP nhau, không phải bước tiếp theo trong quy trình thanh toán.
ALTER TABLE ho_so ADD COLUMN IF NOT EXISTS du_ho_so_chung_tu BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ho_so ADD COLUMN IF NOT EXISTS da_tra_do_doan BOOLEAN NOT NULL DEFAULT false;
