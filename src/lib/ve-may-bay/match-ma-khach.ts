import type { createAdminClient } from '@/lib/supabase/admin'

export type AdminClient = ReturnType<typeof createAdminClient>

export type MatchResult = {
  checked: number
  matched: number
  unmatched: number
  skipped: number
  errors: string[]
}

export type BookingRow = { id: string; ticket_no: string | null; ma_khach: string | null }
export type MatchDecision = { match_status: 'matched' | 'unmatched'; matched_booking_id: string | null; ma_khach?: string }

type DebtTarget = { id: string; ticket_no: string | null; ma_khach: string | null; match_status: string }

// Quyết định thuần (không đụng DB) cho 1 dòng cần khớp — dùng chung giữa
// runMatchMaKhach (ve_debt_records, cấu trúc) và runMatchMaKhachRaw
// (ve_debt_records_raw, nguyên xi) vì logic khớp giống hệt nhau, chỉ khác
// nguồn dữ liệu/nơi ghi kết quả. Đúng 1 booking khớp idValue + mã khách
// booking đó tồn tại/active trong danh mục chuẩn → matched, tự điền
// ma_khach CHỈ khi dòng đang rỗng (không ghi đè). Mơ hồ (0 hoặc >1 booking)
// hoặc mã khách không hợp lệ → unmatched.
export function decideMatch(
  idValue: string,
  existingMaKhach: string | null,
  bookingsByTicket: Map<string, BookingRow[]>,
  directoryMap: Map<string, string>,
): MatchDecision {
  const candidates = bookingsByTicket.get(idValue) ?? []
  const booking = candidates.length === 1 ? candidates[0] : undefined
  const canonical = booking?.ma_khach ? directoryMap.get(booking.ma_khach.toUpperCase()) : undefined

  if (booking && canonical) {
    const decision: MatchDecision = { match_status: 'matched', matched_booking_id: booking.id }
    if (!existingMaKhach) decision.ma_khach = canonical
    return decision
  }
  return { match_status: 'unmatched', matched_booking_id: null }
}

// Batch-fetch ve_bookings (theo idValues) + danh mục khách hàng active — 2
// query dùng chung giữa cả 2 luồng khớp (structured/raw), tránh viết lại.
export async function fetchBookingsAndDirectory(
  admin: AdminClient,
  idValues: string[],
): Promise<{ ok: true; bookingsByTicket: Map<string, BookingRow[]>; directoryMap: Map<string, string> } | { ok: false; error: string }> {
  const { data: bookingsRaw, error: bookingsErr } = await admin
    .from('ve_bookings')
    .select('id, ticket_no, ma_khach')
    .in('ticket_no', idValues)
  if (bookingsErr) return { ok: false, error: bookingsErr.message }

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
  if (directoryErr) return { ok: false, error: directoryErr.message }

  const directoryMap = new Map<string, string>()
  for (const d of (directoryRaw ?? []) as { ma_khach: string }[]) {
    directoryMap.set(d.ma_khach.toUpperCase(), d.ma_khach)
  }

  return { ok: true, bookingsByTicket, directoryMap }
}

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

  const idValues = Array.from(new Set(rowsToMatch.map(r => r.ticket_no as string)))
  const fetched = await fetchBookingsAndDirectory(admin, idValues)
  if (!fetched.ok) {
    result.errors.push(fetched.error)
    return result
  }
  const { bookingsByTicket, directoryMap } = fetched

  for (const row of rowsToMatch) {
    result.checked++
    const decision = decideMatch(row.ticket_no as string, row.ma_khach, bookingsByTicket, directoryMap)
    if (decision.match_status === 'matched') result.matched++
    else result.unmatched++

    const { error: updateErr } = await admin.from('ve_debt_records').update(decision).eq('id', row.id)
    if (updateErr) result.errors.push(`${row.id}: ${updateErr.message}`)
  }

  return result
}
