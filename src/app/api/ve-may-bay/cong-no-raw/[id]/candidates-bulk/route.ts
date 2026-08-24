import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { buildCandidateMessagesBulk, type CandidateMessage, type KhachInfo } from '@/lib/ve-may-bay/candidate-messages'

type Ctx = { params: Promise<{ id: string }> }

// GET — tin nhắn Telegram khớp mã vé cho TOÀN BỘ dòng trong 1 lô, gọi 1 LẦN
// khi mở/đổi tab (chạy nền, xem RawBatchesView) thay vì gọi route
// rows/[rowIndex]/candidates riêng cho MỖI dòng đang xem — tránh bắn hàng
// loạt request khi kế toán rà nhanh nhiều dòng bằng mũi tên lên/xuống. Cùng
// điều kiện khớp với route candidates đơn dòng, chỉ gộp các câu .in() lại
// làm 1 lượt cho cả lô (xem buildCandidateMessagesBulk).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: batch, error: batchErr } = await admin
    .from('ve_debt_records_raw')
    .select('id, headers, rows')
    .eq('id', id)
    .single()
  if (batchErr || !batch) return NextResponse.json({ error: 'Không tìm thấy lô công nợ' }, { status: 404 })

  const idColIdx = findIdColumnIndex(batch.headers)
  const rows: string[][] = batch.rows ?? []
  const idValueByRow = new Map<number, string>()
  if (idColIdx != null) {
    rows.forEach((r, i) => {
      const v = r?.[idColIdx]?.trim()
      if (v) idValueByRow.set(i, v)
    })
  }
  const ticketNos = Array.from(new Set(idValueByRow.values()))

  const { data: matches, error: matchErr } = await admin
    .from('ve_debt_records_raw_match')
    .select('row_index, ma_khach, match_status, matched_booking_id')
    .eq('raw_batch_id', id)
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 400 })
  const matchByRow = new Map((matches ?? []).map(m => [m.row_index, m]))

  const extraMaKhachList = Array.from(new Set(
    Array.from(matchByRow.values()).map(m => m.ma_khach).filter((x): x is string => !!x),
  ))

  const result = await buildCandidateMessagesBulk(admin, ticketNos, extraMaKhachList)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  // khachInfo dùng CHUNG cho mọi dòng (đã gộp/khử trùng lặp mã khách ở
  // buildCandidateMessagesBulk) — tách riêng ở top-level thay vì lặp lại
  // trong TỪNG dòng để tránh JSON phình to vô ích khi nhiều dòng cùng khách.
  type RowMatch = { row_index: number; ma_khach: string | null; match_status: string; matched_booking_id: string | null }
  const rowsData: Record<number, { idValue: string | null; match: RowMatch | null; messages: CandidateMessage[] }> = {}
  rows.forEach((_, i) => {
    const idValue = idValueByRow.get(i) ?? null
    rowsData[i] = {
      idValue,
      match: matchByRow.get(i) ?? null,
      messages: idValue ? (result.messagesByTicket[idValue] ?? []) : [],
    }
  })

  return NextResponse.json({ data: { rows: rowsData, khachInfo: result.khachInfo as KhachInfo } })
}
