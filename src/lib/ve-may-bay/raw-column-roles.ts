const COMBINING_MARKS_RE = /[̀-ͯ]/g

function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Ưu tiên mã vé/số vé (định danh 1 pax/1 chặng, chắc chắn nhất) trước PNR
// (có thể dùng chung cho nhiều pax trên cùng 1 booking) — chỉ dùng PNR khi
// NCC đó không có cột số vé riêng (vd VIETJET).
const ID_KEYWORD_TIERS: string[][] = [
  ['ticket nbr', 'ticket no', 'ticket number', 'so ve', 'ma ve', 'code/so ve'],
  ['pnr', 'ma dat cho', 'receipt nbr'],
]

const PAX_KEYWORDS: string[] = ['pax name', 'ten khach']

function findColumnIndex(headers: string[], keywordTiers: string[][]): number | null {
  const normalized = headers.map(normalizeHeader)
  for (const tier of keywordTiers) {
    for (let i = 0; i < normalized.length; i++) {
      if (tier.some(kw => normalized[i].includes(kw))) return i
    }
  }
  return null
}

export function findIdColumnIndex(headers: string[]): number | null {
  return findColumnIndex(headers, ID_KEYWORD_TIERS)
}

export function findPaxColumnIndex(headers: string[]): number | null {
  return findColumnIndex(headers, [PAX_KEYWORDS])
}
