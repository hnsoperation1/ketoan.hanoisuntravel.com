import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdminUser } from '@/lib/auth'

// GET — danh sách nhóm Telegram bot trung tâm đã/đang là thành viên, kèm
// TKT đã gán (nếu có) — nhóm tkt_id NULL là "chờ gán", bot tự đăng ký
// nhóm vào bảng này khi được add vào (xem webhook-central bên
// hns-ticket-parser), không có gì tạo tay ở đây.
export async function GET() {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_telegram_groups')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
