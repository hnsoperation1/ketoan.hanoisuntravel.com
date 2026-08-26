// Chuẩn hoá 1 lô công nợ NCC "nguyên xi" (ve_debt_records_raw — mỗi NCC 1 bộ
// cột khác nhau, giữ đúng như file gốc) về ĐÚNG bộ trường của bảng Tổng hợp
// (ve_debt_records). Đây là bước "biến đổi" mà wizard nhập file cố tình
// KHÔNG làm (xem submitRaw ở tong-hop-cong-no-ncc/page.tsx) — tách hẳn ra
// đây để nhập lúc nào cũng được, sau khi kế toán đã đối chiếu xong.
//
// Ánh xạ cột bám theo ĐÚNG bộ "cột mặc định hiển thị" của từng NCC đã chốt
// trước đó (xem DEFAULT_VISIBLE_HEADERS trong raw-shared.tsx) — tức là đúng
// những cột kế toán coi là có nghĩa, không phải đoán bừa.

import { findIdColumnIndex } from './raw-column-roles'

export type SummaryImportRow = {
  ticket_no: string | null
  pax_name: string | null
  issued_date: string | null
  payment_date: string | null
  departure_date: string | null
  return_date: string | null
  routing: string | null
  gia_mua: number | null
  gia_ban: number | null
  ma_khach: string | null
  tkt_tag: string | null
}

// So khớp tên cột không phân biệt hoa/thường/dấu/khoảng trắng/dấu câu —
// cùng quy ước với normalizeHeader ở raw-shared.tsx (file NCC viết tên cột
// mỗi lần một khác chút).
function norm(s: string | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Tên cột (đã chuẩn hoá) cho từng trường, theo từng NCC. Mảng = thử lần
// lượt, khớp cái nào trước lấy cái đó.
type FieldMap = Partial<Record<keyof Omit<SummaryImportRow, 'ma_khach' | 'tkt_tag' | 'gia_ban'>, string[]>>

const NCC_FIELD_MAP: Record<string, FieldMap> = {
  'FCVN': {
    ticket_no: ['ticketnbr'],
    pax_name: ['paxname'],
    issued_date: ['issuedate'],
    routing: ['route'],
    // gia_mua: FCVN dùng cột KHÔNG CÓ TÊN ở vị trí 19 (xem
    // FCVN_NET_AMT_VND_INDEX) — xử lý riêng bên dưới, không khớp theo tên.
  },
  'SAO ĐỎ': {
    ticket_no: ['codesove'],
    pax_name: ['tenkhach'],
    issued_date: ['ngayxv'],
    departure_date: ['ngaydi'],
    return_date: ['ngayve'],
    routing: ['hanhtrinh'],
    gia_mua: ['thanhtien'],
  },
  'VIETJET': {
    ticket_no: ['pnr'],
    pax_name: ['paxname'],
    payment_date: ['paymentdate'],
    routing: ['segments'],
    gia_mua: ['amountconvertvnd'],
  },
  'SUN PQC': {
    ticket_no: ['sove'],
    pax_name: ['tenkhach'],
    departure_date: ['ngaybay'],
    routing: ['hanhtrinh'],
    gia_mua: ['tongtien'],
  },
}

// Cột "Net Amt VND" của FCVN không có tiêu đề trong file gốc nên phải chỉ
// đích danh theo VỊ TRÍ (trùng hằng số cùng tên ở raw-shared.tsx).
const FCVN_NET_AMT_VND_INDEX = 19

function findByNames(headers: string[], names: string[] | undefined): number | null {
  if (!names) return null
  const normalized = headers.map(norm)
  for (const name of names) {
    const i = normalized.indexOf(name)
    if (i >= 0) return i
  }
  return null
}

// Số tiền trong file NCC là chuỗi thô, mỗi nơi 1 kiểu: "4,578,362" (phẩy
// ngăn nghìn), "4.578.362" (chấm ngăn nghìn), "1548000" (trơn). Bỏ hết dấu
// ngăn cách rồi mới đọc số — KHÔNG coi dấu chấm/phẩy là phần thập phân vì
// công nợ vé máy bay luôn là số nguyên đồng.
function parseTien(raw: string | undefined): number | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const cleaned = s.replace(/[^\d-]/g, '')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function cell(row: string[], idx: number | null): string | null {
  if (idx == null) return null
  return row[idx]?.trim() || null
}

// FCVN nhồi NHIỀU ngày vào chung 1 ô "Issue date", ngăn bằng dấu gạch:
//     "ngày xuất vé - ngày bay 1 - ngày bay 2 - ... - ngày bay n"
// Ví dụ thật: "18/08/2026 - 19/08/2026 - 21/08/2026" (xuất 18, bay đi 19,
// bay về 21) hoặc "18/08/2026 - -" (mới xuất, chưa có chặng bay nào).
// Tách ra 3 trường riêng của bảng Tổng hợp: ngày xuất / ngày đi / ngày về.
//
// Ngày trong file viết dd/mm/yyyy (dấu gạch CHÉO) nên cắt theo dấu gạch
// NGANG không đụng vào bản thân ngày.
//
// Chỉ có ĐÚNG 1 ngày bay (vé 1 chiều) → để trống ngày về, KHÔNG lấy luôn
// ngày đi làm ngày về: 2 thứ đó khác nghĩa hẳn nhau, mà file gốc vẫn ghi rõ
// vé khứ hồi bay về đúng ngày đi thành 2 ngày giống nhau ("19/08 - 19/08"),
// nên điền đại sẽ xoá mất sự phân biệt đó.
function splitFcvnDates(raw: string | null): {
  issued: string | null
  departure: string | null
  ret: string | null
} {
  if (!raw) return { issued: null, departure: null, ret: null }
  const parts = raw.split('-').map(s => s.trim()).filter(s => s !== '')
  const [issued, ...flights] = parts
  return {
    issued: issued || null,
    departure: flights[0] ?? null,
    ret: flights.length >= 2 ? flights[flights.length - 1] : null,
  }
}

export type RawMatchLite = {
  row_index: number
  ma_khach: string | null
  gia_ban: number | null
  tkt_tag: string | null
}

// Chuyển cả lô sang bộ trường bảng Tổng hợp. Mã khách/giá bán/TKT KHÔNG lấy
// từ file gốc mà lấy từ phần kế toán tự gán ở màn "Đầu vào công nợ NCC"
// (bảng sidecar ve_debt_records_raw_match).
export function mapRawBatchToSummary(
  ncc: string,
  headers: string[],
  rows: string[][],
  matches: RawMatchLite[],
): SummaryImportRow[] {
  const map = NCC_FIELD_MAP[ncc.trim().toUpperCase()] ?? {}
  const idx = {
    // NCC lạ (chưa có trong bảng ánh xạ) vẫn lấy được mã vé/PNR nhờ bộ dò
    // cột dùng chung — còn hơn bỏ trống hoàn toàn.
    ticket_no: findByNames(headers, map.ticket_no) ?? findIdColumnIndex(headers),
    pax_name: findByNames(headers, map.pax_name),
    issued_date: findByNames(headers, map.issued_date),
    payment_date: findByNames(headers, map.payment_date),
    departure_date: findByNames(headers, map.departure_date),
    return_date: findByNames(headers, map.return_date),
    routing: findByNames(headers, map.routing),
    gia_mua: ncc.trim().toUpperCase() === 'FCVN'
      ? FCVN_NET_AMT_VND_INDEX
      : findByNames(headers, map.gia_mua),
  }

  const matchByRow = new Map(matches.map(m => [m.row_index, m]))
  const isFcvn = ncc.trim().toUpperCase() === 'FCVN'

  return rows.map((row, i) => {
    const m = matchByRow.get(i)
    // FCVN: 1 ô "Issue date" chứa cả ngày xuất lẫn các ngày bay — tách ra
    // (xem splitFcvnDates). NCC khác đã có sẵn cột ngày đi/về riêng.
    const fcvnDates = isFcvn ? splitFcvnDates(cell(row, idx.issued_date)) : null
    return {
      ticket_no: cell(row, idx.ticket_no),
      pax_name: cell(row, idx.pax_name),
      issued_date: fcvnDates ? fcvnDates.issued : cell(row, idx.issued_date),
      payment_date: cell(row, idx.payment_date),
      departure_date: fcvnDates ? fcvnDates.departure : cell(row, idx.departure_date),
      return_date: fcvnDates ? fcvnDates.ret : cell(row, idx.return_date),
      routing: cell(row, idx.routing),
      gia_mua: parseTien(cell(row, idx.gia_mua) ?? undefined),
      gia_ban: m?.gia_ban ?? null,
      ma_khach: m?.ma_khach ?? null,
      tkt_tag: m?.tkt_tag ?? null,
    }
  })
}
