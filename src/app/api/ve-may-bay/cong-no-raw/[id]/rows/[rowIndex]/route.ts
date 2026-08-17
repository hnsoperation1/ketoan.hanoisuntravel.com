import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string; rowIndex: string }> }

// PATCH { ma_khach, matched_booking_id? } — gán tay mã khách cho 1 dòng
// trong lô raw (qua slide-over). Cùng semantics với PATCH
// /api/ve-may-bay/cong-no/[id]: có giá trị → match_status='manual', rỗng →
// 'unmatched'. Upsert vì dòng này có thể chưa từng có bản ghi sidecar (bảng
// ve_debt_records_raw_match "thưa" — chỉ tạo dòng khi có việc cần lưu).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, rowIndex } = await ctx.params
  const rowIndexNum = Number(rowIndex)
  if (!Number.isInteger(rowIndexNum) || rowIndexNum < 0) {
    return NextResponse.json({ error: 'rowIndex không hợp lệ' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const val = body.ma_khach ? String(body.ma_khach).trim() : null
  const matchStatus = val ? 'manual' : 'unmatched'
  const matchedBookingId = val && typeof body.matched_booking_id === 'string' ? body.matched_booking_id : null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_debt_records_raw_match')
    .upsert(
      { raw_batch_id: id, row_index: rowIndexNum, ma_khach: val, match_status: matchStatus, matched_booking_id: matchedBookingId },
      { onConflict: 'raw_batch_id,row_index' },
    )
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
