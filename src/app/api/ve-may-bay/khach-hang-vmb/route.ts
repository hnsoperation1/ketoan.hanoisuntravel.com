import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// Trang này đối chiếu TOÀN BỘ lịch sử (không lọc theo tháng, khác
// /api/ve-may-bay/cong-no-khach-hang) — .limit(20000)/.limit(5000) cũ
// KHÔNG có .order() đi kèm nên Postgres không đảm bảo giữ lại đúng
// 20000/5000 dòng nào khi bảng vượt ngưỡng đó; từng khiến giao dịch có
// thật (thấy được ở /sao-ke-tk lọc theo tháng) biến mất hoàn toàn khỏi
// trang này dù search đúng chuỗi. Phân trang lấy hết thay vì áp trần cứng
// (xem @/lib/supabase/fetch-all).

// Đối chiếu danh mục mã khách giữa 2 nguồn nhập tay KHÔNG có FK chung —
// ve_debt_records.ma_khach ("Đầu vào công nợ") và sao_ke_giao_dich.ten_du_an
// ("Đầu vào sao kê", cột "Dự án"). Mục đích: lộ ra mã nào đang lệch chính
// tả/thiếu 1 bên để dọn dữ liệu, KHÔNG phải màn tính công nợ (xem
// /api/ve-may-bay/cong-no-khach-hang cho việc đó — cùng cách nối text
// trim+uppercase, tách route riêng vì hình dạng dữ liệu trả về khác hẳn).
function normKey(s: string | null): string | null {
  const t = (s ?? '').trim()
  return t === '' ? null : t.toUpperCase()
}

type Entry = {
  ma_khach: string
  so_dong_cong_no: number
  tong_phat_sinh: number
  so_dong_sao_ke: number
  tong_da_thu: number
}

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()

  let debtData: { ma_khach: string | null; gia_ban: number | null }[]
  let saoKeData: { ten_du_an: string | null; thu: number | null }[]
  try {
    // .order('id') bắt buộc đi kèm .range() để phân trang ổn định — thiếu
    // nó Postgres không đảm bảo thứ tự giữa các lần gọi .range() kế tiếp,
    // có thể bỏ sót hoặc lặp dòng khi có ghi đồng thời.
    [debtData, saoKeData] = await Promise.all([
      fetchAllRows((from, to) => admin.from('ve_debt_records').select('ma_khach, gia_ban').order('id').range(from, to)),
      fetchAllRows((from, to) => admin.from('sao_ke_giao_dich').select('ten_du_an, thu').order('id').range(from, to)),
    ])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu' }, { status: 400 })
  }

  const map = new Map<string, Entry>()

  for (const r of debtData) {
    const key = normKey(r.ma_khach)
    if (!key) continue
    const e = map.get(key) ?? { ma_khach: (r.ma_khach ?? '').trim(), so_dong_cong_no: 0, tong_phat_sinh: 0, so_dong_sao_ke: 0, tong_da_thu: 0 }
    e.so_dong_cong_no += 1
    e.tong_phat_sinh += r.gia_ban ?? 0
    map.set(key, e)
  }

  for (const r of saoKeData) {
    const key = normKey(r.ten_du_an)
    if (!key) continue
    const e = map.get(key) ?? { ma_khach: (r.ten_du_an ?? '').trim(), so_dong_cong_no: 0, tong_phat_sinh: 0, so_dong_sao_ke: 0, tong_da_thu: 0 }
    e.so_dong_sao_ke += 1
    e.tong_da_thu += r.thu ?? 0
    map.set(key, e)
  }

  const data = Array.from(map.values())
    .map(e => ({
      ...e,
      trang_thai: e.so_dong_cong_no > 0 && e.so_dong_sao_ke > 0
        ? 'khop'
        : e.so_dong_cong_no > 0
          ? 'chi_cong_no'
          : 'chi_sao_ke',
    }))
    .sort((a, b) => a.ma_khach.localeCompare(b.ma_khach, 'vi'))

  const tong_khop = data.filter(d => d.trang_thai === 'khop').length
  const tong_chi_cong_no = data.filter(d => d.trang_thai === 'chi_cong_no').length
  const tong_chi_sao_ke = data.filter(d => d.trang_thai === 'chi_sao_ke').length

  return NextResponse.json({ data, tong_khop, tong_chi_cong_no, tong_chi_sao_ke })
}
