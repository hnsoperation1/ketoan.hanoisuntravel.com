import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { Doan, HoSoWithNhanSu } from '@/types'
import { formatDateVN } from '@/lib/format'

/** Gom field từ nhansu + doan + ho_so thành object phẳng khớp đúng danh sách
 *  placeholder liệt kê ở màn "Biểu mẫu hợp đồng" (src/app/cai-dat/bieu-mau-hop-dong). */
export function buildMergeData(doan: Doan, hoSo: HoSoWithNhanSu): Record<string, string> {
  const n = hoSo.nhansu
  const money = (v: number | null) => (v != null ? v.toLocaleString('vi-VN') : '')

  return {
    ho_ten: n.ho_ten ?? '',
    dia_chi: n.dia_chi ?? '',
    so_cccd: n.so_cccd ?? '',
    ngay_sinh: formatDateVN(n.ngay_sinh),
    ngay_cap: formatDateVN(n.ngay_cap),
    noi_cap: n.noi_cap ?? '',
    ma_so_thue_tncn: n.ma_so_thue_tncn ?? '',
    sdt: n.sdt ?? '',
    email: n.email ?? '',
    so_the_hdv: n.so_the_hdv ?? '',
    loai_the_hdv: n.loai_the_hdv ?? '',
    han_the_hdv: formatDateVN(n.han_the_hdv),
    stk: n.stk ?? '',
    ten_ngan_hang: n.ten_ngan_hang ?? '',

    ten_doan: doan.ten_doan ?? '',
    hanh_trinh: doan.hanh_trinh ?? '',
    ngay_di: formatDateVN(doan.ngay_di),
    ngay_ve: formatDateVN(doan.ngay_ve),
    sl_khach: doan.sl_khach != null ? String(doan.sl_khach) : '',

    so_hop_dong: hoSo.so_hop_dong ?? '',
    ngay_dich_vu: formatDateVN(hoSo.ngay_dich_vu),
    ngay_ket_thuc: formatDateVN(hoSo.ngay_ket_thuc),
    so_ngay_cong_tac: hoSo.so_ngay_cong_tac != null ? String(hoSo.so_ngay_cong_tac) : '',
    don_gia_ngay: money(hoSo.don_gia_ngay),
    so_tien_chi_tra: money(hoSo.so_tien_chi_tra),
    thue_nop: money(hoSo.thue_nop),
    chi_tra: money(hoSo.chi_tra),
  }
}

/** Tên file hiển thị khi tải xuống, dạng "yyyymmdd_HDV Họ tên dd.ddTm.docx" (yyyymmdd/dd.dd/T lấy theo
 *  ngày đi-về của đoàn). Khác với storage key nội bộ (đã bỏ dấu) — tên này chỉ dùng cho Content-Disposition. */
export function buildContractFileName(doan: Doan, hoSo: HoSoWithNhanSu): string {
  const [y, m, d] = doan.ngay_di.split('-')
  const ngayVeDD = doan.ngay_ve ? doan.ngay_ve.split('-')[2] : d
  const thang = String(Number(m))
  return `${y}${m}${d}_${hoSo.nhansu.prefix} ${hoSo.nhansu.ho_ten} ${d}.${ngayVeDD}T${thang}.docx`
}

/** Merge dữ liệu vào template .docx (placeholder dạng {{ten_truong}}), trả về buffer file kết quả. */
export function mergeDocxTemplate(templateBytes: Buffer, data: Record<string, string>): Buffer {
  const zip = new PizZip(templateBytes)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })
  doc.render(data)
  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
}
