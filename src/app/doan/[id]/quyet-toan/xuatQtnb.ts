// Xuất QTNB (quyết toán nội bộ) ra Excel theo bố cục file QTNB công ty: khối thông tin; A chi phí thực tế;
// B doanh thu; C bảng kê hoá đơn & thanh toán; D công nợ NCC; F công nợ khách; thuế & lợi nhuận. Ghi giá trị (không công thức).

import type { Worksheet } from 'exceljs'
import { formatDateVN } from '@/lib/format'
import { NGUOI_CHI_LABEL, THANH_TOAN_LOAI_LABEL, docSoTien, type KetQuaQuyetToan } from '@/lib/quyetToan'
import type { QtBundle } from '@/lib/quyetToanBundle'

const n = (v: unknown) => Number(v ?? 0) || 0
const MONEY = '#,##0;[Red]-#,##0'
const NCOL = 9

export async function xuatQtnb(b: QtBundle, kq: KetQuaQuyetToan) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('QTNB', { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 6 }, { width: 42 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 16 }, { width: 13 }, { width: 16 }, { width: 26 }]
  const ten = (id: string | null | undefined) => (id ? b.names[id] ?? b.users.find((u) => u.id === id)?.full_name ?? '' : '')
  const thin = { style: 'thin' as const, color: { argb: 'FFBDBDBD' } }
  let r = 1

  const tieuDe = (text: string) => {
    r += 1
    ws.mergeCells(r, 1, r, NCOL)
    const c = ws.getCell(r, 1)
    c.value = text
    c.font = { bold: true, size: 12, color: { argb: 'FF0069A0' } }
    r += 1
  }
  const dong = (vals: (string | number | null)[], opt: { bold?: boolean; fill?: string; money?: number[] } = {}) => {
    const row = ws.getRow(r)
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1)
      c.value = v
      c.border = { top: thin, left: thin, bottom: thin, right: thin }
      if (opt.bold) c.font = { bold: true }
      if (opt.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opt.fill } }
      if (typeof v === 'number' && (opt.money ?? []).includes(i + 1)) c.numFmt = MONEY
      c.alignment = { vertical: 'top', wrapText: i === 1 || i === NCOL - 1 }
    })
    r += 1
  }
  const header = (vals: string[]) => dong(vals, { bold: true, fill: 'FFF1F3F4' })
  const kv = (label: string, value: string | number | null, sheet: Worksheet = ws) => {
    sheet.getCell(r, 1).value = label
    sheet.getCell(r, 1).font = { bold: true }
    sheet.mergeCells(r, 1, r, 2)
    sheet.getCell(r, 3).value = value
    if (typeof value === 'number') sheet.getCell(r, 3).numFmt = MONEY
    sheet.mergeCells(r, 3, r, NCOL)
    r += 1
  }

  // ── Khối thông tin ──
  ws.mergeCells(r, 1, r, NCOL)
  ws.getCell(r, 1).value = 'QUYẾT TOÁN NỘI BỘ'
  ws.getCell(r, 1).font = { bold: true, size: 16 }
  ws.getCell(r, 1).alignment = { horizontal: 'center' }
  r += 2
  const doan = b.doan
  kv('Khách hàng', b.opp.khach ?? '')
  kv('Chương trình', doan?.ten_chuong_trinh || b.opp.title)
  kv('Địa điểm', doan?.dia_diem_chuong_trinh || b.opp.dia_diem || doan?.hanh_trinh || '')
  kv('Thời gian', [formatDateVN(doan?.ngay_di ?? b.opp.tour_date), formatDateVN(doan?.ngay_ve ?? b.opp.tour_end_date)].filter(Boolean).join(' – '))
  kv('NL / TE / HDV', `${b.opp.nl ?? doan?.sl_khach ?? ''} / ${b.opp.te ?? 0}`)
  kv('Số hợp đồng', b.qt?.so_hop_dong ?? '')
  kv('Số HĐ thanh lý', b.qt?.so_hd_thanh_ly ?? '')
  kv('Sale chính / Sale phụ', [b.opp.sale_chinh_ten, ten(b.opp.assigned_to)].filter(Boolean).join(' / '))
  kv('Điều hành', ten(b.opp.operator_id))
  kv('Kế toán / KSNB', [ten(b.qt?.ke_toan_id), ten(b.qt?.ksnb_id)].filter(Boolean).join(' / '))
  kv('Hoá đơn VAT', (b.qt?.co_vat ?? true) ? 'Có' : 'Không')
  const tuChi = b.tam_ung.filter((t) => t.trang_thai === 'da_chi' || t.trang_thai === 'da_quyet_toan').reduce((s, t) => s + n(t.so_tien_chi), 0)
  const tuQt = b.tam_ung.filter((t) => t.trang_thai === 'da_quyet_toan').reduce((s, t) => s + n(t.so_tien_da_dung), 0)
  kv('Tạm ứng ĐH: đề nghị / chi / quyết toán', `${b.tam_ung.reduce((s, t) => s + n(t.so_tien_de_nghi), 0).toLocaleString('vi-VN')} / ${tuChi.toLocaleString('vi-VN')} / ${tuQt.toLocaleString('vi-VN')}`)
  kv('Trạng thái', b.qt?.da_khoa ? 'Đã khoá sổ' : 'Tạm tính')

  // ── A. Chi phí thực tế ──
  tieuDe('A. CHI PHÍ THỰC TẾ')
  header(['STT', 'Dịch vụ', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'VAT', 'Tổng', 'Người chi'])
  const nhomList: string[] = []
  for (const c of b.chi_phi) if (!nhomList.includes(c.nhom ?? '')) nhomList.push(c.nhom ?? '')
  let stt = 0
  for (const g of nhomList) {
    const ls = b.chi_phi.filter((c) => (c.nhom ?? '') === g)
    if (g) dong(['', g, '', '', '', ls.reduce((s, c) => s + n(c.thanh_tien), 0), ls.reduce((s, c) => s + n(c.tien_vat), 0), ls.reduce((s, c) => s + n(c.thanh_tien) + n(c.tien_vat), 0), ''], { bold: true, fill: 'FFEBF6FB', money: [6, 7, 8] })
    for (const c of ls) {
      stt += 1
      dong([stt, c.ten, c.dvt ?? '', n(c.so_luong) * (n(c.so_lan) || 1), n(c.don_gia), n(c.thanh_tien), n(c.tien_vat), n(c.thanh_tien) + n(c.tien_vat),
        `${NGUOI_CHI_LABEL[c.nguoi_chi]}${c.ncc_ten ? ` · ${c.ncc_ten}` : ''}`], { money: [5, 6, 7, 8] })
    }
  }
  if (kq.comKhach) dong(['', 'COM khách', '', '', '', kq.comKhach, 0, kq.comKhach, 'COM'], { money: [6, 7, 8] })
  dong(['', 'TỔNG CHI PHÍ', '', '', '', kq.chiPhi, kq.vatChiPhi, kq.chiPhi + kq.vatChiPhi, ''], { bold: true, fill: 'FFF8F9FA', money: [6, 7, 8] })

  // ── B. Doanh thu ──
  tieuDe('B. DOANH THU')
  header(['STT', 'Nội dung', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'VAT %', 'Trạng thái', 'Ghi chú'])
  dong(['', 'Giá trị hợp đồng', '', '', '', kq.giaTriHd, n(b.qt?.vat_ra_rate ?? 8), '', ''], { money: [6] })
  const TT = { de_xuat: 'Đề xuất', khach_dong_y: 'Khách đồng ý', khach_tu_choi: 'Khách từ chối' } as const
  for (const loai of ['tang', 'giam'] as const) {
    const ls = b.khach.filter((k) => k.loai === loai)
    if (!ls.length) continue
    dong(['', loai === 'tang' ? 'Phát sinh tăng' : 'Phát sinh giảm', '', '', '', ls.filter((k) => k.trang_thai === 'khach_dong_y').reduce((s, k) => s + n(k.thanh_tien), 0) * (loai === 'giam' ? -1 : 1), '', '', ''], { bold: true, fill: 'FFEBF6FB', money: [6] })
    ls.forEach((k, i) => dong([i + 1, k.ten, k.dvt ?? '', n(k.so_luong), n(k.don_gia), n(k.thanh_tien) * (loai === 'giam' ? -1 : 1), n(k.vat_rate), TT[k.trang_thai], [k.y_kien_hns, k.y_kien_khach].filter(Boolean).join(' | ')], { money: [5, 6] }))
  }
  dong(['', 'Doanh thu trước VAT', '', '', '', kq.doanhThu, '', '', ''], { bold: true, money: [6] })
  dong(['', 'VAT ra', '', '', '', kq.vatRa, '', '', ''], { money: [6] })
  dong(['', 'TỔNG QUYẾT TOÁN', '', '', '', kq.tongQuyetToan, '', '', ''], { bold: true, fill: 'FFF8F9FA', money: [6] })
  ws.mergeCells(r, 1, r, NCOL)
  ws.getCell(r, 1).value = `Bằng chữ: ${docSoTien(kq.tongQuyetToan)}`
  ws.getCell(r, 1).font = { italic: true }
  r += 1

  // ── C. Bảng kê hoá đơn & thanh toán ──
  tieuDe('C. BẢNG KÊ HOÁ ĐƠN ĐẦU VÀO')
  header(['STT', 'NCC', 'Số HĐ', 'Ngày', 'Giá trị', 'VAT %', 'Tiền VAT', 'Tổng', 'Ghi chú'])
  b.hoa_don.forEach((h, i) => dong([i + 1, h.ncc_ten ?? '', h.so_hoa_don ?? '', formatDateVN(h.ngay_hoa_don), n(h.gia_tri), n(h.vat_rate), n(h.tien_vat), n(h.tong), h.ghi_chu ?? ''], { money: [5, 7, 8] }))
  dong(['', 'Tổng', '', '', b.hoa_don.reduce((s, h) => s + n(h.gia_tri), 0), '', b.hoa_don.reduce((s, h) => s + n(h.tien_vat), 0), b.hoa_don.reduce((s, h) => s + n(h.tong), 0), ''], { bold: true, money: [5, 7, 8] })
  tieuDe('C. BẢNG KÊ THANH TOÁN NCC')
  header(['STT', 'NCC', 'Loại', 'Ngày', 'Số tiền', 'Tài khoản', '', '', 'Ghi chú'])
  b.thanh_toan.forEach((t, i) => dong([i + 1, t.ncc_ten ?? '', THANH_TOAN_LOAI_LABEL[t.loai], formatDateVN(t.ngay), n(t.so_tien), t.tai_khoan ?? '', '', '', t.ghi_chu ?? ''], { money: [5] }))
  dong(['', 'Tổng đã chi', '', '', b.thanh_toan.reduce((s, t) => s + n(t.so_tien), 0), '', '', '', ''], { bold: true, money: [5] })

  // ── D. Công nợ NCC ──
  tieuDe('D. CÔNG NỢ NCC')
  header(['STT', 'NCC', '', '', 'Phải trả', 'Đã trả', 'Còn nợ', 'Hoá đơn', 'Ghi chú'])
  kq.congNoNcc.forEach((c, i) => dong([i + 1, c.ncc_ten, '', '', c.phaiTra, c.daTra, c.conNo, c.hoaDon, c.lechHoaDon ? 'Hoá đơn lệch phải trả' : ''], { money: [5, 6, 7, 8] }))
  dong(['', 'Tổng', '', '', kq.congNoNcc.reduce((s, c) => s + c.phaiTra, 0), kq.congNoNcc.reduce((s, c) => s + c.daTra, 0), kq.tongCongNoNcc, kq.congNoNcc.reduce((s, c) => s + c.hoaDon, 0), ''], { bold: true, money: [5, 6, 7, 8] })

  // ── F. Công nợ khách ──
  tieuDe('F. CÔNG NỢ KHÁCH')
  header(['Lần', 'Nội dung', '', 'Ngày', 'Số tiền', 'Tài khoản', '', '', 'Ghi chú'])
  ;[...b.thu_khach].sort((a, c) => a.ngay.localeCompare(c.ngay)).forEach((t, i) =>
    dong([t.lan ?? i + 1, `Khách thanh toán lần ${t.lan ?? i + 1}`, '', formatDateVN(t.ngay), n(t.so_tien), t.tai_khoan ?? '', '', '', t.ghi_chu ?? ''], { money: [5] }))
  dong(['', 'Phải thu', '', '', kq.tongQuyetToan, '', '', '', ''], { money: [5] })
  dong(['', 'Đã thu', '', '', kq.daThu, '', '', '', ''], { money: [5] })
  dong(['', 'Còn nợ', '', '', kq.congNoKhach, '', '', '', ''], { bold: true, fill: 'FFF8F9FA', money: [5] })

  // ── Thuế & lợi nhuận ──
  tieuDe(`THUẾ & LỢI NHUẬN${b.qt?.da_khoa ? '' : ' (TẠM TÍNH)'}`)
  const tl = b.chot?.ty_le ?? b.qt?.hh_ty_le ?? null
  const rate = (k: 'cskh' | 'sale_chinh' | 'sale_phu' | 'dieu_hanh' | 'ke_toan') => (tl?.[k] != null ? Number(tl[k]) : b.cau_hinh.hh_ty_le[k])
  const rows: [string, number | null][] = [
    ['Doanh thu trước VAT', kq.doanhThu],
    ['VAT ra', kq.vatRa],
    ['VAT vào được khấu trừ', kq.vatVao],
    ['VAT không được khấu trừ', kq.vatKhongKhauTru],
    ['GTGT phải nộp', kq.gtgt],
    ['TNCN', kq.tncn],
    ['TNDN', kq.tndn],
    ['Tổng chi', kq.tongChi],
    ['Lợi nhuận', kq.loiNhuan],
    ['LN dự chi', kq.lnDuChi],
    ['Tăng / giảm LN', kq.tangGiamLn],
    [`CF CSKH ${rate('cskh')}%`, kq.cskh],
    ['LN tính hoa hồng', kq.lnTinhHh],
    [`HH sale chính ${rate('sale_chinh')}%`, kq.hhSaleChinh],
    [`HH sale phụ ${rate('sale_phu')}%`, kq.hhSalePhu],
    [`HH điều hành ${rate('dieu_hanh')}%`, kq.hhDieuHanh],
    [`HH kế toán ${rate('ke_toan')}%`, kq.hhKeToan],
    ['LN còn lại', kq.lnConLai],
  ]
  for (const [label, v] of rows) {
    const dam = label === 'Lợi nhuận' || label === 'LN còn lại'
    dong(['', label, '', '', v, '', '', '', ''], { bold: dam, fill: dam ? 'FFEBF6FB' : undefined, money: [5] })
  }
  if (b.qt?.ly_do_tang_giam_ln) kv('Lý do tăng / giảm LN', b.qt.ly_do_tang_giam_ln)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `QTNB - ${(doan?.ten_doan ?? b.opp.title).replace(/[\\/:*?"<>|]/g, '_')}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
