CREATE TABLE IF NOT EXISTS ve_debt_records_raw_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_batch_id UUID NOT NULL REFERENCES ve_debt_records_raw(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  ma_khach TEXT,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  matched_booking_id UUID REFERENCES ve_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (raw_batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS ve_debt_records_raw_match_batch_idx ON ve_debt_records_raw_match (raw_batch_id);
CREATE INDEX IF NOT EXISTS ve_bookings_ticket_no_idx ON ve_bookings (ticket_no);
