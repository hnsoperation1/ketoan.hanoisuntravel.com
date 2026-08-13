import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// GET — danh mục TOÀN BỘ nhân sự thuê ngoài (HDV/MC/...) từng làm việc,
// không giới hạn theo đoàn — phục vụ tab "Tổng hợp" ở trang /nhan-su.
// Số đoàn tham gia (có thể lọc theo khoảng ngày) tính riêng ở client từ
// GET /api/nhansu/ho-so-list, không đếm sẵn ở đây nữa.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('nhansu')
    .select('*, loai_nhan_su:loai_nhan_su_id(*)')
    .order('ho_ten')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ nhansu: data })
}
