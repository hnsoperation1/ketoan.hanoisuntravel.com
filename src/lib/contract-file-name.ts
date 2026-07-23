import type { Doan, HoSoWithNhanSu } from '@/types'

/** Tên file hiển thị khi tải xuống, dạng "yyyymmdd_HDV Họ tên dd.ddTm.docx" (yyyymmdd/dd.dd/T lấy theo
 *  ngày đi-về của đoàn). Khác với storage key nội bộ (đã bỏ dấu) — tên này chỉ dùng cho Content-Disposition.
 *  Tách riêng khỏi docx-merge.ts (không phụ thuộc pizzip/docxtemplater) để dùng được cả ở client component. */
export function buildContractFileName(doan: Doan, hoSo: HoSoWithNhanSu): string {
  const [y, m, d] = doan.ngay_di.split('-')
  const ngayVeDD = doan.ngay_ve ? doan.ngay_ve.split('-')[2] : d
  const thang = String(Number(m))
  return `${y}${m}${d}_${hoSo.nhansu.prefix} ${hoSo.nhansu.ho_ten} ${d}.${ngayVeDD}T${thang}.docx`
}
