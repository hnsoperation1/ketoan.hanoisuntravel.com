-- Liên kết tường minh loai_nhan_su -> hop_dong_templates, thay cho cách khớp
-- CHUỖI VĂN BẢN cũ (hop_dong_templates.loai so sánh với loai_nhan_su.ma,
-- xem xuat-hop-dong/route.ts) — dễ gõ sai, không có UI chọn trực tiếp. Cột
-- này ưu tiên hơn cách khớp cũ khi có giá trị; NULL thì vẫn rơi về cách khớp
-- cũ để không phá vỡ các loại nhân sự/biểu mẫu đã khớp đúng từ trước.
ALTER TABLE loai_nhan_su ADD COLUMN IF NOT EXISTS mau_hop_dong_id UUID REFERENCES hop_dong_templates(id) ON DELETE SET NULL;
