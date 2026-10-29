// Tính toán Dự chi → Quyết toán (đặc tả: tai-lieu-tham-khao/spec-quyet-toan-tour.md, §4 + §10).
// File thuần (không import client/server) — BẢN GỐC ở ketoan.ihns.vn/src/lib/quyetToan.ts,
// bản sao y hệt ở crm.ihns.vn/src/lib/quyetToan.ts và ihns.vn/src/lib/quyetToan.ts: sửa thì sửa cả 3.

export type ChiPhiTrangThai = 'dang_lam' | 'cho_ke_toan' | 'ke_toan_duyet'
export type KhachTrangThai = 'dang_lam' | 'gui_khach' | 'khach_chot'

export const CHI_PHI_TRANG_THAI_LABEL: Record<ChiPhiTrangThai, string> = {
  dang_lam: 'Điều hành đang làm',
  cho_ke_toan: 'Chờ kế toán',
  ke_toan_duyet: 'Kế toán đã duyệt',
}
export const KHACH_TRANG_THAI_LABEL: Record<KhachTrangThai, string> = {
  dang_lam: 'Đang làm',
  gui_khach: 'Đã gửi khách',
  khach_chot: 'Khách đã chốt',
}
export const NGUOI_CHI_LABEL = { ncc: 'NCC', hns: 'HNS', com: 'COM' } as const
export const NGUON_LABEL = { du_chi: 'Dự chi', phat_sinh: 'Phát sinh', noi_bo: 'Nội bộ', ke_toan: 'Kế toán' } as const
export const THANH_TOAN_LOAI_LABEL = { coc: 'Cọc', tam_ung: 'Tạm ứng', thanh_toan: 'Thanh toán', hoan_coc: 'Hoàn cọc' } as const
export const TAM_UNG_TRANG_THAI_LABEL = {
  de_nghi: 'Đề nghị', da_chi: 'Đã chi', da_quyet_toan: 'Đã quyết toán', tu_choi: 'Từ chối',
} as const

export type QtQuyetToan = {
  opportunity_id: string
  phan_loai_id: string | null
  co_vat: boolean
  gia_tri_hd: number | null
  vat_ra_rate: number
  so_hop_dong: string | null
  so_hd_thanh_ly: string | null
  com_khach: number
  tndn_nhap_tay: number | null
  ke_toan_id: string | null
  ksnb_id: string | null
  hh_ty_le: Partial<HhTyLe> | null
  chi_phi_trang_thai: ChiPhiTrangThai
  lan_gui: number
  gui_ke_toan_at: string | null
  duyet_at: string | null
  ly_do_tra_lai: string | null
  chi_phi_xin_mo_lai: string | null
  khach_trang_thai: KhachTrangThai
  khach_chot_at: string | null
  khach_xin_mo_lai: string | null
  da_khoa: boolean
  khoa_at: string | null
  ly_do_tang_giam_ln: string | null
}

export type DuChiLine = {
  service_id: string
  nhom: string | null
  ten: string
  dvt: string | null
  so_luong: number
  so_lan: number
  don_gia: number
  thanh_tien: number
  vat_rate: number
  nha_cung_cap_id: string | null
  ncc_ten: string | null
  ncc_lien_he?: string | null
  ncc_sdt?: string | null
  quote_so_luong: number
  quote_so_lan: number
  quote_don_gia: number
  quote_thanh_tien: number
  include_in_quote: boolean
}

export type QtDuChiChot = {
  id: string
  opportunity_id: string
  lan: number
  chot_at: string
  chot_by: string | null
  so_khach: number | null
  lines: DuChiLine[]
  tong_net: number
  tong_vat_net: number
  tong_ban: number
  ghi_chu: string | null
  ke_toan_nhan_at: string | null
  ly_do_tra_lai: string | null
}

export type QtChiPhi = {
  id: string
  opportunity_id: string
  sort_order: number
  service_id: string | null
  nhom: string | null
  ngay: number | null
  ten: string
  dvt: string | null
  so_luong: number
  so_lan: number
  don_gia: number
  gia_gom_vat: boolean
  vat_rate: number
  thanh_tien: number // chưa VAT (cột generated)
  tien_vat: number
  nguoi_chi: keyof typeof NGUOI_CHI_LABEL
  nha_cung_cap_id: string | null
  ncc_ten: string | null
  ncc_lien_he: string | null
  ncc_sdt: string | null
  nguon: keyof typeof NGUON_LABEL
  co_hd_ncc: boolean
  hd_ncc_url: string | null
  hoa_don_id: string | null
  ghi_chu: string | null
}

export type QtKhachDieuChinh = {
  id: string
  opportunity_id: string
  sort_order: number
  loai: 'tang' | 'giam'
  ten: string
  dvt: string | null
  don_gia: number
  so_luong: number
  vat_rate: number
  thanh_tien: number
  service_id: string | null
  chi_phi_id: string | null
  y_kien_hns: string | null
  y_kien_khach: string | null
  trang_thai: 'de_xuat' | 'khach_dong_y' | 'khach_tu_choi'
}

export type QtHoaDonNcc = {
  id: string; nha_cung_cap_id: string | null; ncc_ten: string | null; so_hoa_don: string | null
  ngay_hoa_don: string | null; gia_tri: number; vat_rate: number; tien_vat: number; tong: number
  file_url: string | null; ghi_chu: string | null
}
export type QtThanhToanNcc = {
  id: string; nha_cung_cap_id: string | null; ncc_ten: string | null; service_id: string | null
  chi_phi_id: string | null; event_advance_id: string | null; loai: keyof typeof THANH_TOAN_LOAI_LABEL
  ngay: string; so_tien: number; tai_khoan: string | null; sao_ke_id: string | null; ghi_chu: string | null
}
export type QtThuKhach = {
  id: string; lan: number | null; ngay: string; so_tien: number; tai_khoan: string | null
  sao_ke_id: string | null; ghi_chu: string | null
}
export type QtLichThu = {
  id: string; dot: number; han: string; so_tien: number | null; ty_le: number | null; ghi_chu: string | null
}
export type QtTamUng = {
  id: string; opportunity_id: string; nguoi_ung: string | null; so_tien_de_nghi: number; ly_do: string | null
  trang_thai: keyof typeof TAM_UNG_TRANG_THAI_LABEL; ngay_chi: string | null; so_tien_chi: number | null
  tai_khoan: string | null; so_tien_da_dung: number | null; so_tien_hoan: number | null
  ghi_chu_ke_toan: string | null; created_at: string
}

export type HhTyLe = { cskh: number; sale_chinh: number; sale_phu: number; dieu_hanh: number; ke_toan: number }
export const HH_TY_LE_MAC_DINH: HhTyLe = { cskh: 5, sale_chinh: 25, sale_phu: 5, dieu_hanh: 4, ke_toan: 3.5 }
export type HhKhiLnAm = 'giu_am' | 've_0'

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)

/** Khoá gom NCC: id danh mục nếu có, không thì tên viết thường. */
export function nccKey(r: { nha_cung_cap_id: string | null; ncc_ten: string | null }): string {
  return r.nha_cung_cap_id ?? `ten:${(r.ncc_ten ?? '').trim().toLowerCase()}`
}

/** Tách giá trị dòng theo cách cột generated của qt_chi_phi tính — dùng khi xem trước lúc chưa lưu. */
export function tinhDongChiPhi(r: Pick<QtChiPhi, 'so_luong' | 'so_lan' | 'don_gia' | 'gia_gom_vat' | 'vat_rate'>) {
  const goc = n(r.so_luong) * n(r.so_lan) * n(r.don_gia)
  if (r.gia_gom_vat) {
    const thanhTien = Math.round(goc / (1 + n(r.vat_rate) / 100))
    return { thanhTien, tienVat: goc - thanhTien, tong: goc }
  }
  const tienVat = Math.round((goc * n(r.vat_rate)) / 100)
  return { thanhTien: goc, tienVat, tong: goc + tienVat }
}

export type DoanhThuKhach = {
  giaTriHd: number
  tang: number
  giam: number
  tangDeXuat: number
  giamDeXuat: number
  doanhThu: number // trước VAT, chỉ dòng khách đồng ý
  vatRa: number
  tongQuyetToan: number // sau VAT
}

/** Doanh thu với khách: giá trị HĐ (fallback = tổng báo khách của dự chi gửi gần nhất) + PS tăng − PS giảm. */
export function tinhDoanhThuKhach(
  qt: Pick<QtQuyetToan, 'gia_tri_hd' | 'vat_ra_rate' | 'co_vat'> | null,
  khach: QtKhachDieuChinh[],
  duChiMoiNhat: Pick<QtDuChiChot, 'tong_ban'> | null,
): DoanhThuKhach {
  const giaTriHd = qt?.gia_tri_hd != null ? n(qt.gia_tri_hd) : n(duChiMoiNhat?.tong_ban)
  const dongY = khach.filter((k) => k.trang_thai === 'khach_dong_y')
  const deXuat = khach.filter((k) => k.trang_thai === 'de_xuat')
  const tang = sum(dongY.filter((k) => k.loai === 'tang'), (k) => n(k.thanh_tien))
  const giam = sum(dongY.filter((k) => k.loai === 'giam'), (k) => n(k.thanh_tien))
  const doanhThu = giaTriHd + tang - giam
  const coVat = qt?.co_vat ?? true
  const vatRa = coVat
    ? Math.round(
        (giaTriHd * n(qt?.vat_ra_rate ?? 8)) / 100 +
          sum(dongY, (k) => ((k.loai === 'tang' ? 1 : -1) * n(k.thanh_tien) * n(k.vat_rate)) / 100),
      )
    : 0
  return {
    giaTriHd,
    tang,
    giam,
    tangDeXuat: sum(deXuat.filter((k) => k.loai === 'tang'), (k) => n(k.thanh_tien)),
    giamDeXuat: sum(deXuat.filter((k) => k.loai === 'giam'), (k) => n(k.thanh_tien)),
    doanhThu,
    vatRa,
    tongQuyetToan: doanhThu + vatRa,
  }
}

export type CongNoNcc = {
  key: string
  nha_cung_cap_id: string | null
  ncc_ten: string
  phaiTra: number // gồm VAT
  daTra: number
  conNo: number
  hoaDon: number // tổng hoá đơn (gồm VAT)
  lechHoaDon: boolean
}

export function tinhCongNoNcc(chiPhi: QtChiPhi[], thanhToan: QtThanhToanNcc[], hoaDon: QtHoaDonNcc[]): CongNoNcc[] {
  const map = new Map<string, CongNoNcc>()
  const get = (r: { nha_cung_cap_id: string | null; ncc_ten: string | null }) => {
    const key = nccKey(r)
    let row = map.get(key)
    if (!row) {
      row = { key, nha_cung_cap_id: r.nha_cung_cap_id, ncc_ten: r.ncc_ten ?? '', phaiTra: 0, daTra: 0, conNo: 0, hoaDon: 0, lechHoaDon: false }
      map.set(key, row)
    }
    if (!row.ncc_ten && r.ncc_ten) row.ncc_ten = r.ncc_ten
    return row
  }
  for (const c of chiPhi) if (c.nguoi_chi === 'ncc') get(c).phaiTra += n(c.thanh_tien) + n(c.tien_vat)
  for (const t of thanhToan) get(t).daTra += n(t.so_tien)
  for (const h of hoaDon) get(h).hoaDon += n(h.tong)
  for (const r of Array.from(map.values())) {
    r.conNo = r.phaiTra - r.daTra
    r.lechHoaDon = r.hoaDon > 0 && Math.abs(r.hoaDon - r.phaiTra) >= 1
  }
  return Array.from(map.values()).sort((a, b) => a.ncc_ten.localeCompare(b.ncc_ten, 'vi'))
}

export type VaiTroHoaHong = { saleChinh: boolean; salePhu: boolean; dieuHanh: boolean; keToan: boolean }

export type KetQuaQuyetToan = DoanhThuKhach & {
  chiPhi: number // chưa VAT, gồm COM khách
  comKhach: number
  vatChiPhi: number // VAT trên các dòng chi phí
  vatVao: number // VAT trên hoá đơn thật
  vatKhongKhauTru: number
  gtgt: number // VAT ra − VAT vào
  tncn: number
  tndn: number
  tongChi: number // chi phí + VAT không khấu trừ + TNCN + TNDN
  loiNhuan: number
  tyLeLn: number | null
  cskh: number
  lnTinhHh: number
  hhSaleChinh: number
  hhSalePhu: number
  hhDieuHanh: number
  hhKeToan: number
  lnConLai: number
  daThu: number
  congNoKhach: number
  congNoNcc: CongNoNcc[]
  tongCongNoNcc: number
  tamUngChuaHoan: number
  cpDuChi: number | null
  lnDuChi: number | null
  tangGiamLn: number | null
}

export function tinhQuyetToan(input: {
  qt: QtQuyetToan | null
  duChiMoiNhat: QtDuChiChot | null
  chiPhi: QtChiPhi[]
  khach: QtKhachDieuChinh[]
  hoaDon: QtHoaDonNcc[]
  thanhToan: QtThanhToanNcc[]
  thuKhach: QtThuKhach[]
  tamUng: QtTamUng[]
  tncn: number // Σ ho_so.thue_nop của đoàn
  tyLe: HhTyLe
  khiLnAm: HhKhiLnAm
  vaiTro: VaiTroHoaHong
}): KetQuaQuyetToan {
  const { qt, duChiMoiNhat, chiPhi, khach, hoaDon, thanhToan, thuKhach, tamUng, tyLe, khiLnAm, vaiTro } = input
  const dt = tinhDoanhThuKhach(qt, khach, duChiMoiNhat)
  const comKhach = n(qt?.com_khach)
  const cp = sum(chiPhi, (c) => n(c.thanh_tien)) + comKhach
  const vatChiPhi = sum(chiPhi, (c) => n(c.tien_vat))
  const vatVao = sum(hoaDon, (h) => n(h.tien_vat))
  const vatKhongKhauTru = Math.max(0, vatChiPhi - vatVao)
  const gtgt = dt.vatRa - vatVao
  const tncn = n(input.tncn)
  const tndn = n(qt?.tndn_nhap_tay)
  const tongChi = cp + vatKhongKhauTru + tncn + tndn
  const loiNhuan = dt.doanhThu - tongChi

  const ve0 = khiLnAm === 've_0' && loiNhuan < 0
  const cskh = ve0 ? 0 : Math.round((loiNhuan * tyLe.cskh) / 100)
  const lnTinhHh = loiNhuan - cskh
  const hh = (on: boolean, rate: number) => (ve0 || !on ? 0 : Math.round((lnTinhHh * rate) / 100))
  const hhSaleChinh = hh(vaiTro.saleChinh, tyLe.sale_chinh)
  const hhSalePhu = hh(vaiTro.salePhu, tyLe.sale_phu)
  const hhDieuHanh = hh(vaiTro.dieuHanh, tyLe.dieu_hanh)
  const hhKeToan = hh(vaiTro.keToan, tyLe.ke_toan)

  const daThu = sum(thuKhach, (t) => n(t.so_tien))
  const congNoNcc = tinhCongNoNcc(chiPhi, thanhToan, hoaDon)
  const tamUngChuaHoan = sum(
    tamUng.filter((t) => t.trang_thai === 'da_chi'),
    (t) => n(t.so_tien_chi),
  )

  const cpDuChi = duChiMoiNhat ? n(duChiMoiNhat.tong_net) : null
  const lnDuChi = duChiMoiNhat ? n(duChiMoiNhat.tong_ban) - n(duChiMoiNhat.tong_net) : null

  return {
    ...dt,
    chiPhi: cp,
    comKhach,
    vatChiPhi,
    vatVao,
    vatKhongKhauTru,
    gtgt,
    tncn,
    tndn,
    tongChi,
    loiNhuan,
    tyLeLn: dt.doanhThu ? loiNhuan / dt.doanhThu : null,
    cskh,
    lnTinhHh,
    hhSaleChinh,
    hhSalePhu,
    hhDieuHanh,
    hhKeToan,
    lnConLai: lnTinhHh - hhSaleChinh - hhSalePhu - hhDieuHanh - hhKeToan,
    daThu,
    congNoKhach: dt.tongQuyetToan - daThu,
    congNoNcc,
    tongCongNoNcc: sum(congNoNcc, (r) => r.conNo),
    tamUngChuaHoan,
    cpDuChi,
    lnDuChi,
    tangGiamLn: lnDuChi == null ? null : loiNhuan - lnDuChi,
  }
}

export type SoSanhDong = {
  service_id: string
  ten: string
  duChi: number
  thucTe: number
  chenhLech: number
}

/** So từng dòng dự chi (bản gửi gần nhất) với chi phí thực tế theo service_id. */
export function soSanhDuChi(duChi: QtDuChiChot | null, chiPhi: QtChiPhi[]): SoSanhDong[] {
  if (!duChi) return []
  const thucTe = new Map<string, number>()
  for (const c of chiPhi) if (c.service_id) thucTe.set(c.service_id, (thucTe.get(c.service_id) ?? 0) + n(c.thanh_tien))
  return duChi.lines.map((l) => {
    const tt = thucTe.get(l.service_id) ?? 0
    return { service_id: l.service_id, ten: l.ten, duChi: n(l.thanh_tien), thucTe: tt, chenhLech: tt - n(l.thanh_tien) }
  })
}

/** Dòng chi phí khởi tạo từ dự chi (nút "Lấy từ dự chi"). */
export function chiPhiTuDuChi(duChi: QtDuChiChot, opportunityId: string, startOrder = 0) {
  return duChi.lines.map((l, i) => ({
    opportunity_id: opportunityId,
    sort_order: startOrder + i,
    service_id: l.service_id,
    nhom: l.nhom,
    ten: l.ten,
    dvt: l.dvt,
    so_luong: n(l.so_luong),
    so_lan: n(l.so_lan) || 1,
    don_gia: n(l.don_gia),
    gia_gom_vat: false,
    vat_rate: n(l.vat_rate),
    nguoi_chi: 'ncc' as const,
    nha_cung_cap_id: l.nha_cung_cap_id,
    ncc_ten: l.ncc_ten,
    ncc_lien_he: l.ncc_lien_he ?? null,
    ncc_sdt: l.ncc_sdt ?? null,
    nguon: 'du_chi' as const,
  }))
}

/** Tình trạng chạy theo ngày đi – về (bộ lọc LIST TỔNG). */
export function tinhTrangChay(ngayDi: string | null, ngayVe: string | null, homNay = new Date()): 'chua_chay' | 'sap_chay' | 'dang_chay' | 'da_chay' {
  if (!ngayDi) return 'chua_chay'
  const d = homNay.toISOString().slice(0, 10)
  const ve = ngayVe ?? ngayDi
  if (d > ve) return 'da_chay'
  if (d >= ngayDi) return 'dang_chay'
  const soNgay = (new Date(ngayDi).getTime() - new Date(d).getTime()) / 86_400_000
  return soNgay <= 30 ? 'sap_chay' : 'chua_chay'
}
export const TINH_TRANG_CHAY_LABEL = {
  chua_chay: 'Chưa chạy', sap_chay: 'Sắp chạy', dang_chay: 'Đang chạy', da_chay: 'Đã chạy',
} as const

/** Đọc số tiền tiếng Việt bằng chữ (phiếu xác nhận quyết toán). */
export function docSoTien(so: number): string {
  const x = Math.round(Math.abs(so))
  if (x === 0) return 'Không đồng'
  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const docBa = (b: number, du: boolean) => {
    const tr = Math.floor(b / 100), ch = Math.floor((b % 100) / 10), dv = b % 10
    const out: string[] = []
    if (du || tr > 0) out.push(chuSo[tr] + ' trăm')
    if (ch === 0) {
      if (dv > 0 && (du || tr > 0)) out.push('lẻ')
    } else if (ch === 1) out.push('mười')
    else out.push(chuSo[ch] + ' mươi')
    if (dv > 0) {
      if (dv === 1 && ch > 1) out.push('mốt')
      else if (dv === 5 && ch > 0) out.push('lăm')
      else if (dv === 4 && ch > 1) out.push('tư')
      else out.push(chuSo[dv])
    }
    return out.join(' ')
  }
  const donVi = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ']
  const nhom: number[] = []
  let t = x
  while (t > 0) { nhom.push(t % 1000); t = Math.floor(t / 1000) }
  const parts: string[] = []
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (nhom[i] === 0) continue
    parts.push(docBa(nhom[i], i < nhom.length - 1) + donVi[i])
  }
  const s = parts.join(' ').replace(/\s+/g, ' ').trim()
  return (so < 0 ? 'Âm ' : '') + s.charAt(0).toUpperCase() + s.slice(1) + ' đồng'
}
