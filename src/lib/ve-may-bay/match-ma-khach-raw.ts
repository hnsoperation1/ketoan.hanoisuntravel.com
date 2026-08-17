import type { AdminClient, MatchResult } from '@/lib/ve-may-bay/match-ma-khach'
import { decideMatch, fetchBookingsAndDirectory } from '@/lib/ve-may-bay/match-ma-khach'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'

type RawBatchTarget = { id: string; headers: string[]; rows: string[][] }
type PendingRow = { batchId: string; rowIndex: number; idValue: string }

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

    const { data: manualRows, error: manualErr } = await admin
      .from('ve_debt_records_raw_match')
      .select('row_index')
      .eq('raw_batch_id', batch.id)
      .eq('match_status', 'manual')
    if (manualErr) {
      result.errors.push(`${batch.id}: ${manualErr.message}`)
      continue
    }
    const manualRowIndexes = new Set((manualRows ?? []).map(r => r.row_index as number))

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
      pending.push({ batchId: batch.id, rowIndex, idValue })
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

    const { error: upsertErr } = await admin
      .from('ve_debt_records_raw_match')
      .upsert(
        { raw_batch_id: p.batchId, row_index: p.rowIndex, ...decision },
        { onConflict: 'raw_batch_id,row_index' },
      )
    if (upsertErr) result.errors.push(`${p.batchId}:${p.rowIndex}: ${upsertErr.message}`)
  }

  return result
}
