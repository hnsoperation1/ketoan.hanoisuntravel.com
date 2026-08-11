import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdminUser } from '@/lib/auth'

// GET — toàn bộ dòng sao kê đã đồng bộ. Tạm thời chỉ super_admin xem được
// (khác các route /ve-may-bay/* khác vốn mở cho cả ke_toan_allowlist/boss)
// — xem chú thích quyền trong migration_sao_ke_giao_dich.sql (repo
// hns-crm). Lọc/tìm kiếm xử lý phía client vì tổng dữ liệu (~4.7k dòng)
// vẫn nhẹ để tải 1 lần.
export async function GET() {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sao_ke_giao_dich')
    .select('*')
    .order('tai_khoan', { ascending: true })
    .order('row_index', { ascending: true })
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
