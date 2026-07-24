-- Gộp prefix (HDV/MC/NS cứng, cột text trên nhansu) vào loai_nhan_su — chỉ còn
-- 1 khái niệm "loại nhân sự" duy nhất, do kế toán tự quản lý. Cột `ma` thay thế
-- đúng vai trò cũ của prefix: đặt tên file hợp đồng (buildContractFileName) và
-- khớp hop_dong_templates.loai để tự chọn mẫu Word khi xuất hợp đồng.
alter table loai_nhan_su add column if not exists ma text;

-- Seed lại 3 loại cũ để không mất phân loại của nhân sự đã có sẵn.
insert into loai_nhan_su (ten, ma)
select v.ten, v.ma
from (values ('HDV', 'HDV'), ('MC', 'MC'), ('NS', 'NS')) as v(ten, ma)
where not exists (select 1 from loai_nhan_su l where l.ma = v.ma);

-- Backfill: nhân sự nào chưa được gán loai_nhan_su_id thì lấy theo prefix cũ.
update nhansu n
set loai_nhan_su_id = l.id
from loai_nhan_su l
where n.loai_nhan_su_id is null and l.ma = n.prefix;

alter table loai_nhan_su alter column ma set not null;

-- Default về loại "HDV" khi tạo nhân sự mới mà không chỉ định rõ loại (vd bot
-- Telegram/kế toán quên chọn) — giữ đúng hành vi cũ của prefix (default 'HDV').
-- Postgres không cho subquery trực tiếp trong DEFAULT nên phải bọc qua function.
create or replace function default_loai_nhan_su_id() returns uuid
language sql stable as $$
  select id from loai_nhan_su where ma = 'HDV' limit 1
$$;

alter table nhansu alter column loai_nhan_su_id set default default_loai_nhan_su_id();
alter table nhansu alter column loai_nhan_su_id set not null;
alter table nhansu drop column if exists prefix;
