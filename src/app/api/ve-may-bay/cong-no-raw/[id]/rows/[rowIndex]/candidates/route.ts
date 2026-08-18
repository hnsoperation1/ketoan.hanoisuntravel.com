import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { buildCandidateMessages } from '@/lib/ve-may-bay/candidate-messages'

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
    return NextResponse.json({ data: { idValue: null, match: match ?? null, messages: [], khachInfo: {} } })
  }

  const result = await buildCandidateMessages(admin, idValue, match?.ma_khach ?? null)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ data: { idValue, match: match ?? null, ...result } })
}
