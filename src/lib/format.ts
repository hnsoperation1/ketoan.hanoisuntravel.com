/** yyyy-mm-dd (Postgres date) -> dd/mm/yyyy (định dạng Excel HNS đang dùng) */
export function formatDateVN(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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
