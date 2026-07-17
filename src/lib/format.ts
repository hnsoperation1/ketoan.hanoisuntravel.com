/** yyyy-mm-dd (Postgres date) -> dd/mm/yyyy (định dạng Excel HNS đang dùng) */
export function formatDateVN(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}
