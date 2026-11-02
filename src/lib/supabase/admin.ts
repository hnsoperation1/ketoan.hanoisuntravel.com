import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { auditFetch } from './audit'

// Dùng service role — bỏ qua RLS. Chỉ gọi từ route handler server-side
// (Telegram webhook, cron, tác vụ hệ thống), không bao giờ export ra client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Nhật ký hoạt động: kèm app + người đang thao tác (đọc từ cookie của request) — xem ./audit.ts
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: auditFetch } },
  )
}
