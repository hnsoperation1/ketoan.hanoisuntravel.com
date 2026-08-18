import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { buildCandidateMessages } from '@/lib/ve-may-bay/candidate-messages'

type Ctx = { params: Promise<{ id: string }> }

// GET — tin nhắn Telegram khớp ticket_no của 1 dòng công nợ (mỗi tin nhắn
// kèm toàn bộ pax bot đã tách ra từ đó, không chỉ pax khớp đúng ticket_no),
// cho slide-over chọn tay khi không tự khớp được (hoặc muốn xem lại dòng đã
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
    return NextResponse.json({ data: { debt, messages: [], khachInfo: {} } })
  }

  const result = await buildCandidateMessages(admin, debt.ticket_no, debt.ma_khach)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ data: { debt, ...result } })
}
