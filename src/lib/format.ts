/** yyyy-mm-dd (Postgres date) -> dd/mm/yyyy (định dạng Excel HNS đang dùng) */
export function formatDateVN(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

/** yyyy-mm-dd -> "ngày dd tháng mm năm yyyy" (dạng chữ đầy đủ dùng trong văn bản hợp đồng) */
export function formatDateVNFull(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `ngày ${d} tháng ${m} năm ${y}`
}

/** Suy ra Tỉnh/Thành phố từ địa chỉ đầy đủ — luôn là phần cuối cùng sau dấu phẩy
 *  trong địa chỉ kiểu Việt Nam (vd "Thanh Lâm, An Thịnh, Lương Tài, Bắc Ninh" -> "Bắc Ninh"). */
export function deriveTinhTp(diaChi: string | null | undefined): string {
  if (!diaChi) return ''
  const parts = diaChi
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : ''
}

const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const DON_VI_NHOM = ['', 'nghìn', 'triệu', 'tỷ']

/** Đọc 1 nhóm 3 chữ số (0-999) thành chữ — "coTruoc" = có nhóm/chữ số cao
 *  hơn đứng trước hay không (quyết định có cần "không trăm"/"lẻ" hay không,
 *  vd 1.005 -> "một nghìn không trăm lẻ năm" chứ không phải "một nghìn năm"). */
function docNhomBaChuSo(so: number, coTruoc: boolean): string {
  const tram = Math.floor(so / 100)
  const chuc = Math.floor((so % 100) / 10)
  const donvi = so % 10
  let ketQua = ''

  if (tram > 0) ketQua += `${CHU_SO[tram]} trăm `
  else if (coTruoc) ketQua += 'không trăm '

  if (chuc === 0 && donvi > 0 && (tram > 0 || coTruoc)) ketQua += 'lẻ '
  else if (chuc === 1) ketQua += 'mười '
  else if (chuc > 1) ketQua += `${CHU_SO[chuc]} mươi `

  if (donvi === 1 && chuc > 1) ketQua += 'mốt'
  else if (donvi === 5 && chuc > 0) ketQua += 'lăm'
  else if (donvi > 0) ketQua += CHU_SO[donvi]

  return ketQua.trim()
}

/** Số tiền (VND, số nguyên) -> chữ tiếng Việt dùng trong hợp đồng, vd
 *  5000000 -> "Năm triệu đồng". Dùng cho placeholder {{..._bang_chu}} —
 *  xem buildMergeData trong lib/docx-merge.ts. */
export function soTienBangChu(n: number | null | undefined): string {
  if (n == null) return ''
  if (n === 0) return 'Không đồng'
  const amNganh = n < 0
  let so = Math.round(Math.abs(n))

  const nhom: number[] = []
  while (so > 0) {
    nhom.unshift(so % 1000)
    so = Math.floor(so / 1000)
  }

  const parts: string[] = []
  let coTruoc = false
  for (let i = 0; i < nhom.length; i++) {
    const g = nhom[i]
    if (g === 0) continue // bỏ hẳn nhóm 0 ở giữa (quy ước phổ biến trong văn bản kế toán)
    const donViNhom = DON_VI_NHOM[nhom.length - 1 - i] ?? ''
    const words = docNhomBaChuSo(g, coTruoc)
    parts.push(donViNhom ? `${words} ${donViNhom}` : words)
    coTruoc = true
  }

  const câu = parts.join(' ').replace(/\s+/g, ' ').trim()
  const viet = câu.charAt(0).toUpperCase() + câu.slice(1)
  return `${amNganh ? 'Âm ' : ''}${viet} đồng`
}

/** Bỏ dấu tiếng Việt + ký tự không an toàn — dùng làm storage key (Supabase Storage
 *  không nhận Unicode có dấu trong path). Tên hiển thị gốc (có dấu) vẫn lưu riêng ở DB. */
export function slugifyFileName(name: string): string {
  const noDiacritics = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd') // đ
    .replace(/Đ/g, 'D') // Đ
  return noDiacritics.replace(/[^a-zA-Z0-9._-]/g, '_')
}
