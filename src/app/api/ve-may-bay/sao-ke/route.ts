import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// GET — toàn bộ dòng sao kê đã đồng bộ. Sổ quỹ/ngân hàng tổng công ty, nhạy
// cảm hơn dữ liệu vé máy bay thông thường (xem migration_sao_ke_giao_dich.sql,
// repo hns-crm) — từ 2026-10-11 chỉ người được Super Admin tick màn
// kt-sao-ke (hoặc Super Admin), boss KHÔNG còn tự động được; chưa chạy
// migration screen_access thì theo luật cũ = Super Admin hoặc Boss. Lọc/tìm kiếm
// xử lý phía client vì tổng dữ liệu (~4.7k dòng) vẫn nhẹ để tải 1 lần —
// nhưng PHẢI lấy hết bằng .range() phân trang, .limit(N) đơn lẻ trước đây
// từng âm thầm cắt mất dòng mới nhất khi bảng vượt trần mặc định của
// PostgREST (xem @/lib/supabase/fetch-all).
export async function GET() {
  const { unauthorized } = await requireScreen('kt-sao-ke')
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  try {
    const data = await fetchAllRows((from, to) =>
      admin
        .from('sao_ke_giao_dich')
        .select('*')
        .order('tai_khoan', { ascending: true })
        .order('row_index', { ascending: true })
        .range(from, to)
    )
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu' }, { status: 400 })
  }
}
