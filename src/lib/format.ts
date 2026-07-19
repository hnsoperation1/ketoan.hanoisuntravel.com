/** yyyy-mm-dd (Postgres date) -> dd/mm/yyyy (định dạng Excel HNS đang dùng) */
export function formatDateVN(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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
