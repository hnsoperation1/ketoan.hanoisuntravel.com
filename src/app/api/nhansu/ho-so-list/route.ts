import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// GET — TOÀN BỘ dòng ho_so (mọi đoàn, mọi nhân sự) kèm join nhansu + doan —
// dữ liệu gốc dùng chung cho 3 tab ở trang /nhan-su: "Tổng hợp" (gom theo
// nhân sự, lọc theo khoảng ngày), "Cần thanh toán"/"Đã thanh toán" (lọc
// theo trang_thai, hiện từng dòng tham gia đoàn). Xử lý gom nhóm/lọc ở
// client vì khối lượng dữ liệu (vài trăm dòng ho_so) còn nhẹ, đỡ phải làm
// nhiều route riêng cho từng cách lọc.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ho_so')
    .select(
      'id, doan_id, nhansu_id, ngay_dich_vu, so_ngay_cong_tac, don_gia_ngay, so_tien_chi_tra, chi_tra, trang_thai, tinh_trang_thanh_toan,' +
      'nhansu:nhansu_id(id, ho_ten, loai_nhan_su_id, loai_nhan_su:loai_nhan_su_id(*)),' +
      'doan:doan_id(id, ten_doan, ngay_di, ngay_ve)',
    )
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ho_so: data })
}
