import type { Doan, HoSoWithNhanSu } from '@/types'
import { formatDateVN } from '@/lib/format'

/** Ép Excel giữ nguyên dạng text khi dán (không tự suy ra số/ngày rồi làm mất
 *  số 0 đầu — vd "033192000220" -> 33192000220, "12/09/2030" -> "12/9/2030").
 *  Dấu ' đứng đầu là quy ước chuẩn Excel hiểu ngay cả khi dán từ clipboard. */
function textCell(v: string): string {
  return v ? `'${v}` : ''
}

/**
 * Xuất tab-separated đúng 23 cột (từ cột "Đoàn" trở đi) của sheet "DS HDV T1-T12"
 * trong HNS DOCS/01. DS HDV TONG HOP T1-T12.2026.xlsx — dán bắt đầu từ cột Đoàn,
 * KHÔNG kèm 3 cột Ngày/STT/Mã số phía trước (kế toán tự quản theo công thức riêng
 * của họ, không muốn bị ghi đè khi dán).
 * Cột "Đoàn" chỉ dán tạm tên đoàn (doan.ten_doan) — kế toán tự sửa tay thành dạng
 * rút gọn quen dùng (vd "Cty Trung Kiên - Sầm Sơn 19.21T7") sau khi dán.
 * Không có 3 cột Tên Đoàn/Hành trình/Ngày dịch vụ (đã gộp hết vào cột Đoàn theo
 * quy ước cũ) — 3 field này chỉ dùng nội bộ app để xuất hợp đồng (ngày dịch vụ
 * thực chất là ngày đi/về của đoàn), không còn nằm trong file Excel tổng hợp.
 */
export function buildDsHdvRows(doan: Doan, rows: HoSoWithNhanSu[]): string {
  const thang = `Tháng ${Number(doan.ngay_di.split('-')[1])}`
  const lines = rows.map((r) => {
    const n = r.nhansu
    const cols = [
      doan.ten_doan, // Đoàn
      n.ho_ten, // HỌ VÀ TÊN
      textCell(n.sdt ?? ''), // Điện thoại
      textCell(formatDateVN(n.ngay_sinh)), // NGÀY SINH
      textCell(n.so_the_hdv ?? ''), // SỐ THẺ
      n.loai_the_hdv ?? '', // LOẠI THẺ
      textCell(formatDateVN(n.han_the_hdv)), // HẠN THẺ
      '', // CMT
      textCell(n.so_cccd ?? ''), // SỐ CCCD/HC
      textCell(formatDateVN(n.ngay_cap)), // NGÀY CẤP
      textCell(n.ma_so_thue_tncn ?? ''), // MS Thuế TNCN
      n.noi_cap ?? '', // NƠI CẤP
      n.dia_chi ?? '', // ĐỊA CHỈ
      n.tinh_tp ?? '', // TỈNH
      doan.sl_khach != null ? String(doan.sl_khach) : '', // SL khách
      r.so_ngay_cong_tac != null ? String(r.so_ngay_cong_tac) : '', // Ngày (số ngày công tác)
      r.don_gia_ngay != null ? String(r.don_gia_ngay) : '', // CTP/ ngày
      r.so_tien_chi_tra != null ? String(r.so_tien_chi_tra) : '', // SỐ TIỀN CHI TRẢ
      r.thue_nop != null ? String(r.thue_nop) : '', // Thuế nộp
      r.chi_tra != null ? String(r.chi_tra) : '', // Chi trả
      thang, // Tháng
      textCell(formatDateVN(r.ngay_duyet)), // Ngày duyệt
      r.nhap_misa ? 'x' : '', // Nhập Misa
    ]
    return cols.join('\t')
  })
  return lines.join('\n')
}
