import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdminUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// POST — { tkt_id?: string | null, ma_khach_mac_dinh?: string | null,
// chi_hoan_ve?: boolean } — gán (hoặc bỏ gán nếu null) TKT và/hoặc mã
// khách mặc định, và/hoặc đánh dấu nhóm CHUYÊN nhập vé hoàn (bot tự thêm
// gợi ý đọc mặc định là hoàn vé, xem lib/openai.ts repo hns-ticket-parser)
// cho 1 nhóm Telegram. Chỉ field nào có mặt trong body mới bị ghi đè (dùng
// 'in' thay vì kiểm tra truthy để phân biệt được "cố tình gửi null để xoá"
// với "không gửi field này").
export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('tkt_id' in body) update.tkt_id = body.tkt_id ?? null
  if ('ma_khach_mac_dinh' in body) update.ma_khach_mac_dinh = body.ma_khach_mac_dinh?.trim() || null
  if ('chi_hoan_ve' in body) update.chi_hoan_ve = !!body.chi_hoan_ve

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_telegram_groups')
    .update(update)
    .eq('id', id)
    .select('*, ve_tkt(tkt_code, ten_nhan_vien)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
