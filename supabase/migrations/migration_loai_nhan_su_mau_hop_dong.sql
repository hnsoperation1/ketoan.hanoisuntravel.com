-- Liên kết loai_nhan_su <-> hop_dong_templates dạng NHIỀU-NHIỀU (1 loại nhân
-- sự có thể áp nhiều mẫu HĐ khác nhau, vd theo mức lương/mùa/khu vực — kế
-- toán tự chọn đúng mẫu lúc xuất hợp đồng), thay cho cách khớp CHUỖI VĂN BẢN
-- cũ (hop_dong_templates.loai so sánh với loai_nhan_su.ma, xem
-- xuat-hop-dong/route.ts) — dễ gõ sai, không có UI chọn trực tiếp.
create table if not exists loai_nhan_su_mau_hop_dong (
  loai_nhan_su_id uuid not null references loai_nhan_su(id) on delete cascade,
  mau_hop_dong_id uuid not null references hop_dong_templates(id) on delete cascade,
  primary key (loai_nhan_su_id, mau_hop_dong_id)
);

-- Phòng khi bản migration trước (cột mau_hop_dong_id 1-1) đã lỡ chạy trên môi
-- trường nào đó — chuyển dữ liệu cũ sang bảng nối rồi bỏ cột, an toàn kể cả
-- khi cột chưa từng tồn tại (IF EXISTS).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'loai_nhan_su' and column_name = 'mau_hop_dong_id'
  ) then
    insert into loai_nhan_su_mau_hop_dong (loai_nhan_su_id, mau_hop_dong_id)
    select id, mau_hop_dong_id from loai_nhan_su where mau_hop_dong_id is not null
    on conflict do nothing;
  end if;
end $$;

alter table loai_nhan_su drop column if exists mau_hop_dong_id;

alter table loai_nhan_su_mau_hop_dong enable row level security;
create policy "ke_toan_read_loai_nhan_su_mau_hop_dong" on loai_nhan_su_mau_hop_dong for select to authenticated using (is_ke_toan());
create policy "ke_toan_write_loai_nhan_su_mau_hop_dong" on loai_nhan_su_mau_hop_dong for all to authenticated using (is_ke_toan()) with check (is_ke_toan());
