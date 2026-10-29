import { NextRequest, NextResponse } from 'next/server'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { parseDateVN } from '@/lib/format'
import { adminClient, laLoiThieuBang, loiResponse } from '@/lib/quyetToanServer'

type SaoKeRow = {
  id: string; tai_khoan: string; ngay: string | null; ma: string | null; don_vi: string | null
  dien_giai: string | null; thu: number | null; chi: number | null; ten_du_an: string | null; row_index: number
}

const PAGE = 50

// GET ?loai=thu|chi&q=&page= — dòng sao kê để "Chọn từ sao kê" khi nhập thu khách (thu > 0) hoặc chi NCC (chi > 0).
// Mới nhất trước (ngày lưu dạng text dd/mm/yyyy → sắp xếp ở đây). Kèm cờ da_dung = đã gắn vào 1 khoản thu/chi quyết toán.
export async function GET(req: NextRequest) {
  const { unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const sp = req.nextUrl.searchParams
  const loai = sp.get('loai') === 'chi' ? 'chi' : 'thu'
  // Bỏ ký tự đặc biệt của cú pháp lọc PostgREST (dấu phẩy, ngoặc, %, *)
  const q = (sp.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim()
  const page = Math.max(0, Number(sp.get('page') ?? 0) || 0)
  const admin = adminClient()
  try {
    const rows = await fetchAllRows<SaoKeRow>((from, to) => {
      let qb = admin
        .from('sao_ke_giao_dich')
        .select('id, tai_khoan, ngay, ma, don_vi, dien_giai, thu, chi, ten_du_an, row_index')
        .gt(loai, 0)
      if (q) qb = qb.or(['dien_giai', 'don_vi', 'ma', 'ten_du_an'].map((c) => `${c}.ilike.%${q}%`).join(','))
      return qb.order('id').range(from, to)
    })
    const sorted = rows
      .map((r) => ({ ...r, ngay_iso: parseDateVN(r.ngay) }))
      .sort((a, b) => (b.ngay_iso ?? '').localeCompare(a.ngay_iso ?? '') || b.row_index - a.row_index)
    const trang = sorted.slice(page * PAGE, page * PAGE + PAGE)
    const ids = trang.map((r) => r.id)
    const daDung = new Set<string>()
    if (ids.length) {
      const bang = loai === 'thu' ? 'qt_thu_khach' : 'qt_thanh_toan_ncc'
      const { data, error } = await admin.from(bang).select('sao_ke_id').in('sao_ke_id', ids)
      if (error && !laLoiThieuBang(error)) throw error
      for (const r of (data ?? []) as { sao_ke_id: string }[]) daDung.add(r.sao_ke_id)
    }
    return NextResponse.json({
      rows: trang.map((r) => ({ ...r, da_dung: daDung.has(r.id) })),
      total: sorted.length,
      page,
      page_size: PAGE,
    })
  } catch (e) {
    return loiResponse(e)
  }
}
