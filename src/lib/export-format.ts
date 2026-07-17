import type { Doan, HoSoWithNhanSu } from '@/types'
import { formatDateVN } from '@/lib/format'

/**
 * Xuất tab-separated đúng 29 cột của sheet "DS HDV T1-T12" trong
 * HNS DOCS/01. DS HDV TONG HOP T1-T12.2026.xlsx — dán thẳng vào Excel gốc.
 * Lưu ý: cột "TỈNH" chưa có field riêng trong schema (chỉ có địa chỉ đầy đủ),
 * để trống — kế toán bổ sung tay nếu cần sau khi dán.
 */
export function buildDsHdvRows(doan: Doan, rows: HoSoWithNhanSu[]): string {
  const thang = `Tháng ${Number(doan.ngay_di.split('-')[1])}`
  const lines = rows.map((r, i) => {
    const n = r.nhansu
    const cols = [
      '', // Ngày
      String(i + 1), // STT
      String(i + 1), // Mã số
      doan.ten_doan, // Đoàn
      '', // Tên Đoàn
      doan.hanh_trinh ?? '', // Hành trình
      formatDateVN(r.ngay_dich_vu), // Ngày dịch vụ
      n.ho_ten, // HỌ VÀ TÊN
      n.sdt ?? '', // Điện thoại
      formatDateVN(n.ngay_sinh), // NGÀY SINH
      n.so_the_hdv ?? '', // SỐ THẺ
      n.loai_the_hdv ?? '', // LOẠI THẺ
      formatDateVN(n.han_the_hdv), // HẠN THẺ
      '', // CMT
      n.so_cccd ?? '', // SỐ CCCD/HC
      formatDateVN(n.ngay_cap), // NGÀY CẤP
      n.ma_so_thue_tncn ?? '', // MS Thuế TNCN
      n.noi_cap ?? '', // NƠI CẤP
      n.dia_chi ?? '', // ĐỊA CHỈ
      '', // TỈNH
      doan.sl_khach != null ? String(doan.sl_khach) : '', // SL khách
      r.so_ngay_cong_tac != null ? String(r.so_ngay_cong_tac) : '', // Ngày (số ngày công tác)
      r.don_gia_ngay != null ? String(r.don_gia_ngay) : '', // CTP/ ngày
      r.so_tien_chi_tra != null ? String(r.so_tien_chi_tra) : '', // SỐ TIỀN CHI TRẢ
      r.thue_nop != null ? String(r.thue_nop) : '', // Thuế nộp
      r.chi_tra != null ? String(r.chi_tra) : '', // Chi trả
      thang, // Tháng
      formatDateVN(r.ngay_duyet), // Ngày duyệt
      r.nhap_misa ? 'x' : '', // Nhập Misa
    ]
    return cols.join('\t')
  })
  return lines.join('\n')
}

/**
 * Xuất tab-separated đúng 4 cột của sheet "Theo dõi hợp đồng" trong cùng file Excel.
 */
export function buildTheoDoiHopDongRows(doan: Doan, rows: HoSoWithNhanSu[]): string {
  const lines = rows.map((r) => {
    const cols = [
      doan.ten_doan,
      r.nhansu.ho_ten,
      r.loai_hop_dong ?? '',
      r.tinh_trang_thanh_toan ?? '',
    ]
    return cols.join('\t')
  })
  return lines.join('\n')
}
