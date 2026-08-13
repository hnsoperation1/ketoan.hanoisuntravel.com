import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

function normKey(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t === '' ? null : t.toUpperCase()
}

type RevenueRow = { ma_khach: string | null; gia_ban: number | null; gia_mua: number | null; ticket_no: string | null }
type RevenueAgg = { doanh_thu: number; loi_nhuan: number }

// Cộng dồn doanh thu (gia_ban) + lợi nhuận (gia_ban - gia_mua) theo mã khách,
// gộp CẢ 2 nguồn "vé đã xuất" (ve_debt_records nhập tay/Excel + ve_bookings
// bot Telegram tự trích) dedup theo ticket_no — ĐÚNG cách
// /api/ve-may-bay/cong-no-khach-hang đang làm, chỉ khác là không giới hạn
// theo tháng (tổng mọi thời điểm, theo yêu cầu 2026-08-13).
async function loadRevenueByMaKhach(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, RevenueAgg>> {
  const [debtRes, bookingsRes] = await Promise.all([
    admin.from('ve_debt_records').select('ma_khach, gia_ban, gia_mua, ticket_no').limit(50000),
    admin.from('ve_bookings').select('ma_khach, gia_ban, gia_mua, ticket_no').limit(50000),
  ])

  const map = new Map<string, RevenueAgg>()
  const seenTicketNo = new Set<string>()

  function addRow(r: RevenueRow) {
    const key = normKey(r.ma_khach)
    if (!key) return
    const ticketKey = r.ticket_no?.trim().toUpperCase()
    if (ticketKey) {
      if (seenTicketNo.has(ticketKey)) return
      seenTicketNo.add(ticketKey)
    }
    const entry = map.get(key) ?? { doanh_thu: 0, loi_nhuan: 0 }
    const giaBan = r.gia_ban ?? 0
    const giaMua = r.gia_mua ?? 0
    entry.doanh_thu += giaBan
    entry.loi_nhuan += giaBan - giaMua
    map.set(key, entry)
  }

  for (const r of (debtRes.data ?? []) as RevenueRow[]) addRow(r)
  for (const r of (bookingsRes.data ?? []) as RevenueRow[]) addRow(r)
  return map
}

// GET — danh mục khách hàng VMB (kế toán vé máy bay), import từ file gốc
// "Link nhập _ Phòng vé HNS" — dùng làm nguồn tra cứu mã khách chuẩn. Kèm
// theo liên hệ CRM (contact_id) đã gán + doanh thu/lợi nhuận cộng dồn, phục
// vụ chế độ hiển thị "Đầy đủ" ở trang Danh mục khách hàng.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin.from('vmb_khach_hang').select('*').order('nhom').order('ma_khach')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const rows = data ?? []

  const contactIds = Array.from(new Set(rows.map(r => r.contact_id).filter((id): id is string => !!id)))
  const [contactsRes, revenueByMaKhach] = await Promise.all([
    contactIds.length > 0
      ? admin.from('contacts').select('id, name, phone, email, company, tax_code, source, note').in('id', contactIds)
      : Promise.resolve({ data: [] as unknown[] }),
    loadRevenueByMaKhach(admin),
  ])
  const contactById = new Map((contactsRes.data ?? []).map((c) => [(c as { id: string }).id, c]))

  const enriched = rows.map(r => ({
    ...r,
    contact: r.contact_id ? contactById.get(r.contact_id) ?? null : null,
    ...(revenueByMaKhach.get(normKey(r.ma_khach) ?? '') ?? { doanh_thu: 0, loi_nhuan: 0 }),
  }))

  return NextResponse.json({ data: enriched })
}

// POST — { id?, nhom, ma_khach, ten_khach, doi_tuong_quy_tac, hinh_thuc_cong_no, phi_xuat_ve, active, contact_id?, ghi_chu? }
// có id thì update, không thì tạo mới. contact_id = liên hệ CRM đã gán (null để bỏ gán).
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, nhom, ma_khach, ten_khach, doi_tuong_quy_tac, hinh_thuc_cong_no, phi_xuat_ve, active, contact_id, ghi_chu } = await req.json().catch(() => ({}))
  if (!nhom || !ma_khach || !String(ma_khach).trim()) {
    return NextResponse.json({ error: 'Thiếu nhóm hoặc mã khách' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payload = {
    nhom: String(nhom).trim(),
    ma_khach: String(ma_khach).trim(),
    ten_khach: ten_khach ? String(ten_khach).trim() : null,
    doi_tuong_quy_tac: doi_tuong_quy_tac ? String(doi_tuong_quy_tac).trim() : null,
    hinh_thuc_cong_no: hinh_thuc_cong_no ? String(hinh_thuc_cong_no).trim() : null,
    phi_xuat_ve: phi_xuat_ve ? String(phi_xuat_ve).trim() : null,
    active: active ?? true,
    contact_id: contact_id ? String(contact_id) : null,
    ghi_chu: ghi_chu ? String(ghi_chu).trim() : null,
  }

  const query = id
    ? admin.from('vmb_khach_hang').update(payload).eq('id', id)
    : admin.from('vmb_khach_hang').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
