import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser, requireSuperAdminUser } from '@/lib/auth'

// GET — danh sách TKT (tài khoản xuất vé). Mở cho cả nhóm ke_toan_allowlist
// (không chỉ super_admin) — dùng làm gợi ý autocomplete ở trang "Đầu vào
// công nợ". Sửa/tạo TKT (POST) vẫn chỉ super_admin như cũ.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin.from('ve_tkt').select('*').order('tkt_code')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — { id?, tkt_code, ten_nhan_vien, active } — có id thì update, không thì tạo mới
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const { id, tkt_code, ten_nhan_vien, active } = await req.json().catch(() => ({}))
  if (!tkt_code || !String(tkt_code).trim()) {
    return NextResponse.json({ error: 'Thiếu mã TKT' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payload = {
    tkt_code: String(tkt_code).trim(),
    ten_nhan_vien: ten_nhan_vien ? String(ten_nhan_vien).trim() : null,
    active: active ?? true,
  }

  const query = id
    ? admin.from('ve_tkt').update(payload).eq('id', id)
    : admin.from('ve_tkt').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
