ALTER TABLE ve_debt_records ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE ve_debt_records ADD COLUMN IF NOT EXISTS matched_booking_id UUID REFERENCES ve_bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ve_debt_records_match_status_idx ON ve_debt_records (match_status);

CREATE INDEX IF NOT EXISTS ve_bookings_ticket_no_idx ON ve_bookings (ticket_no);

UPDATE ve_debt_records SET match_status = 'manual' WHERE ma_khach IS NOT NULL AND match_status = 'unmatched';
