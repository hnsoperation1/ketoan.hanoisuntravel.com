ALTER TABLE ve_debt_records_raw_match ADD COLUMN IF NOT EXISTS gia_mua NUMERIC;
ALTER TABLE ve_debt_records_raw_match ADD COLUMN IF NOT EXISTS gia_ban NUMERIC;
ALTER TABLE ve_debt_records_raw_match ADD COLUMN IF NOT EXISTS gia_source TEXT;
