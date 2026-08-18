import type { AdminClient, MatchResult } from '@/lib/ve-may-bay/match-ma-khach'
import { decideMatch, fetchBookingsAndDirectory } from '@/lib/ve-may-bay/match-ma-khach'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'

type RawBatchTarget = { id: string; headers: string[]; rows: string[][] }
type ExistingPrice = { gia_mua: number | null; gia_ban: number | null }
type PendingRow = { batchId: string; rowIndex: number; idValue: string; existingPrice: ExistingPrice }

// Bản dành cho ve_debt_records_raw (4 tab NCC cố định, dữ liệu nguyên xi
// không chuẩn hoá) — cùng thuật toán khớp với runMatchMaKhach
// (match-ma-khach.ts) qua decideMatch/fetchBookingsAndDirectory dùng chung,
// chỉ khác nguồn đọc (headers/rows theo cột thay vì cột ticket_no có sẵn) và
// nơi ghi (bảng sidecar ve_debt_records_raw_match, upsert theo
// (raw_batch_id, row_index) thay vì update thẳng dòng công nợ).
export async function runMatchMaKhachRaw(admin: AdminClient, opts: { batchIds?: string[] } = {}): Promise<MatchResult> {
  const result: MatchResult = { checked: 0, matched: 0, unmatched: 0, skipped: 0, errors: [] }

  const { data: batchesRaw, error: batchesErr } = opts.batchIds && opts.batchIds.length > 0
    ? await admin.from('ve_debt_records_raw').select('id, headers, rows').in('id', opts.batchIds).limit(200)
    : await admin.from('ve_debt_records_raw').select('id, headers, rows').limit(200)
  if (batchesErr) {
    result.errors.push(batchesErr.message)
    return result
  }
  const batches = (batchesRaw ?? []) as RawBatchTarget[]
  if (batches.length === 0) return result

  const pending: PendingRow[] = []

  for (const batch of batches) {
    const idColIdx = findIdColumnIndex(batch.headers)
    if (idColIdx == null) {
      result.skipped += batch.rows.length
      continue
    }

    const { data: existingRows, error: existingErr } = await admin
      .from('ve_debt_records_raw_match')
      .select('row_index, match_status, gia_mua, gia_ban')
      .eq('raw_batch_id', batch.id)
    if (existingErr) {
      result.errors.push(`${batch.id}: ${existingErr.message}`)
      continue
    }
    const manualRowIndexes = new Set(
      (existingRows ?? []).filter(r => r.match_status === 'manual').map(r => r.row_index as number),
    )
    const existingPriceByRow = new Map<number, ExistingPrice>(
      (existingRows ?? []).map(r => [r.row_index as number, { gia_mua: r.gia_mua, gia_ban: r.gia_ban }]),
    )

    batch.rows.forEach((row, rowIndex) => {
      if (manualRowIndexes.has(rowIndex)) {
        result.skipped++
        return
      }
      const idValue = row[idColIdx]?.trim()
      if (!idValue) {
        result.skipped++
        return
      }
      const existingPrice = existingPriceByRow.get(rowIndex) ?? { gia_mua: null, gia_ban: null }
      pending.push({ batchId: batch.id, rowIndex, idValue, existingPrice })
    })
  }

  if (pending.length === 0) return result

  const idValues = Array.from(new Set(pending.map(p => p.idValue)))
  const fetched = await fetchBookingsAndDirectory(admin, idValues)
  if (!fetched.ok) {
    result.errors.push(fetched.error)
    return result
  }
  const { bookingsByTicket, directoryMap } = fetched

  for (const p of pending) {
    result.checked++
    const decision = decideMatch(p.idValue, null, bookingsByTicket, directoryMap)
    if (decision.match_status === 'matched') result.matched++
    else result.unmatched++

    // Tự điền giá mua/giá bán từ đúng booking đã khớp — CHỈ khi dòng đang
    // chưa có giá trị đó (không ghi đè giá đã có, kể cả giá đó cũng từng tự
    // điền từ lần chạy trước). Từng trường xét riêng — có thể dòng đã có
    // giá mua tay nhưng chưa có giá bán, vẫn điền được giá bán.
    const priceFields: { gia_mua?: number; gia_ban?: number; gia_source?: string } = {}
    if (decision.match_status === 'matched' && decision.matched_booking_id) {
      const booking = (bookingsByTicket.get(p.idValue) ?? [])[0]
      if (booking) {
        if (p.existingPrice.gia_mua == null && booking.gia_mua != null) priceFields.gia_mua = booking.gia_mua
        if (p.existingPrice.gia_ban == null && booking.gia_ban != null) priceFields.gia_ban = booking.gia_ban
        if (priceFields.gia_mua != null || priceFields.gia_ban != null) priceFields.gia_source = 'message'
      }
    }

    const { error: upsertErr } = await admin
      .from('ve_debt_records_raw_match')
      .upsert(
        { raw_batch_id: p.batchId, row_index: p.rowIndex, ...decision, ...priceFields },
        { onConflict: 'raw_batch_id,row_index' },
      )
    if (upsertErr) result.errors.push(`${p.batchId}:${p.rowIndex}: ${upsertErr.message}`)
  }

  return result
}
