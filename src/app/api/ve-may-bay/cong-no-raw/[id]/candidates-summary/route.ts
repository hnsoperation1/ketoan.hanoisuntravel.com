import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'

type Ctx = { params: Promise<{ id: string }> }

// Số mã vé tối đa nhồi vào 1 câu .in() — PostgREST đẩy hết giá trị lên
// query string nên danh sách quá dài sẽ vượt giới hạn độ dài URL và lỗi.
// Lô công nợ NCC thật có thể vài trăm tới vài nghìn dòng nên phải chia mẻ.
const IN_CHUNK = 300

// GET — dòng nào trong lô CÓ tin nhắn Telegram khớp mã vé/PNR. Bảng chính
// cần biết trước điều này cho MỌI dòng (để hiện dấu hiệu ngay, không phải
// bấm từng dòng mới biết), nên tổng hợp 1 lượt ở đây thay vì gọi route
// candidates (nặng: kéo cả nội dung tin nhắn + pax + danh mục khách) cho
// từng dòng một.
//
// "Có khớp" định nghĩa GIỐNG HỆT route candidates: tồn tại ve_bookings với
// đúng ticket_no đó VÀ có parse_log_id (tin nhắn gốc) — buildCandidateMessages
// trả mảng rỗng khi không có parse_log_id nào, nên điều kiện phải khớp y
// hệt, tránh cảnh bảng báo "có" mà bấm vào panel lại rỗng.
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
  if (idColIdx == null) return NextResponse.json({ data: { rowsWithCandidates: [] } })

  const rows: string[][] = batch.rows ?? []
  // Nhiều dòng có thể trùng mã vé (vé đoàn tách dòng) — gom về map để chỉ
  // hỏi DB 1 lần cho mỗi mã, rồi trả kết quả về đúng mọi dòng dùng mã đó.
  const rowsByTicket = new Map<string, number[]>()
  rows.forEach((r, i) => {
    const v = r?.[idColIdx]?.trim()
    if (!v) return
    const list = rowsByTicket.get(v)
    if (list) list.push(i)
    else rowsByTicket.set(v, [i])
  })

  const tickets = Array.from(rowsByTicket.keys())
  if (tickets.length === 0) return NextResponse.json({ data: { rowsWithCandidates: [] } })

  const found = new Set<string>()
  for (let i = 0; i < tickets.length; i += IN_CHUNK) {
    const chunk = tickets.slice(i, i + IN_CHUNK)
    const { data, error } = await admin
      .from('ve_bookings')
      .select('ticket_no')
      .in('ticket_no', chunk)
      .not('parse_log_id', 'is', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    for (const b of data ?? []) if (b.ticket_no) found.add(b.ticket_no)
  }

  const rowsWithCandidates: number[] = []
  for (const [ticket, idxs] of rowsByTicket) {
    if (found.has(ticket)) rowsWithCandidates.push(...idxs)
  }
  rowsWithCandidates.sort((a, b) => a - b)

  return NextResponse.json({ data: { rowsWithCandidates } })
}
