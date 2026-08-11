export const TNCN_RATE = 0.1

// Nghị định 253/2026/NĐ-CP, Điều 50 khoản 2 (hiệu lực 01/7/2026, thay NĐ
// 65/2013): khấu trừ 10% TNCN chỉ bắt buộc khi mức chi trả TỪNG LẦN đạt từ
// 5 triệu đồng trở lên (trước đây ngưỡng cũ là 2 triệu). Dưới ngưỡng này
// thì chi trả đủ 100%, không khấu trừ gì. Ngưỡng tính theo TỪNG hồ sơ
// (từng lần chi trả), KHÔNG cộng dồn nhiều hồ sơ/nhiều đoàn trong năm.
export const NGUONG_KHONG_KHAU_TRU_TNCN = 5_000_000

/** thuế nộp = 10% số tiền chi trả (chỉ khi >= ngưỡng), chi trả (thực nhận) = phần còn lại — khớp file Excel gốc HNS + NĐ 253/2026 */
export function tinhThueVaChiTra(soTienChiTra: number) {
  if (soTienChiTra < NGUONG_KHONG_KHAU_TRU_TNCN) {
    return { thueNop: 0, chiTra: soTienChiTra }
  }
  const thueNop = Math.round(soTienChiTra * TNCN_RATE)
  const chiTra = soTienChiTra - thueNop
  return { thueNop, chiTra }
}

// Chiều ngược lại: kế toán gõ mức THỰC NHẬN mong muốn (net, vd 800k/ngày,
// số cố định thoả thuận với HDV) — hàm này tính ra số tiền GROSS cần ghi
// vào so_tien_chi_tra để sau khi tinhThueVaChiTra() ở trên xử lý xong,
// thực nhận cuối cùng khớp đúng mức đã cam kết. Dưới ngưỡng: gross = net
// (không khấu trừ nên không cần thổi lên). Từ ngưỡng trở lên: gross =
// net / (1 - 10%), làm tròn LÊN để thực nhận không bao giờ thấp hơn mức
// đã cam kết (chấp nhận lệch vài đồng có lợi cho người lao động thay vì
// công ty).
export function tinhGrossTuNet(netMongMuon: number): number {
  if (netMongMuon < NGUONG_KHONG_KHAU_TRU_TNCN) return netMongMuon
  return Math.ceil(netMongMuon / (1 - TNCN_RATE))
}
