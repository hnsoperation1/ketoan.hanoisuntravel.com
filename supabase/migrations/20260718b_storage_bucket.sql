-- Bucket lưu ảnh CCCD/thẻ HDV/xác nhận — private (không public), vì đây là dữ liệu
-- CCCD nhạy cảm. Ứng dụng chỉ truy cập qua admin client (upload/tạo signed URL,
-- xem src/lib/storage.ts) hoặc qua chính signed URL đã ký sẵn — không cần thêm
-- policy nào trên storage.objects cho bucket này.
insert into storage.buckets (id, name, public)
values ('ho-so-hdv', 'ho-so-hdv', false)
on conflict (id) do nothing;
