import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'

// GET — toàn bộ ve_parse_logs (mọi lần bot trung tâm trong hns-ticket-parser
// thử đọc 1 tin nhắn, kể cả tin không phải vé/lỗi) — bot này chạy im lặng
// hoàn toàn, KHÔNG trả lời gì vào Telegram (xem chú thích trong
// webhook-central/route.ts), nên đây là nơi DUY NHẤT tra được vì sao 1 tin
// nhắn không thành ve_bookings. Trang này lộ nguyên văn tin nhắn Telegram +
// JSON AI đọc được của MỌI TKT, không riêng gì kế toán — chỉ người được
// Super Admin tick màn kt-nhat-ky (hoặc Super Admin); chưa chạy migration
// screen_access thì theo luật cũ = chỉ Super Admin (xem requireScreen).
export async function GET() {
  const { unauthorized } = await requireScreen('kt-nhat-ky')
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_parse_logs')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_telegram_groups(telegram_chat_title)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
