import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// GET — danh mục khách hàng VMB (kế toán vé máy bay), import từ file gốc
// "Link nhập _ Phòng vé HNS" — dùng làm nguồn tra cứu mã khách chuẩn.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin.from('vmb_khach_hang').select('*').order('nhom').order('ma_khach')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — { id?, nhom, ma_khach, ten_khach, doi_tuong_quy_tac, hinh_thuc_cong_no, phi_xuat_ve, active }
// có id thì update, không thì tạo mới.
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, nhom, ma_khach, ten_khach, doi_tuong_quy_tac, hinh_thuc_cong_no, phi_xuat_ve, active } = await req.json().catch(() => ({}))
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
  }

  const query = id
    ? admin.from('vmb_khach_hang').update(payload).eq('id', id)
    : admin.from('vmb_khach_hang').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
