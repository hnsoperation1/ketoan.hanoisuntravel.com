import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// GET — tin nhắn/booking Telegram khớp ticket_no của 1 dòng công nợ, cho
// slide-over chọn tay khi không tự khớp được (hoặc muốn xem lại dòng đã
// khớp/đã chọn tay).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: debt, error: debtErr } = await admin
    .from('ve_debt_records')
    .select('id, ticket_no, ma_khach, match_status, matched_booking_id')
    .eq('id', id)
    .single()
  if (debtErr || !debt) return NextResponse.json({ error: 'Không tìm thấy dòng công nợ' }, { status: 404 })

  if (!debt.ticket_no) {
    return NextResponse.json({ data: { debt, candidates: [], khachInfo: {} } })
  }

  const { data: candidates, error: candErr } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message)')
    .eq('ticket_no', debt.ticket_no)
    .order('created_at', { ascending: false })
  if (candErr) return NextResponse.json({ error: candErr.message }, { status: 400 })

  const maKhachList = Array.from(new Set(
    [...(candidates ?? []).map(c => c.ma_khach), debt.ma_khach].filter((x): x is string => !!x),
  ))

  const khachInfo: Record<string, { ten_khach: string | null; active: boolean }> = {}
  if (maKhachList.length > 0) {
    const { data: khach, error: khachErr } = await admin
      .from('vmb_khach_hang')
      .select('ma_khach, ten_khach, active')
      .in('ma_khach', maKhachList)
    if (khachErr) return NextResponse.json({ error: khachErr.message }, { status: 400 })
    for (const k of khach ?? []) {
      khachInfo[k.ma_khach] = { ten_khach: k.ten_khach, active: k.active }
    }
  }

  return NextResponse.json({ data: { debt, candidates: candidates ?? [], khachInfo } })
}
