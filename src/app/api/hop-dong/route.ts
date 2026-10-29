import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// Tab "Hợp đồng" ở Danh sách đoàn (2026-10-29): mọi hợp đồng nhân sự thuê ngoài đã xuất, gộp tất cả đoàn
// (bỏ đoàn đã xoá). Mỗi hồ sơ 1 dòng, file = bản xuất mới nhất (ho_so_hop_dong_files), mới nhất lên đầu.
type Row = {
  id: string
  so_hop_dong: string | null
  ngay_ky: string | null
  ngay_dich_vu: string | null
  ngay_ket_thuc: string | null
  trang_thai: string
  created_at: string
  nhansu: { ho_ten: string; loai_nhan_su: { ten: string } | null } | null
  doan: { id: string; ten_doan: string; loai_doan: string | null; opportunity_id: string | null; deleted_at: string | null } | null
  files: { id: string; file_name: string | null; created_at: string }[] | null
}

export async function GET() {
  const { unauthorized } = await requireScreen('kt-doan')
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  try {
    const rows = await fetchAllRows<Row>((from, to) =>
      supabase
        .from('ho_so')
        .select('id, so_hop_dong, ngay_ky, ngay_dich_vu, ngay_ket_thuc, trang_thai, created_at, nhansu:nhansu_id(ho_ten, loai_nhan_su:loai_nhan_su_id(ten)), doan:doan_id(id, ten_doan, loai_doan, opportunity_id, deleted_at), files:ho_so_hop_dong_files(id, file_name, created_at)')
        .not('file_hop_dong_url', 'is', null)
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
    )
    const hopDong = rows
      .filter((r) => r.doan && !r.doan.deleted_at)
      .map((r) => {
        const files = [...(r.files ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
        const latest = files[0] ?? null
        return {
          ho_so_id: r.id,
          ho_ten: r.nhansu?.ho_ten ?? '',
          loai_nhan_su: r.nhansu?.loai_nhan_su?.ten ?? null,
          so_hop_dong: r.so_hop_dong,
          ngay_ky: r.ngay_ky,
          ngay_dich_vu: r.ngay_dich_vu,
          ngay_ket_thuc: r.ngay_ket_thuc,
          trang_thai: r.trang_thai,
          doan: { id: r.doan!.id, ten_doan: r.doan!.ten_doan, loai_doan: r.doan!.loai_doan, opportunity_id: r.doan!.opportunity_id },
          file_id: latest?.id ?? null,
          file_name: latest?.file_name ?? null,
          so_ban: files.length,
          // Hồ sơ xuất trước khi có bảng lịch sử file thì không có dòng file → lấy ngày ký / ngày tạo hồ sơ
          ngay_xuat: latest?.created_at ?? r.ngay_ky ?? r.created_at,
        }
      })
      .sort((a, b) => b.ngay_xuat.localeCompare(a.ngay_xuat))
    return NextResponse.json({ hop_dong: hopDong })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi tải danh sách hợp đồng' }, { status: 500 })
  }
}
