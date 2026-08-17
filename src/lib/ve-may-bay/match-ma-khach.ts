import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type MatchResult = {
  checked: number
  matched: number
  unmatched: number
  skipped: number
  errors: string[]
}

type DebtTarget = { id: string; ticket_no: string | null; ma_khach: string | null; match_status: string }
type BookingRow = { id: string; ticket_no: string | null; ma_khach: string | null }

// Khớp tuyệt đối theo ticket_no giữa ve_debt_records và ve_bookings (dữ liệu
// bot Telegram nhóm tkt đã parse ra). KHÔNG bao giờ đụng tới dòng
// match_status='manual' (kế toán đã tự chọn — không được ghi đè âm thầm, xem
// migration_ve_debt_records_match_ma_khach.sql). ids không truyền → chạy
// trên MỌI dòng đang 'unmatched' (dùng cho nút "Khớp lại mã khách"/backfill).
export async function runMatchMaKhach(admin: AdminClient, opts: { ids?: string[] } = {}): Promise<MatchResult> {
  const result: MatchResult = { checked: 0, matched: 0, unmatched: 0, skipped: 0, errors: [] }

  const { data: targetsRaw, error: targetsErr } = opts.ids && opts.ids.length > 0
    ? await admin.from('ve_debt_records').select('id, ticket_no, ma_khach, match_status').in('id', opts.ids)
    : await admin.from('ve_debt_records').select('id, ticket_no, ma_khach, match_status').eq('match_status', 'unmatched').limit(5000)
  if (targetsErr) {
    result.errors.push(targetsErr.message)
    return result
  }

  const targets = (targetsRaw ?? []) as DebtTarget[]
  const rowsToMatch = targets.filter(r => r.match_status !== 'manual' && r.ticket_no)
  result.skipped = targets.length - rowsToMatch.length
  if (rowsToMatch.length === 0) return result

  const ticketNos = Array.from(new Set(rowsToMatch.map(r => r.ticket_no as string)))
  const { data: bookingsRaw, error: bookingsErr } = await admin
    .from('ve_bookings')
    .select('id, ticket_no, ma_khach')
    .in('ticket_no', ticketNos)
  if (bookingsErr) {
    result.errors.push(bookingsErr.message)
    return result
  }

  const bookingsByTicket = new Map<string, BookingRow[]>()
  for (const b of (bookingsRaw ?? []) as BookingRow[]) {
    if (!b.ticket_no) continue
    const list = bookingsByTicket.get(b.ticket_no) ?? []
    list.push(b)
    bookingsByTicket.set(b.ticket_no, list)
  }

  const { data: directoryRaw, error: directoryErr } = await admin
    .from('vmb_khach_hang')
    .select('ma_khach')
    .eq('active', true)
  if (directoryErr) {
    result.errors.push(directoryErr.message)
    return result
  }
  const directoryMap = new Map<string, string>()
  for (const d of (directoryRaw ?? []) as { ma_khach: string }[]) {
    directoryMap.set(d.ma_khach.toUpperCase(), d.ma_khach)
  }

  for (const row of rowsToMatch) {
    result.checked++
    const candidates = bookingsByTicket.get(row.ticket_no as string) ?? []
    const booking = candidates.length === 1 ? candidates[0] : undefined
    const canonical = booking?.ma_khach ? directoryMap.get(booking.ma_khach.toUpperCase()) : undefined

    let update: { match_status: string; matched_booking_id: string | null; ma_khach?: string }
    if (booking && canonical) {
      update = { match_status: 'matched', matched_booking_id: booking.id }
      if (!row.ma_khach) update.ma_khach = canonical
      result.matched++
    } else {
      update = { match_status: 'unmatched', matched_booking_id: null }
      result.unmatched++
    }

    const { error: updateErr } = await admin.from('ve_debt_records').update(update).eq('id', row.id)
    if (updateErr) result.errors.push(`${row.id}: ${updateErr.message}`)
  }

  return result
}
