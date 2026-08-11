import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// GET ?year=2026&month=8 — bản rút gọn của /api/ve-may-bay/sao-ke, mở cho cả
// ke_toan_allowlist/boss (không chỉ super_admin) nhưng CHỈ trả về dòng có
// ma_2 = 'TC' (cột O trên Google Sheet gốc — đánh dấu giao dịch thuộc Toàn
// Cầu/vé máy bay). Lọc ngay ở server, không phải chỉ ẩn trên UI, vì đây là
// cách những vai trò này được phép thấy MỘT PHẦN sổ sao kê chứ không phải
// toàn bộ.
//
// Bắt buộc truyền year/month — client tự cache theo tháng đã gọi (xem
// page.tsx), route này chỉ trả đúng 1 tháng mỗi lần gọi để tránh kéo hết
// toàn bộ lịch sử. `ngay` lưu dạng TEXT "DD/MM/YYYY" (nguyên văn đọc từ
// Google Sheet, không phải cột DATE thật) nên lọc bằng LIKE hậu tố
// "%/MM/YYYY" thay vì so sánh khoảng ngày.
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
  const { data, error } = await admin
    .from('sao_ke_giao_dich')
    .select('*')
    .eq('ma_2', 'TC')
    .like('ngay', suffix)
    .order('tai_khoan', { ascending: true })
    .order('row_index', { ascending: true })
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
