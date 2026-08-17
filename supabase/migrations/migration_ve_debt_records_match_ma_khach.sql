-- Khớp tự động "mã khách" ở Công nợ NCC (ve_debt_records) với tin nhắn bán vé
-- Telegram đã lưu ở ve_bookings, khớp DUY NHẤT theo ticket_no TRÙNG TUYỆT ĐỐI
-- (không suy đoán theo tên pax/ngày bay...). Ý nghĩa match_status:
--   'unmatched' (mặc định) — chưa tìm được ve_bookings nào khớp ticket_no,
--                hoặc tìm ra NHIỀU HƠN 1 (không đủ tự tin để tự điền) → kế
--                toán phải tự chọn tay (đánh dấu ĐỎ trên giao diện)
--   'matched'   — tìm ra ĐÚNG 1 ve_bookings khớp ticket_no, và mã khách của
--                booking đó tồn tại + active trong vmb_khach_hang → hệ
--                thống tự điền ma_khach (đánh dấu XANH LÁ)
--   'manual'    — kế toán tự gõ/chọn tay mã khách (qua ô "Tìm mã khách" có
--                sẵn hoặc bảng gợi ý trong slide-over mới) → KHÔNG phải máy
--                tự xác minh, phải phân biệt rõ với 'matched' (đánh dấu
--                XANH DƯƠNG/XÁM, không lẫn với xanh lá)
-- matched_booking_id: trỏ đúng dòng ve_bookings đã dùng để tự điền/gợi ý —
-- để slide-over biết ngay dòng nào từng liên quan. ON DELETE SET NULL (thay
-- vì FK cứng chặn xoá) vì ve_bookings có thể bị dọn tay sau này
-- (DELETE /api/ve-may-bay/bookings), không muốn việc đó kéo theo lỗi/xoá lây
-- dữ liệu công nợ đã chốt sổ.
ALTER TABLE ve_debt_records ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE ve_debt_records ADD COLUMN IF NOT EXISTS matched_booking_id UUID REFERENCES ve_bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ve_debt_records_match_status_idx ON ve_debt_records (match_status);

-- ve_bookings.ticket_no hiện CHƯA có index (bảng do bot Telegram riêng ghi
-- vào, phình dần theo thời gian) — thiếu index này thì mỗi lần khớp hàng
-- loạt hoặc mở slide-over đều full scan. KHÔNG đặt unique: cùng 1 ticket_no
-- có thể xuất hiện ở nhiều dòng ve_bookings (đây chính là ca "khớp mơ hồ"
-- phải xử lý ở tầng logic ứng dụng, không phải giả định 1-1 ở tầng DB).
CREATE INDEX IF NOT EXISTS ve_bookings_ticket_no_idx ON ve_bookings (ticket_no);

-- Dữ liệu công nợ đã có SẴN mã khách TRƯỚC KHI tính năng này ra đời là do kế
-- toán tự gõ/chọn tay từ trước (lúc đó chưa có auto-match) — đánh dấu
-- 'manual' cho đúng ý nghĩa mới của match_status, tránh hiện nhầm màu đỏ
-- cho các dòng cũ đã có mã khách đúng. Dòng nào ma_khach đang rỗng thì giữ
-- mặc định 'unmatched' — sẽ được xử lý bởi nút "Khớp lại mã khách" (chạy 1
-- lần ngay sau khi deploy để backfill).
UPDATE ve_debt_records SET match_status = 'manual' WHERE ma_khach IS NOT NULL AND match_status = 'unmatched';
