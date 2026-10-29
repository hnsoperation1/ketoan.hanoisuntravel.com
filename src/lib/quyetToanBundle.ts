// Kiểu dữ liệu "bộ hồ sơ quyết toán" của 1 đơn mà API ketoan trả về cho tab Quyết toán, và hàm tính
// từ bộ đó. File thuần (không import client/server) — dùng chung cho route handler (khoá sổ, LIST TỔNG,
// cron) và giao diện, để 2 phía luôn tính cùng 1 cách bằng tinhQuyetToan (src/lib/quyetToan.ts).

import {
  HH_TY_LE_MAC_DINH,
  tinhQuyetToan,
  type HhKhiLnAm,
  type HhTyLe,
  type KetQuaQuyetToan,
  type QtChiPhi,
  type QtDuChiChot,
  type QtHoaDonNcc,
  type QtKhachDieuChinh,
  type QtLichThu,
  type QtQuyetToan,
  type QtTamUng,
  type QtThanhToanNcc,
  type QtThuKhach,
} from '@/lib/quyetToan'

export const QT_MIGRATION_MSG = 'Chưa chạy migration 20261138_quyet_toan.sql — liên hệ Super Admin để chạy trên Supabase.'

export type QtCauHinh = { hh_ty_le: HhTyLe; hh_khi_ln_am: HhKhiLnAm; nguoi_khoa_so: string[] }
export const QT_CAU_HINH_MAC_DINH: QtCauHinh = { hh_ty_le: HH_TY_LE_MAC_DINH, hh_khi_ln_am: 'giu_am', nguoi_khoa_so: [] }

export type QtQuyetToanFull = QtQuyetToan & {
  gui_ke_toan_by: string | null
  duyet_by: string | null
  khoa_by: string | null
  updated_at?: string
}

export type QtDuChiChotFull = QtDuChiChot & { ke_toan_nhan_by: string | null; price_table_id: string | null }

export type EventAdvance = {
  id: string
  supplier_name: string
  nha_cung_cap_id: string | null
  vat_rate: number
  advance_rate: number
  advance_amount: number | null
  paid_amount: number
  paid_at: string | null
  status: 'draft' | 'requested' | 'approved' | 'paid' | 'cancelled'
  notes: string | null
  created_at: string
}

export type QtGuiBanChup = { id: string; lan: number; chi_phi: QtChiPhi[]; khach: QtKhachDieuChinh[]; created_by: string | null; created_at: string }
export type QtLichSu = { id: string; hanh_dong: string; ly_do: string | null; meta: Record<string, unknown> | null; user_id: string | null; created_at: string }

export type QtChot = {
  opportunity_id: string
  doanh_thu: number | null; vat_ra: number | null; chi_phi: number | null; vat_vao: number | null; gtgt: number | null
  tndn: number | null; tncn: number | null; loi_nhuan: number | null; cskh: number | null; ln_tinh_hh: number | null
  hh_sale_chinh: number | null; hh_sale_phu: number | null; hh_dieu_hanh: number | null; hh_ke_toan: number | null
  ln_con_lai: number | null; ln_du_chi: number | null
  sale_chinh_id: string | null; sale_phu_id: string | null; dieu_hanh_id: string | null; ke_toan_id: string | null
  ty_le: Partial<HhTyLe> | null
  chi_tiet: Record<string, unknown> | null
  chot_at: string
  chot_by: string | null
}

export type QtDoan = {
  id: string
  ten_doan: string
  hanh_trinh: string | null
  ngay_di: string
  ngay_ve: string | null
  sl_khach: number | null
  loai_doan: 'tour' | 'su_kien'
  ten_chuong_trinh: string | null
  thoi_gian_chuong_trinh: string | null
  dia_diem_chuong_trinh: string | null
}

export type QtOpp = {
  id: string
  title: string
  stage: string | null
  tour_date: string | null
  tour_end_date: string | null
  khach: string | null
  dia_diem: string | null
  nl: number | null
  te: number | null
  em_be: number | null
  department: string | null
  assigned_to: string | null
  operator_id: string | null
  sale_chinh_id: string | null
  sale_chinh_ten: string | null
  ticketing_ids: string[]
}

export type QtBundle = {
  migration_missing?: false
  opportunity_id: string
  doan: QtDoan | null
  opp: QtOpp
  qt: QtQuyetToanFull | null
  du_chi: QtDuChiChotFull[] // lan giảm dần — phần tử đầu là lần gửi mới nhất
  chi_phi: QtChiPhi[]
  khach: QtKhachDieuChinh[]
  hoa_don: QtHoaDonNcc[]
  thanh_toan: QtThanhToanNcc[]
  thu_khach: QtThuKhach[]
  lich_thu: QtLichThu[]
  tam_ung: QtTamUng[]
  event_advances: EventAdvance[]
  gui_ban_chup: QtGuiBanChup[] // lan giảm dần
  lich_su: QtLichSu[]
  chot: QtChot | null
  tncn: number
  cau_hinh: QtCauHinh
  ncc_options: { id: string; name: string }[]
  phan_loai_options: { id: string; ten: string }[]
  users: { id: string; full_name: string }[]
  names: Record<string, string>
  quyen: { khoa_so: boolean; super_admin: boolean }
}

export type QtBundleResponse = QtBundle | { migration_missing: true; message: string }

/** Tỷ lệ hoa hồng áp cho đơn: mặc định → cài đặt chung → ghi đè của đơn. */
export function tyLeCuaDon(cauHinh: Pick<QtCauHinh, 'hh_ty_le'>, qt: Pick<QtQuyetToan, 'hh_ty_le'> | null): HhTyLe {
  const out: HhTyLe = { ...HH_TY_LE_MAC_DINH, ...(cauHinh.hh_ty_le ?? {}) }
  for (const [k, v] of Object.entries(qt?.hh_ty_le ?? {})) {
    if (v != null && Number.isFinite(Number(v))) out[k as keyof HhTyLe] = Number(v)
  }
  return out
}

/** Đọc cấu hình qt_cau_hinh (mảng key/value) về dạng có kiểu, thiếu thì dùng mặc định. */
export function docCauHinhRows(rows: { key: string; value: unknown }[] | null | undefined): QtCauHinh {
  const out: QtCauHinh = { ...QT_CAU_HINH_MAC_DINH, hh_ty_le: { ...HH_TY_LE_MAC_DINH } }
  for (const r of rows ?? []) {
    if (r.key === 'hh_ty_le' && r.value && typeof r.value === 'object') {
      for (const [k, v] of Object.entries(r.value as Record<string, unknown>)) {
        if (k in out.hh_ty_le && Number.isFinite(Number(v))) out.hh_ty_le[k as keyof HhTyLe] = Number(v)
      }
    }
    if (r.key === 'hh_khi_ln_am' && (r.value === 'giu_am' || r.value === 've_0')) out.hh_khi_ln_am = r.value
    if (r.key === 'nguoi_khoa_so' && Array.isArray(r.value)) out.nguoi_khoa_so = r.value.filter((x): x is string => typeof x === 'string')
  }
  return out
}

export type DuLieuTinh = {
  qt: QtQuyetToan | null
  duChiMoiNhat: QtDuChiChot | null
  chiPhi: QtChiPhi[]
  khach: QtKhachDieuChinh[]
  hoaDon: QtHoaDonNcc[]
  thanhToan: QtThanhToanNcc[]
  thuKhach: QtThuKhach[]
  tamUng: QtTamUng[]
  tncn: number
  cauHinh: QtCauHinh
  vaiTro: { saleChinhId: string | null; salePhuId: string | null; dieuHanhId: string | null; keToanId: string | null }
}

export function tinhTuDuLieu(d: DuLieuTinh): KetQuaQuyetToan {
  return tinhQuyetToan({
    qt: d.qt,
    duChiMoiNhat: d.duChiMoiNhat,
    chiPhi: d.chiPhi,
    khach: d.khach,
    hoaDon: d.hoaDon,
    thanhToan: d.thanhToan,
    thuKhach: d.thuKhach,
    tamUng: d.tamUng,
    tncn: d.tncn,
    tyLe: tyLeCuaDon(d.cauHinh, d.qt),
    khiLnAm: d.cauHinh.hh_khi_ln_am,
    vaiTro: {
      saleChinh: !!d.vaiTro.saleChinhId,
      salePhu: !!d.vaiTro.salePhuId,
      dieuHanh: !!d.vaiTro.dieuHanhId,
      keToan: !!d.vaiTro.keToanId,
    },
  })
}

export function duLieuTuBundle(b: QtBundle): DuLieuTinh {
  return {
    qt: b.qt,
    duChiMoiNhat: b.du_chi[0] ?? null,
    chiPhi: b.chi_phi,
    khach: b.khach,
    hoaDon: b.hoa_don,
    thanhToan: b.thanh_toan,
    thuKhach: b.thu_khach,
    tamUng: b.tam_ung,
    tncn: b.tncn,
    cauHinh: b.cau_hinh,
    vaiTro: { saleChinhId: b.opp.sale_chinh_id, salePhuId: b.opp.assigned_to, dieuHanhId: b.opp.operator_id, keToanId: b.qt?.ke_toan_id ?? null },
  }
}

export function tinhTuBundle(b: QtBundle): KetQuaQuyetToan {
  return tinhTuDuLieu(duLieuTuBundle(b))
}

/** Đọc mô tả JSON của đơn CRM (pax_adult/pax_child/pax_infant/destination). Lỗi → rỗng. */
export function docMoTaDon(description: string | null | undefined): { nl: number | null; te: number | null; em_be: number | null; dia_diem: string | null } {
  let d: Record<string, unknown> = {}
  try {
    const p = description ? JSON.parse(description) : null
    if (p && typeof p === 'object') d = p as Record<string, unknown>
  } catch { /* mô tả không phải JSON */ }
  const so = (v: unknown) => {
    const x = Number(v)
    return v === '' || v == null || !Number.isFinite(x) ? null : x
  }
  const dd = typeof d.destination === 'string' && d.destination.trim() ? d.destination.trim() : null
  return { nl: so(d.pax_adult), te: so(d.pax_child), em_be: so(d.pax_infant), dia_diem: dd }
}

/** Ghi số chốt khi khoá sổ (bảng qt_chot) từ kết quả tính. */
export function soChotTuKetQua(kq: KetQuaQuyetToan) {
  return {
    doanh_thu: kq.doanhThu,
    vat_ra: kq.vatRa,
    chi_phi: kq.tongChi,
    vat_vao: kq.vatVao,
    gtgt: kq.gtgt,
    tndn: kq.tndn,
    tncn: kq.tncn,
    loi_nhuan: kq.loiNhuan,
    cskh: kq.cskh,
    ln_tinh_hh: kq.lnTinhHh,
    hh_sale_chinh: kq.hhSaleChinh,
    hh_sale_phu: kq.hhSalePhu,
    hh_dieu_hanh: kq.hhDieuHanh,
    hh_ke_toan: kq.hhKeToan,
    ln_con_lai: kq.lnConLai,
    ln_du_chi: kq.lnDuChi,
  }
}

/** Kết quả hiển thị: đơn đã khoá thì các số LN / hoa hồng / thuế lấy theo qt_chot (không đổi khi sửa tỷ lệ). */
export function apSoChot(kq: KetQuaQuyetToan, chot: QtChot | null, daKhoa: boolean): KetQuaQuyetToan {
  if (!daKhoa || !chot) return kq
  const v = (x: number | null, fb: number) => (x == null ? fb : Number(x))
  const loiNhuan = v(chot.loi_nhuan, kq.loiNhuan)
  const lnDuChi = chot.ln_du_chi == null ? kq.lnDuChi : Number(chot.ln_du_chi)
  return {
    ...kq,
    doanhThu: v(chot.doanh_thu, kq.doanhThu),
    vatRa: v(chot.vat_ra, kq.vatRa),
    tongChi: v(chot.chi_phi, kq.tongChi),
    vatVao: v(chot.vat_vao, kq.vatVao),
    gtgt: v(chot.gtgt, kq.gtgt),
    tndn: v(chot.tndn, kq.tndn),
    tncn: v(chot.tncn, kq.tncn),
    loiNhuan,
    cskh: v(chot.cskh, kq.cskh),
    lnTinhHh: v(chot.ln_tinh_hh, kq.lnTinhHh),
    hhSaleChinh: v(chot.hh_sale_chinh, kq.hhSaleChinh),
    hhSalePhu: v(chot.hh_sale_phu, kq.hhSalePhu),
    hhDieuHanh: v(chot.hh_dieu_hanh, kq.hhDieuHanh),
    hhKeToan: v(chot.hh_ke_toan, kq.hhKeToan),
    lnConLai: v(chot.ln_con_lai, kq.lnConLai),
    lnDuChi,
    tangGiamLn: lnDuChi == null ? null : loiNhuan - lnDuChi,
  }
}

export const LICH_SU_LABEL: Record<string, string> = {
  gui_du_chi: 'Gửi dự chi cho kế toán',
  nhan_du_chi: 'Kế toán đã nhận dự chi',
  tra_lai_du_chi: 'Kế toán trả lại dự chi',
  gui_quyet_toan: 'Gửi quyết toán cho kế toán',
  rut_lai: 'Rút lại quyết toán',
  xin_mo_lai_chi_phi: 'Xin mở lại chi phí',
  xin_mo_lai_khach: 'Xin mở lại quyết toán với khách',
  duyet: 'Kế toán duyệt',
  tra_lai: 'Kế toán trả lại',
  dong_y_mo_lai_chi_phi: 'Đồng ý mở lại chi phí',
  tu_choi_mo_lai_chi_phi: 'Từ chối mở lại chi phí',
  dong_y_mo_lai_khach: 'Đồng ý mở lại quyết toán với khách',
  tu_choi_mo_lai_khach: 'Từ chối mở lại quyết toán với khách',
  khach_gui_khach: 'Gửi khách',
  khach_dang_lam: 'Quyết toán với khách về đang làm',
  khach_khach_chot: 'Khách chốt quyết toán',
  khoa_so: 'Khoá sổ',
  mo_khoa: 'Mở khoá sổ',
  sua_thong_tin: 'Sửa thông tin quyết toán',
  chi_tam_ung: 'Chi tạm ứng điều hành',
  tu_choi_tam_ung: 'Từ chối tạm ứng điều hành',
  quyet_toan_tam_ung: 'Quyết toán tạm ứng điều hành',
}

/** Nhãn hành động lịch sử: có sẵn trong bảng, còn lại dạng "<thao tác> <bảng>" do API kế toán ghi. */
export function nhanLichSu(h: string): string {
  if (LICH_SU_LABEL[h]) return LICH_SU_LABEL[h]
  const [tt, ...rest] = h.split('_')
  const bang: Record<string, string> = {
    hoa_don: 'hoá đơn NCC', thanh_toan: 'thanh toán NCC', thu_khach: 'thu khách', lich_thu: 'lịch thu',
    chi_phi: 'chi phí', tam_ung: 'tạm ứng',
  }
  const thaoTac: Record<string, string> = { them: 'Thêm', sua: 'Sửa', xoa: 'Xoá', chi: 'Chi', tu: 'Từ chối', quyet: 'Quyết toán' }
  const b = rest.join('_')
  return thaoTac[tt] && bang[b] ? `${thaoTac[tt]} ${bang[b]}` : h
}

/** 1 dòng Bảng tổng hợp đoàn (LIST TỔNG, §10.5). Đơn đã khoá: số LN / hoa hồng / thuế lấy theo qt_chot. */
export type QtListRow = {
  doan_id: string | null // null = đơn có phiếu quyết toán nhưng chưa có đoàn
  opportunity_id: string
  ngay_di: string | null
  ngay_ve: string | null
  thang: string | null // yyyy-mm
  tinh_trang: 'chua_chay' | 'sap_chay' | 'dang_chay' | 'da_chay'
  phan_loai_id: string | null
  phan_loai: string | null
  khach: string | null
  ten_doan: string
  lich_trinh: string | null
  so_hop_dong: string | null
  sale_chinh_id: string | null
  sale_chinh: string | null
  sale_phu_id: string | null
  sale_phu: string | null
  dieu_hanh_id: string | null
  dieu_hanh: string | null
  ke_toan_id: string | null
  ke_toan: string | null
  tkt: string | null
  doanh_thu: number // trước VAT
  tong_quyet_toan: number // gồm VAT
  da_thu: number
  cong_no_khach: number
  tong_chi: number
  loi_nhuan: number
  cskh: number
  ln_tinh_hh: number
  hh_sale_chinh: number
  hh_sale_phu: number
  hh_dieu_hanh: number
  hh_ke_toan: number
  ln_con_lai: number
  gtgt: number
  cong_no_ncc: number
  tang_giam_ln: number | null
  ly_do_tang_giam_ln: string | null
  bo_phan: string | null
  chi_phi_trang_thai: string
  khach_trang_thai: string
  da_khoa: boolean
}
