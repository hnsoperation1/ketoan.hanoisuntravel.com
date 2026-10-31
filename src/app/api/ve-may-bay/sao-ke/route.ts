import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// GET — toàn bộ dòng sao kê đã đồng bộ. Sổ quỹ/ngân hàng tổng công ty, nhạy
// cảm hơn dữ liệu vé máy bay thông thường (xem migration_sao_ke_giao_dich.sql,
// repo hns-crm) — từ 2026-10-11 chỉ người được Super Admin tick màn
// kt-sao-ke (hoặc Super Admin), boss KHÔNG còn tự động được; chưa chạy
// migration screen_access thì theo luật cũ = Super Admin hoặc Boss. Lọc/tìm kiếm
// xử lý phía client vì tổng dữ liệu (~10k dòng) vẫn nhẹ để tải 1 lần —
// nhưng PHẢI lấy hết bằng .range() phân trang, .limit(N) đơn lẻ trước đây
// từng âm thầm cắt mất dòng mới nhất khi bảng vượt trần mặc định của
// PostgREST (xem @/lib/supabase/fetch-all).
//
// Dòng đã xoá khỏi sheet (xoa_luc) không trả về, TRỪ dòng còn cảnh báo (đang gắn quyết toán) để kế toán xử lý.
// Kèm danh mục tài khoản (sao_ke_tai_khoan) cho thanh lọc theo tài khoản và hệ thống tài khoản kế toán
// (ke_toan_tai_khoan) để hiện tên cho cột Mã / bảng tổng hợp theo tài khoản đối ứng.
export async function GET() {
  const { unauthorized } = await requireScreen('kt-sao-ke')
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  try {
    const [data, tk, tkkt] = await Promise.all([
      fetchAllRows((from, to) =>
        admin
          .from('sao_ke_giao_dich')
          .select('*')
          .or('xoa_luc.is.null,canh_bao.not.is.null')
          .order('tai_khoan', { ascending: true })
          .order('row_index', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      admin.from('sao_ke_tai_khoan').select('ma, ten, so_tai_khoan, ngan_hang, chu_so_huu, chu_tai_khoan, loai_tien').order('thu_tu'),
      // Hệ thống tài khoản kế toán (tên cho cột Mã) — chưa chạy migration 20261146 thì bỏ qua, chỉ thiếu tên
      admin.from('ke_toan_tai_khoan').select('ma, ten').order('thu_tu'),
    ])
    if (tk.error) throw new Error(tk.error.message)
    return NextResponse.json({ data, tai_khoan: tk.data ?? [], tai_khoan_ke_toan: tkkt.error ? [] : tkkt.data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu' }, { status: 400 })
  }
}
