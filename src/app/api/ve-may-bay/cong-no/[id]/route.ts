import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser, requireSuperAdminUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

const TEXT_FIELDS = ['tkt_tag', 'sale_chinh', 'ghi_chu'] as const
const NUMBER_FIELDS = ['gia_mua', 'cktm', 'gia_ban', 'com_khach'] as const

// PATCH — sửa tay 1 dòng công nợ: gắn TKT/mã khách/sale chính sau khi đối
// chiếu, hoặc sửa lại số gốc (giá mua/CKTM/giá bán/COM khách) nếu nhập
// nhầm lúc import.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const payload: Record<string, string | number | null> = {}
  for (const f of TEXT_FIELDS) {
    if (f in body) payload[f] = body[f] ? String(body[f]).trim() : null
  }
  for (const f of NUMBER_FIELDS) {
    if (f in body) payload[f] = typeof body[f] === 'number' ? body[f] : (body[f] ? Number(body[f]) : null)
  }
  // "ma_khach" gán tay (qua MaKhachCell hoặc slide-over) khác các TEXT_FIELDS
  // khác ở chỗ luôn kéo theo đổi match_status — phải phân biệt rõ với
  // 'matched' (hệ thống tự khớp/tự xác minh), xem
  // migration_ve_debt_records_match_ma_khach.sql. Rỗng = bỏ chọn → quay lại
  // 'unmatched' thay vì giữ trạng thái cũ.
  if ('ma_khach' in body) {
    const val = body.ma_khach ? String(body.ma_khach).trim() : null
    payload.ma_khach = val
    payload.match_status = val ? 'manual' : 'unmatched'
    payload.matched_booking_id = val && typeof body.matched_booking_id === 'string' ? body.matched_booking_id : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('ve_debt_records').update(payload).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// DELETE — xoá 1 dòng nhập nhầm. CHỈ super admin (2026-08-26): xoá dòng
// công nợ là mất dữ liệu tài chính, không khôi phục được. Ẩn nút ở giao
// diện thôi thì chưa đủ — ai biết đường vẫn gọi thẳng API xoá được, nên
// phải chặn ngay tại đây. PATCH bên trên GIỮ NGUYÊN requireUser() vì kế
// toán vẫn cần sửa mã khách/giá/ghi chú bình thường.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const admin = createAdminClient()
  const { error } = await admin.from('ve_debt_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
