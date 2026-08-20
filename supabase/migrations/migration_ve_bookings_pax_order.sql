-- ve_bookings.pax_order: vị trí của dòng pax trong tin nhắn Telegram gốc
-- (ghi bởi hns-ticket-parser/lib/supabase-central.ts khi insertBookings),
-- dùng để candidate-messages.ts (ketoan.hanoisuntravel.com) sắp đúng thứ tự
-- pax như trong tin nhắn khi hiện danh sách khớp mã khách, thay vì phụ
-- thuộc thứ tự SELECT không đảm bảo của Postgres khi không có ORDER BY.
ALTER TABLE ve_bookings ADD COLUMN IF NOT EXISTS pax_order INTEGER;
