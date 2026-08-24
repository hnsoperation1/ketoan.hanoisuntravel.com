import type { AdminClient } from '@/lib/ve-may-bay/match-ma-khach'

export type CandidatePax = {
  id: string
  ticket_no: string | null
  ma_khach: string | null
  ten_khach_hang: string | null
  full_name: string | null
  routing: string | null
  gia_mua: number | null
  gia_ban: number | null
  ve_tkt: { tkt_code: string | null; ten_nhan_vien: string | null } | null
}

export type CandidateMessage = {
  parse_log_id: string
  raw_message: string | null
  created_at: string
  from_user_name: string | null
  group_title: string | null
  pax: CandidatePax[]
}

export type KhachInfo = Record<string, { ten_khach: string | null; active: boolean }>

type AnchorRow = CandidatePax & {
  parse_log_id: string | null
  created_at: string
  ve_parse_logs: {
    raw_message: string | null
    created_at: string | null
    from_user_name: string | null
    ve_telegram_groups: { telegram_chat_title: string | null } | null
  } | null
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
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message, created_at, from_user_name, ve_telegram_groups(telegram_chat_title))')
    .eq('ticket_no', ticketNo)
    .order('created_at', { ascending: false })
  if (anchorErr) return { error: anchorErr.message }

  const anchors = (anchorRaw ?? []) as AnchorRow[]
  const parseLogIds = Array.from(new Set(anchors.map(a => a.parse_log_id).filter((x): x is string => !!x)))
  if (parseLogIds.length === 0) return { messages: [], khachInfo: {} }

  // order theo pax_order (vị trí trong tin nhắn gốc, ghi bởi
  // hns-ticket-parser lúc insertBookings) — nullsFirst: false để dòng cũ từ
  // trước khi có cột này (pax_order = null) rơi xuống cuối mỗi nhóm thay vì
  // xen lẫn ngẫu nhiên.
  const { data: allPaxRaw, error: paxErr } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien)')
    .in('parse_log_id', parseLogIds)
    .order('pax_order', { ascending: true, nullsFirst: false })
  if (paxErr) return { error: paxErr.message }

  const allPax = (allPaxRaw ?? []) as (CandidatePax & { parse_log_id: string | null; created_at: string })[]

  const metaByLog = new Map<string, { raw_message: string | null; created_at: string; from_user_name: string | null; group_title: string | null }>()
  for (const a of anchors) {
    if (!a.parse_log_id || metaByLog.has(a.parse_log_id)) continue
    metaByLog.set(a.parse_log_id, {
      raw_message: a.ve_parse_logs?.raw_message ?? null,
      created_at: a.ve_parse_logs?.created_at ?? a.created_at,
      from_user_name: a.ve_parse_logs?.from_user_name ?? null,
      group_title: a.ve_parse_logs?.ve_telegram_groups?.telegram_chat_title ?? null,
    })
  }

  const messages: CandidateMessage[] = parseLogIds
    .map(logId => {
      const meta = metaByLog.get(logId)
      // Không sort theo tên nữa — giữ đúng thứ tự pax xuất hiện trong tin
      // nhắn gốc (kế toán cần đối chiếu song song với nguyên văn tin nhắn ở
      // panel bên trái), lấy từ query .order('pax_order', ...) ở trên nên
      // thứ tự trong mảng đã đúng sẵn, chỉ cần filter theo logId.
      const pax = allPax.filter(p => p.parse_log_id === logId)
      return {
        parse_log_id: logId,
        raw_message: meta?.raw_message ?? null,
        created_at: meta?.created_at ?? '',
        from_user_name: meta?.from_user_name ?? null,
        group_title: meta?.group_title ?? null,
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

// Số mã vé/parse_log_id/mã khách tối đa nhồi vào 1 câu .in() — PostgREST đẩy
// hết giá trị lên query string nên danh sách quá dài sẽ vượt giới hạn độ dài
// URL (xem candidates-summary/route.ts, đã gặp giới hạn này trước đây).
const IN_CHUNK = 300

async function selectInChunks<T>(
  admin: AdminClient,
  table: string,
  select: string,
  column: string,
  values: string[],
  orderCol?: string,
  orderOpts?: { ascending: boolean; nullsFirst?: boolean },
): Promise<{ data: T[] } | { error: string }> {
  const out: T[] = []
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const chunk = values.slice(i, i + IN_CHUNK)
    let q = admin.from(table).select(select).in(column, chunk)
    if (orderCol) q = q.order(orderCol, orderOpts)
    const { data, error } = await q
    if (error) return { error: error.message }
    out.push(...((data ?? []) as T[]))
  }
  return { data: out }
}

// Bản GỘP LÔ của buildCandidateMessages — thay vì gọi lại hàm trên riêng
// từng mã vé (mỗi lần 2-3 query), gộp .in() lại làm 1-2 lượt cho CẢ danh
// sách mã vé, dùng khi cần tin nhắn của TOÀN BỘ dòng trong 1 lô công nợ NCC
// ngay khi mở tab (xem candidates-bulk/route.ts) — tránh bắn hàng loạt
// request nhỏ lẻ mỗi lần đổi dòng đang xem.
export async function buildCandidateMessagesBulk(
  admin: AdminClient,
  ticketNos: string[],
  extraMaKhachList: string[] = [],
): Promise<{ messagesByTicket: Record<string, CandidateMessage[]>; khachInfo: KhachInfo } | { error: string }> {
  const uniqueTickets = Array.from(new Set(ticketNos))
  if (uniqueTickets.length === 0) return { messagesByTicket: {}, khachInfo: {} }

  const anchorsRes = await selectInChunks<AnchorRow & { ticket_no: string }>(
    admin, 've_bookings',
    '*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message, created_at, from_user_name, ve_telegram_groups(telegram_chat_title))',
    'ticket_no', uniqueTickets, 'created_at', { ascending: false },
  )
  if ('error' in anchorsRes) return { error: anchorsRes.error }
  const anchors = anchorsRes.data

  // 1 ticket_no có thể xuất hiện trong nhiều parse_log_id khác nhau qua
  // thời gian (gửi lại/sửa tin) — gom hết để không bỏ sót tin nào.
  const logIdsByTicket = new Map<string, Set<string>>()
  for (const a of anchors) {
    if (!a.parse_log_id) continue
    if (!logIdsByTicket.has(a.ticket_no)) logIdsByTicket.set(a.ticket_no, new Set())
    logIdsByTicket.get(a.ticket_no)!.add(a.parse_log_id)
  }
  const allParseLogIds = Array.from(new Set(anchors.map(a => a.parse_log_id).filter((x): x is string => !!x)))
  if (allParseLogIds.length === 0) return { messagesByTicket: {}, khachInfo: {} }

  const paxRes = await selectInChunks<CandidatePax & { parse_log_id: string | null; created_at: string }>(
    admin, 've_bookings', '*, ve_tkt(tkt_code, ten_nhan_vien)',
    'parse_log_id', allParseLogIds, 'pax_order', { ascending: true, nullsFirst: false },
  )
  if ('error' in paxRes) return { error: paxRes.error }
  const allPax = paxRes.data

  const metaByLog = new Map<string, { raw_message: string | null; created_at: string; from_user_name: string | null; group_title: string | null }>()
  for (const a of anchors) {
    if (!a.parse_log_id || metaByLog.has(a.parse_log_id)) continue
    metaByLog.set(a.parse_log_id, {
      raw_message: a.ve_parse_logs?.raw_message ?? null,
      created_at: a.ve_parse_logs?.created_at ?? a.created_at,
      from_user_name: a.ve_parse_logs?.from_user_name ?? null,
      group_title: a.ve_parse_logs?.ve_telegram_groups?.telegram_chat_title ?? null,
    })
  }

  const messagesByLog = new Map<string, CandidateMessage>()
  for (const logId of allParseLogIds) {
    const meta = metaByLog.get(logId)
    messagesByLog.set(logId, {
      parse_log_id: logId,
      raw_message: meta?.raw_message ?? null,
      created_at: meta?.created_at ?? '',
      from_user_name: meta?.from_user_name ?? null,
      group_title: meta?.group_title ?? null,
      pax: allPax.filter(p => p.parse_log_id === logId),
    })
  }

  const messagesByTicket: Record<string, CandidateMessage[]> = {}
  for (const ticketNo of uniqueTickets) {
    messagesByTicket[ticketNo] = Array.from(logIdsByTicket.get(ticketNo) ?? [])
      .map(id => messagesByLog.get(id))
      .filter((m): m is CandidateMessage => !!m)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  const maKhachList = Array.from(new Set([
    ...allPax.map(p => p.ma_khach).filter((x): x is string => !!x),
    ...extraMaKhachList,
  ]))
  const khachInfo: KhachInfo = {}
  if (maKhachList.length > 0) {
    const khachRes = await selectInChunks<{ ma_khach: string; ten_khach: string | null; active: boolean }>(
      admin, 'vmb_khach_hang', 'ma_khach, ten_khach, active', 'ma_khach', maKhachList,
    )
    if ('error' in khachRes) return { error: khachRes.error }
    for (const k of khachRes.data) khachInfo[k.ma_khach] = { ten_khach: k.ten_khach, active: k.active }
  }

  return { messagesByTicket, khachInfo }
}
