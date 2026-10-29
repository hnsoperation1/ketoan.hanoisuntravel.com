import { NextResponse } from 'next/server'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { tinhTrangChay } from '@/lib/quyetToan'
import {
  QT_MIGRATION_MSG,
  apSoChot,
  tinhTuDuLieu,
  type QtChot,
  type QtListRow,
  type QtQuyetToanFull,
} from '@/lib/quyetToanBundle'
import { QtError, adminClient, chk, chunk, docCauHinh, loiResponse, tenKhachTheoDon, type Admin } from '@/lib/quyetToanServer'

type DoanRow = { id: string | null; ten_doan: string; hanh_trinh: string | null; ngay_di: string | null; ngay_ve: string | null; opportunity_id: string }
type OppRow = {
  id: string; title: string | null; tour_date: string | null; tour_end_date: string | null; department_id: string | null
  assigned_to: string | null; operator_id: string | null; sale_chinh_id: string | null; ticketing_ids: string[] | null
  contact_id: string | null; organization_id: string | null
}

/** Đọc mọi dòng của bảng theo danh sách id (chia lô 150 id, mỗi lô phân trang 1000 dòng). */
async function theoIds<T>(admin: Admin, table: string, cols: string, col: string, ids: string[], orderCol = 'id'): Promise<T[]> {
  const out: T[] = []
  for (const part of chunk(ids, 150)) {
    const rows = await fetchAllRows<T>((from, to) =>
      admin.from(table).select(cols).in(col, part).order(orderCol).range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
    ).catch((e: { message?: string }) => {
      throw new QtError(/Could not find the table|does not exist|schema cache/i.test(e?.message ?? '') ? QT_MIGRATION_MSG : e?.message ?? 'Lỗi tải dữ liệu', 409)
    })
    out.push(...rows)
  }
  return out
}

function nhom<T extends { opportunity_id: string }>(rows: T[]) {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const a = m.get(r.opportunity_id)
    if (a) a.push(r)
    else m.set(r.opportunity_id, [r])
  }
  return m
}

// GET — Bảng tổng hợp đoàn (LIST TỔNG): mọi đoàn chưa xoá đã nối đơn CRM, kèm số quyết toán tính theo lô.
export async function GET() {
  const { unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const admin = adminClient()
  try {
    // Kiểm tra migration trước
    chk(await admin.from('qt_quyet_toan').select('opportunity_id').limit(1))

    const doans = await fetchAllRows<DoanRow>((from, to) =>
      admin.from('doan').select('id, ten_doan, hanh_trinh, ngay_di, ngay_ve, opportunity_id')
        .is('deleted_at', null).not('opportunity_id', 'is', null).order('ngay_di', { ascending: false }).order('id').range(from, to),
    )
    // Đơn đã có phiếu quyết toán nhưng chưa có đoàn (vd chưa nhập ngày tour) vẫn phải hiện để kế toán mở được
    const coDoan = new Set(doans.map((d) => d.opportunity_id))
    const qtIds = await fetchAllRows<{ opportunity_id: string }>((from, to) =>
      admin.from('qt_quyet_toan').select('opportunity_id').order('opportunity_id').range(from, to),
    )
    const thieuDoan = qtIds.map((q) => q.opportunity_id).filter((id) => !coDoan.has(id))
    if (thieuDoan.length) {
      const oppThieu = await theoIds<{ id: string; title: string | null; tour_date: string | null; tour_end_date: string | null; deleted_at: string | null }>(
        admin, 'opportunities', 'id, title, tour_date, tour_end_date, deleted_at', 'id', thieuDoan)
      for (const o of oppThieu) {
        if (o.deleted_at) continue
        doans.push({ id: null, ten_doan: o.title ?? '', hanh_trinh: null, ngay_di: o.tour_date, ngay_ve: o.tour_end_date, opportunity_id: o.id })
      }
    }
    if (!doans.length) return NextResponse.json({ rows: [] })
    const oppIds = [...new Set(doans.map((d) => d.opportunity_id))]
    const doanIds = doans.map((d) => d.id).filter((x): x is string => !!x)

    const [opps, qts, duChi, chiPhi, khach, hoaDon, thanhToan, thuKhach, tamUng, chots, hoSo, cauHinh, phanLoai, saleChinh, depts] = await Promise.all([
      theoIds<OppRow>(admin, 'opportunities', 'id, title, tour_date, tour_end_date, department_id, assigned_to, operator_id, sale_chinh_id, ticketing_ids, contact_id, organization_id', 'id', oppIds),
      theoIds<QtQuyetToanFull>(admin, 'qt_quyet_toan', '*', 'opportunity_id', oppIds, 'opportunity_id'),
      theoIds<{ opportunity_id: string; lan: number; tong_net: number; tong_ban: number; tong_vat_net: number }>(admin, 'qt_du_chi_chot', 'id, opportunity_id, lan, tong_net, tong_ban, tong_vat_net', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_chi_phi', 'id, opportunity_id, thanh_tien, tien_vat, nguoi_chi, nha_cung_cap_id, ncc_ten, service_id', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_khach_dieu_chinh', 'id, opportunity_id, loai, thanh_tien, vat_rate, trang_thai', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_hoa_don_ncc', 'id, opportunity_id, nha_cung_cap_id, ncc_ten, tien_vat, tong', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_thanh_toan_ncc', 'id, opportunity_id, nha_cung_cap_id, ncc_ten, so_tien', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_thu_khach', 'id, opportunity_id, so_tien', 'opportunity_id', oppIds),
      theoIds(admin, 'qt_tam_ung', 'id, opportunity_id, trang_thai, so_tien_chi', 'opportunity_id', oppIds),
      theoIds<QtChot>(admin, 'qt_chot', '*', 'opportunity_id', oppIds, 'opportunity_id'),
      theoIds<{ doan_id: string; thue_nop: number | null }>(admin, 'ho_so', 'id, doan_id, thue_nop', 'doan_id', doanIds),
      docCauHinh(admin),
      admin.from('danh_muc').select('id, ten').eq('loai', 'phan_loai_doan').then((r) => (r.data ?? []) as { id: string; ten: string }[]),
      fetchAllRows<{ id: string; name: string }>((f, t) => admin.from('sale_chinh').select('id, name').order('id').range(f, t)).catch(() => []),
      admin.from('departments').select('id, name').then((r) => (r.data ?? []) as { id: string; name: string }[]),
    ])

    const oppMap = new Map(opps.map((o) => [o.id, o]))
    const qtMap = new Map(qts.map((q) => [q.opportunity_id, q]))
    const chotMap = new Map(chots.map((c) => [c.opportunity_id, c]))
    const duChiMoi = new Map<string, (typeof duChi)[number]>()
    for (const d of duChi) {
      const cur = duChiMoi.get(d.opportunity_id)
      if (!cur || d.lan > cur.lan) duChiMoi.set(d.opportunity_id, d)
    }
    const [gCp, gKh, gHd, gTt, gThu, gTu] = [chiPhi, khach, hoaDon, thanhToan, thuKhach, tamUng].map((a) => nhom(a as { opportunity_id: string }[]))
    const tncnDoan = new Map<string, number>()
    for (const h of hoSo) tncnDoan.set(h.doan_id, (tncnDoan.get(h.doan_id) ?? 0) + (Number(h.thue_nop) || 0))
    const plMap = new Map(phanLoai.map((p) => [p.id, p.ten]))
    const scMap = new Map(saleChinh.map((s) => [s.id, s.name]))
    const depMap = new Map(depts.map((d) => [d.id, d.name]))

    const userIds = new Set<string>()
    for (const o of opps) {
      if (o.assigned_to) userIds.add(o.assigned_to)
      if (o.operator_id) userIds.add(o.operator_id)
      for (const t of o.ticketing_ids ?? []) userIds.add(t)
    }
    for (const q of qts) if (q.ke_toan_id) userIds.add(q.ke_toan_id)
    const users = await theoIds<{ id: string; full_name: string | null }>(admin, 'users', 'id, full_name', 'id', [...userIds])
    const uMap = new Map(users.map((u) => [u.id, u.full_name ?? '']))
    const khachTen = await tenKhachTheoDon(admin, opps)
    const homNay = new Date(Date.now() + 7 * 3600_000)

    const rows: QtListRow[] = doans.map((d) => {
      const o = oppMap.get(d.opportunity_id)
      const qt = qtMap.get(d.opportunity_id) ?? null
      const ds = (m: Map<string, { opportunity_id: string }[]>) => (m.get(d.opportunity_id) ?? []) as never[]
      const kq0 = tinhTuDuLieu({
        qt,
        duChiMoiNhat: (duChiMoi.get(d.opportunity_id) ?? null) as never,
        chiPhi: ds(gCp), khach: ds(gKh), hoaDon: ds(gHd), thanhToan: ds(gTt), thuKhach: ds(gThu), tamUng: ds(gTu),
        tncn: d.id ? tncnDoan.get(d.id) ?? 0 : 0,
        cauHinh,
        vaiTro: { saleChinhId: o?.sale_chinh_id ?? null, salePhuId: o?.assigned_to ?? null, dieuHanhId: o?.operator_id ?? null, keToanId: qt?.ke_toan_id ?? null },
      })
      const kq = apSoChot(kq0, chotMap.get(d.opportunity_id) ?? null, !!qt?.da_khoa)
      const ngayDi = d.ngay_di ?? o?.tour_date ?? null
      const ngayVe = d.ngay_ve ?? o?.tour_end_date ?? null
      return {
        doan_id: d.id,
        opportunity_id: d.opportunity_id,
        ngay_di: ngayDi,
        ngay_ve: ngayVe,
        thang: ngayDi ? ngayDi.slice(0, 7) : null,
        tinh_trang: tinhTrangChay(ngayDi, ngayVe, homNay),
        phan_loai_id: qt?.phan_loai_id ?? null,
        phan_loai: qt?.phan_loai_id ? plMap.get(qt.phan_loai_id) ?? null : null,
        khach: khachTen.get(d.opportunity_id) ?? null,
        ten_doan: d.ten_doan,
        lich_trinh: d.hanh_trinh,
        so_hop_dong: qt?.so_hop_dong ?? null,
        sale_chinh_id: o?.sale_chinh_id ?? null,
        sale_chinh: o?.sale_chinh_id ? scMap.get(o.sale_chinh_id) ?? null : null,
        sale_phu_id: o?.assigned_to ?? null,
        sale_phu: o?.assigned_to ? uMap.get(o.assigned_to) ?? null : null,
        dieu_hanh_id: o?.operator_id ?? null,
        dieu_hanh: o?.operator_id ? uMap.get(o.operator_id) ?? null : null,
        ke_toan_id: qt?.ke_toan_id ?? null,
        ke_toan: qt?.ke_toan_id ? uMap.get(qt.ke_toan_id) ?? null : null,
        tkt: (o?.ticketing_ids ?? []).map((t) => uMap.get(t)).filter(Boolean).join(', ') || null,
        doanh_thu: kq.doanhThu,
        tong_quyet_toan: kq.doanhThu + kq.vatRa,
        da_thu: kq.daThu,
        cong_no_khach: kq.doanhThu + kq.vatRa - kq.daThu,
        tong_chi: kq.tongChi,
        loi_nhuan: kq.loiNhuan,
        cskh: kq.cskh,
        ln_tinh_hh: kq.lnTinhHh,
        hh_sale_chinh: kq.hhSaleChinh,
        hh_sale_phu: kq.hhSalePhu,
        hh_dieu_hanh: kq.hhDieuHanh,
        hh_ke_toan: kq.hhKeToan,
        ln_con_lai: kq.lnConLai,
        gtgt: kq.gtgt,
        cong_no_ncc: kq.tongCongNoNcc,
        tang_giam_ln: kq.tangGiamLn,
        ly_do_tang_giam_ln: qt?.ly_do_tang_giam_ln ?? null,
        bo_phan: o?.department_id ? depMap.get(o.department_id) ?? null : null,
        chi_phi_trang_thai: qt?.chi_phi_trang_thai ?? 'dang_lam',
        khach_trang_thai: qt?.khach_trang_thai ?? 'dang_lam',
        da_khoa: !!qt?.da_khoa,
      }
    })
    rows.sort((a, b) => (a.ngay_di ?? '').localeCompare(b.ngay_di ?? '') || a.ten_doan.localeCompare(b.ten_doan, 'vi'))
    return NextResponse.json({ rows })
  } catch (e) {
    if (e instanceof QtError && e.message === QT_MIGRATION_MSG) return NextResponse.json({ migration_missing: true, message: QT_MIGRATION_MSG })
    return loiResponse(e)
  }
}
