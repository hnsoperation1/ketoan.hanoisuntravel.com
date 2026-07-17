import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Dùng service role — bỏ qua RLS. Chỉ gọi từ route handler server-side
// (Telegram webhook, cron, tác vụ hệ thống), không bao giờ export ra client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
