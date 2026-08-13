-- Cột nối 1 đoàn với đúng 1 đơn hàng (opportunities) bên CRM đã sinh ra nó
-- — dùng để CHỐNG TẠO TRÙNG khi trigger đồng bộ bên hns-crm chạy (xem
-- migration_sync_doan_from_opportunity.sql, repo hns-crm) — mỗi opportunity
-- chỉ tự tạo TỐI ĐA 1 đoàn. NULL với đoàn tạo tay như trước (không phải mọi
-- đoàn đều có nguồn gốc từ CRM).
--
-- QUAN TRỌNG: chạy migration NÀY trước migration bên hns-crm — trigger bên
-- đó cần cột opportunity_id đã tồn tại mới insert được.
ALTER TABLE doan ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS doan_opportunity_id_uidx ON doan(opportunity_id) WHERE opportunity_id IS NOT NULL;
