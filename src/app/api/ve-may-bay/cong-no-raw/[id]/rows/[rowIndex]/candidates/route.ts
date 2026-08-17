import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'

type Ctx = { params: Promise<{ id: string; rowIndex: string }> }

// GET — tin nhắn/booking Telegram khớp mã vé/PNR của 1 dòng trong lô công
// nợ NCC raw. Mã vé/PNR không lưu sẵn ở đâu — tự nhận diện cột theo
// headers của batch (findIdColumnIndex) rồi đọc thẳng từ rows[rowIndex].
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, rowIndex } = await ctx.params
  const rowIndexNum = Number(rowIndex)
  if (!Number.isInteger(rowIndexNum) || rowIndexNum < 0) {
    return NextResponse.json({ error: 'rowIndex không hợp lệ' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: batch, error: batchErr } = await admin
    .from('ve_debt_records_raw')
    .select('id, headers, rows')
    .eq('id', id)
    .single()
  if (batchErr || !batch) return NextResponse.json({ error: 'Không tìm thấy lô công nợ' }, { status: 404 })

  const row: string[] | undefined = batch.rows[rowIndexNum]
  if (!row) return NextResponse.json({ error: 'Không tìm thấy dòng này trong lô' }, { status: 404 })

  const idColIdx = findIdColumnIndex(batch.headers)
  const idValue = idColIdx != null ? row[idColIdx]?.trim() || null : null

  const { data: match } = await admin
    .from('ve_debt_records_raw_match')
    .select('ma_khach, match_status, matched_booking_id')
    .eq('raw_batch_id', id)
    .eq('row_index', rowIndexNum)
    .maybeSingle()

  if (!idValue) {
    return NextResponse.json({ data: { idValue: null, match: match ?? null, candidates: [], khachInfo: {} } })
  }

  const { data: candidates, error: candErr } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message)')
    .eq('ticket_no', idValue)
    .order('created_at', { ascending: false })
  if (candErr) return NextResponse.json({ error: candErr.message }, { status: 400 })

  const maKhachList = Array.from(new Set(
    [...(candidates ?? []).map(c => c.ma_khach), match?.ma_khach].filter((x): x is string => !!x),
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

  return NextResponse.json({ data: { idValue, match: match ?? null, candidates: candidates ?? [], khachInfo } })
}
