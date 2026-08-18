import type { AdminClient } from '@/lib/ve-may-bay/match-ma-khach'

export type CandidatePax = {
  id: string
  ticket_no: string | null
  ma_khach: string | null
  ten_khach_hang: string | null
  full_name: string | null
  routing: string | null
  ve_tkt: { tkt_code: string | null; ten_nhan_vien: string | null } | null
}

export type CandidateMessage = {
  parse_log_id: string
  raw_message: string | null
  created_at: string
  from_user_name: string | null
  pax: CandidatePax[]
}

export type KhachInfo = Record<string, { ten_khach: string | null; active: boolean }>

type AnchorRow = CandidatePax & {
  parse_log_id: string | null
  created_at: string
  ve_parse_logs: { raw_message: string | null; created_at: string | null; from_user_name: string | null } | null
}

// Gom candidate theo TIN NHẮN thay vì theo từng dòng ve_bookings — 1 tin
// nhắn Telegram thường liệt kê nhiều pax/nhiều PNR gộp chung (bot tách mỗi
// pax thành 1 dòng ve_bookings riêng nhưng cùng parse_log_id), nên chỉ khớp
// đúng ticket_no thôi thì bỏ sót các pax khác trong CÙNG tin nhắn đó mà kế
// toán có thể cũng cần chọn. Dùng chung cho cả candidates route của
// ve_debt_records (structured) và ve_debt_records_raw (raw).
export async function buildCandidateMessages(
  admin: AdminClient,
  ticketNo: string,
  extraMaKhach: string | null,
): Promise<{ messages: CandidateMessage[]; khachInfo: KhachInfo } | { error: string }> {
  const { data: anchorRaw, error: anchorErr } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message, created_at, from_user_name)')
    .eq('ticket_no', ticketNo)
    .order('created_at', { ascending: false })
  if (anchorErr) return { error: anchorErr.message }

  const anchors = (anchorRaw ?? []) as AnchorRow[]
  const parseLogIds = Array.from(new Set(anchors.map(a => a.parse_log_id).filter((x): x is string => !!x)))
  if (parseLogIds.length === 0) return { messages: [], khachInfo: {} }

  const { data: allPaxRaw, error: paxErr } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien)')
    .in('parse_log_id', parseLogIds)
  if (paxErr) return { error: paxErr.message }

  const allPax = (allPaxRaw ?? []) as (CandidatePax & { parse_log_id: string | null; created_at: string })[]

  const metaByLog = new Map<string, { raw_message: string | null; created_at: string; from_user_name: string | null }>()
  for (const a of anchors) {
    if (!a.parse_log_id || metaByLog.has(a.parse_log_id)) continue
    metaByLog.set(a.parse_log_id, {
      raw_message: a.ve_parse_logs?.raw_message ?? null,
      created_at: a.ve_parse_logs?.created_at ?? a.created_at,
      from_user_name: a.ve_parse_logs?.from_user_name ?? null,
    })
  }

  const messages: CandidateMessage[] = parseLogIds
    .map(logId => {
      const meta = metaByLog.get(logId)
      const pax = allPax
        .filter(p => p.parse_log_id === logId)
        .sort((a, b) => normalizePaxName(a.full_name ?? a.ten_khach_hang).localeCompare(normalizePaxName(b.full_name ?? b.ten_khach_hang)))
      return {
        parse_log_id: logId,
        raw_message: meta?.raw_message ?? null,
        created_at: meta?.created_at ?? '',
        from_user_name: meta?.from_user_name ?? null,
        pax,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const maKhachList = Array.from(new Set(
    [...allPax.map(p => p.ma_khach), extraMaKhach].filter((x): x is string => !!x),
  ))

  const khachInfo: KhachInfo = {}
  if (maKhachList.length > 0) {
    const { data: khach, error: khachErr } = await admin
      .from('vmb_khach_hang')
      .select('ma_khach, ten_khach, active')
      .in('ma_khach', maKhachList)
    if (khachErr) return { error: khachErr.message }
    for (const k of khach ?? []) {
      khachInfo[k.ma_khach] = { ten_khach: k.ten_khach, active: k.active }
    }
  }

  return { messages, khachInfo }
}

function normalizePaxName(s: string | null): string {
  return (s ?? '').trim().toUpperCase()
}
