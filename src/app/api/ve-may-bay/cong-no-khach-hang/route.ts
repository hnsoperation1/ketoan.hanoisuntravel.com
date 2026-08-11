import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// Gộp công nợ theo khách hàng — nối các nguồn KHÔNG có khoá ngoại chung:
//   - "Phát sinh": ve_debt_records.ma_khach (nhập tay/upload Excel ở
//     /ve-may-bay/cong-no) + ve_bookings.ma_khach (bot Telegram tự trích
//     xuất, xem ở /ve-may-bay/thong-tin-xuat-ve) — 2 đường nhập liệu độc
//     lập cho cùng 1 khái niệm "vé đã xuất", vé nào chỉ đi qua bot mà chưa
//     từng upload Excel trước đó thì trước đây hoàn toàn không xuất hiện ở
//     trang này dù đã có mã khách. Dedupe theo ticket_no (PNR, field có ở
//     cả 2 bảng) để không cộng đúp nếu cùng 1 vé lỡ có ở cả 2 nguồn.
//   - "Đã thu": sao_ke_giao_dich.ten_du_an ("Đầu vào sao kê", cột "Dự án"
//     — cũng chính là cột hiển thị "Mã KH" ở trang /ve-may-bay/sao-ke-tk)
// Text nhập tay tự do, không phải FK tới 1 danh mục khách hàng thật — nối
// theo text đã trim + uppercase để đỡ lệch hoa/thường, không xử lý sai
// chính tả/viết tắt khác nhau.
function normKey(s: string | null): string | null {
  const t = (s ?? '').trim()
  return t === '' ? null : t.toUpperCase()
}

type PhatSinhRow = { ticket_no: string | null; pax_name: string | null; issued_date: string | null; routing: string | null; gia_ban: number | null }
type DaThuRow = { ngay: string | null; dien_giai: string | null; thu: number | null; tai_khoan: string | null }
type Agg = {
  ma_khach: string
  tong_phat_sinh: number
  tong_da_thu: number
  phat_sinh_rows: PhatSinhRow[]
  da_thu_rows: DaThuRow[]
}

function emptyAgg(ma_khach: string): Agg {
  return { ma_khach, tong_phat_sinh: 0, tong_da_thu: 0, phat_sinh_rows: [], da_thu_rows: [] }
}

// GET ?year=2026&month=8 — bắt buộc truyền, cùng cách lọc theo tháng với
// /api/ve-may-bay/sao-ke-tk: cả issued_date (ve_debt_records) lẫn ngay
// (sao_ke_giao_dich) đều là TEXT "DD/MM/YYYY" (nguyên văn nhập tay/đọc từ
// Google Sheet, không phải cột DATE thật), nên lọc bằng LIKE hậu tố
// "%/MM/YYYY" thay vì so sánh khoảng ngày. Trước đây kéo hết toàn bộ lịch
// sử (limit 5000/20000) — giờ theo tháng nên khối lượng nhỏ hơn nhiều,
// giữ limit lại chỉ để làm mốc chặn an toàn.
//
// Trả kèm phat_sinh_rows/da_thu_rows (chi tiết từng dòng góp vào tổng) để
// UI toggle xem chi tiết theo khách mà không cần gọi API riêng lần 2.
export async function GET(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Thiếu hoặc sai tham số year/month' }, { status: 400 })
  }
  const suffix = `%/${String(month).padStart(2, '0')}/${year}`

  const admin = createAdminClient()

  const [debtRes, bookingsRes, saoKeRes] = await Promise.all([
    admin.from('ve_debt_records').select('ma_khach, gia_ban, ticket_no, pax_name, issued_date, routing').like('issued_date', suffix).limit(5000),
    admin.from('ve_bookings').select('ma_khach, gia_ban, ticket_no, full_name, issued_date, routing').like('issued_date', suffix).limit(5000),
    // ma_2='TC' — chỉ lấy dòng thuộc Toàn Cầu/vé máy bay, CÙNG bộ lọc với
    // /api/ve-may-bay/sao-ke-tk. Thiếu điều kiện này trước đó khiến "Đã
    // thu" cộng luôn mọi khoản thu trong tháng (không riêng gì vé), ra số
    // lớn bất thường so với "Sao kê TK" cùng tháng.
    admin.from('sao_ke_giao_dich').select('ten_du_an, thu, ngay, dien_giai, tai_khoan').eq('ma_2', 'TC').like('ngay', suffix).limit(20000),
  ])

  if (debtRes.error) return NextResponse.json({ error: debtRes.error.message }, { status: 400 })
  if (bookingsRes.error) return NextResponse.json({ error: bookingsRes.error.message }, { status: 400 })
  if (saoKeRes.error) return NextResponse.json({ error: saoKeRes.error.message }, { status: 400 })

  const map = new Map<string, Agg>()
  const seenTicketNo = new Set<string>()

  for (const r of debtRes.data ?? []) {
    const key = normKey(r.ma_khach)
    if (!key) continue
    const entry = map.get(key) ?? emptyAgg((r.ma_khach ?? '').trim())
    entry.tong_phat_sinh += r.gia_ban ?? 0
    entry.phat_sinh_rows.push({ ticket_no: r.ticket_no, pax_name: r.pax_name, issued_date: r.issued_date, routing: r.routing, gia_ban: r.gia_ban })
    if (r.ticket_no?.trim()) seenTicketNo.add(r.ticket_no.trim().toUpperCase())
    map.set(key, entry)
  }

  for (const r of bookingsRes.data ?? []) {
    const key = normKey(r.ma_khach)
    if (!key) continue
    const ticketKey = r.ticket_no?.trim().toUpperCase()
    if (ticketKey && seenTicketNo.has(ticketKey)) continue // đã có ở ve_debt_records, tránh cộng đúp
    const entry = map.get(key) ?? emptyAgg((r.ma_khach ?? '').trim())
    entry.tong_phat_sinh += r.gia_ban ?? 0
    entry.phat_sinh_rows.push({ ticket_no: r.ticket_no, pax_name: r.full_name, issued_date: r.issued_date, routing: r.routing, gia_ban: r.gia_ban })
    if (ticketKey) seenTicketNo.add(ticketKey)
    map.set(key, entry)
  }

  for (const r of saoKeRes.data ?? []) {
    const key = normKey(r.ten_du_an)
    if (!key) continue
    const entry = map.get(key) ?? emptyAgg((r.ten_du_an ?? '').trim())
    entry.tong_da_thu += r.thu ?? 0
    entry.da_thu_rows.push({ ngay: r.ngay, dien_giai: r.dien_giai, thu: r.thu, tai_khoan: r.tai_khoan })
    map.set(key, entry)
  }

  const data = Array.from(map.values())
    .map(e => ({ ...e, cong_no: e.tong_phat_sinh - e.tong_da_thu }))
    .sort((a, b) => b.cong_no - a.cong_no)

  return NextResponse.json({ data })
}
