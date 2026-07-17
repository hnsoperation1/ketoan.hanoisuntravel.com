export const TNCN_RATE = 0.1

/** thuế nộp = 10% số tiền chi trả, chi trả (thực nhận) = 90% — khớp file Excel gốc HNS */
export function tinhThueVaChiTra(soTienChiTra: number) {
  const thueNop = Math.round(soTienChiTra * TNCN_RATE)
  const chiTra = soTienChiTra - thueNop
  return { thueNop, chiTra }
}
