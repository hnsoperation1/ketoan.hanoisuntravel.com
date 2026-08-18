import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string; rowIndex: string }> }

// PATCH { ma_khach?, matched_booking_id?, gia_mua?, gia_ban? } — sửa tay 1
// dòng trong lô raw (qua slide-over hoặc bấm cây viết sửa giá). Partial
// update thật sự — chỉ field nào có mặt trong body mới bị đụng tới, tránh
// PATCH giá vô tình xoá mất mã khách đang có (và ngược lại). Upsert vì dòng
// này có thể chưa từng có bản ghi sidecar (bảng ve_debt_records_raw_match
// "thưa" — chỉ tạo dòng khi có việc cần lưu).
//
// gia_source: 'message' khi request đi kèm matched_booking_id (chọn 1 pax
// cụ thể từ slide-over — giá lấy đúng theo booking đó), 'manual' khi chỉ
// sửa gia_mua/gia_ban đơn thuần (bấm cây viết gõ tay, không có
// matched_booking_id đi kèm) — phân biệt rõ với auto-match
// (match-ma-khach-raw.ts) cũng gắn 'message' khi tự điền.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, rowIndex } = await ctx.params
  const rowIndexNum = Number(rowIndex)
  if (!Number.isInteger(rowIndexNum) || rowIndexNum < 0) {
    return NextResponse.json({ error: 'rowIndex không hợp lệ' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const payload: Record<string, string | number | null> = {}

  if ('ma_khach' in body) {
    const val = body.ma_khach ? String(body.ma_khach).trim() : null
    payload.ma_khach = val
    payload.match_status = val ? 'manual' : 'unmatched'
    payload.matched_booking_id = val && typeof body.matched_booking_id === 'string' ? body.matched_booking_id : null
  }

  if ('gia_mua' in body || 'gia_ban' in body) {
    if ('gia_mua' in body) payload.gia_mua = typeof body.gia_mua === 'number' ? body.gia_mua : null
    if ('gia_ban' in body) payload.gia_ban = typeof body.gia_ban === 'number' ? body.gia_ban : null
    payload.gia_source = typeof body.matched_booking_id === 'string' ? 'message' : 'manual'
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_debt_records_raw_match')
    .upsert(
      { raw_batch_id: id, row_index: rowIndexNum, ...payload },
      { onConflict: 'raw_batch_id,row_index' },
    )
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
