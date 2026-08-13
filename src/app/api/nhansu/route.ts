import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// GET — danh mục TOÀN BỘ nhân sự thuê ngoài (HDV/MC/...) từng làm việc,
// không giới hạn theo đoàn — phục vụ trang /nhan-su (danh sách tra cứu
// nhanh, khác hẳn tab "Nhân sự" trong 1 đoàn cụ thể). Kèm số đoàn đã tham
// gia (đếm qua bảng ho_so) để biết ai đang hoạt động thường xuyên.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('nhansu')
    .select('*, loai_nhan_su:loai_nhan_su_id(*), ho_so(count)')
    .order('ho_ten')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ nhansu: data })
}
