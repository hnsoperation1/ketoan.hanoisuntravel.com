// Tô sáng phần nguyên văn tin nhắn Telegram TRÙNG với dòng công nợ đang
// chọn (mã vé/PNR + tên khách) — tin nhắn vé đoàn dài hàng chục dòng, dò
// mắt rất mệt, tô sẵn để nhìn phát thấy ngay dòng nào của mình.
//
// So khớp "mềm" chứ không so chuỗi thô: bỏ dấu tiếng Việt, viết hoa, bỏ mọi
// ký tự không phải chữ/số. Nhờ vậy các cách viết khác nhau của CÙNG 1 dữ
// liệu vẫn khớp:
//   "738-2323879322/ETVN/..."  ↔  mã vé "7382323879322" (dấu gạch/gạch chéo)
//   "BUI, HONG TUYEN"          ↔  pax  "BUI/HONG TUYEN MR" (dấu phân cách + hậu tố)
//   "Nguyen Son Lam"           ↔  pax  "NGUYEN, SON LAM"  (hoa/thường)

// Ánh xạ ngược về vị trí GỐC: map[i] = chỉ số trong chuỗi ban đầu của ký tự
// thứ i sau chuẩn hoá. Cần map vì phải tô đúng đoạn văn bản GỐC (kể cả dấu
// gạch/phẩy nằm chen giữa) chứ không phải chuỗi đã chuẩn hoá.
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  const norm: string[] = []
  const map: number[] = []
  for (let i = 0; i < s.length; i++) {
    const raw = s[i]
    // NFD tách nguyên âm có dấu thành chữ gốc + dấu tổ hợp; dấu tổ hợp tự
    // bị loại ở bộ lọc A-Z/0-9 ngay bên dưới nên không cần xoá riêng. Chỉ
    // đ/Đ phải quy đổi tay vì NFD KHÔNG tách được (là 1 chữ cái độc lập).
    const folded = raw === 'đ' || raw === 'Đ' ? 'D' : raw.normalize('NFD').toUpperCase()
    for (const c of folded) {
      if (c >= 'A' && c <= 'Z') { norm.push(c); map.push(i) }
      else if (c >= '0' && c <= '9') { norm.push(c); map.push(i) }
    }
  }
  return { norm: norm.join(''), map }
}

// Hậu tố/tiền tố loại khách trong tên pax của file NCC ("BUI/HONG TUYEN MR",
// "... CHD") — bỏ đi trước khi so khớp vì tin nhắn Telegram thường không có.
const PAX_TITLE_RE = /\b(?:MR|MRS|MS|MSTR|MISS|CHD|CHILD|INF|INFANT|ADT)\b\.?/gi

// Chuỗi ngắn quá sẽ khớp lung tung khắp tin nhắn (vd 2-3 ký tự) — chỉ tô
// những từ khoá đủ dài để chắc chắn là đúng dữ liệu cần tìm.
const MIN_TERM_LEN = 4

// Ráp danh sách từ khoá cần tô từ NHÃN của dòng đang chọn: mã vé/PNR và tên
// khách. Vé đoàn FCVN gộp nhiều pax vào 1 ô nối bằng "+" nên tách ra thành
// nhiều từ khoá riêng. Nhãn rỗng/placeholder ("—", "Không có...") bị loại.
export function buildMatchTerms(ticketLabel?: string | null, paxLabel?: string | null): string[] {
  const terms: string[] = []
  const push = (raw: string) => {
    const cleaned = raw.replace(PAX_TITLE_RE, ' ').trim()
    if (!cleaned || cleaned === '—') return
    if (normalizeWithMap(cleaned).norm.length < MIN_TERM_LEN) return
    terms.push(cleaned)
  }
  if (ticketLabel && !ticketLabel.startsWith('Không có')) push(ticketLabel)
  if (paxLabel) for (const part of paxLabel.split('+')) push(part)
  return terms
}

// Các đoạn [đầu, cuối) trong chuỗi GỐC cần tô — đã gộp các đoạn chồng nhau
// (vd mã vé nằm lọt trong đoạn tên khách) để không lồng thẻ <mark> vào nhau.
function buildRanges(text: string, terms: string[]): Array<[number, number]> {
  const { norm, map } = normalizeWithMap(text)
  const ranges: Array<[number, number]> = []
  for (const term of terms) {
    const t = normalizeWithMap(term).norm
    if (t.length < MIN_TERM_LEN) continue
    let from = 0
    for (;;) {
      const idx = norm.indexOf(t, from)
      if (idx < 0) break
      ranges.push([map[idx], map[idx + t.length - 1] + 1])
      from = idx + t.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

// Vàng hổ phách — cùng màu với dòng đang chọn ở bảng chính (bg-amber-50),
// để mắt hiểu ngay "chỗ vàng bên này chính là dòng vàng bên kia".
export function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>
  const ranges = buildRanges(text, terms)
  if (ranges.length === 0) return <>{text}</>

  const out: React.ReactNode[] = []
  let pos = 0
  ranges.forEach(([start, end], i) => {
    if (start > pos) out.push(text.slice(pos, start))
    out.push(
      <mark key={i} className="bg-amber-200 text-gray-900 rounded-sm px-0.5 font-semibold">
        {text.slice(start, end)}
      </mark>,
    )
    pos = end
  })
  if (pos < text.length) out.push(text.slice(pos))
  return <>{out}</>
}
