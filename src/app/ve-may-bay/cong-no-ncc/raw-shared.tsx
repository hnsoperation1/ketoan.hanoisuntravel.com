'use client'

// Phần dùng CHUNG giữa 2 biến thể giao diện của màn "Đầu vào công nợ NCC":
//   - v1 (./page.tsx): panel tin nhắn Telegram nằm cố định bên trái + bảng
//     hành khách của tin nhắn đang chọn nằm trên bảng lô công nợ.
//   - v2 (../cong-no-ncc-v2/page.tsx): chỉ có bảng lô công nợ chiếm trọn màn,
//     bấm mã vé/PNR mới mở slide-over đè lên (MatchSlideOver).
// Toàn bộ phần đọc file Excel/CSV, bảng lô công nợ (RawTableCard), thanh tab
// "sheet" theo từng lần tải (RawBatchesView) và các ô sửa giá đều giống hệt
// nhau ở cả 2 — tách ra đây để sửa 1 lần là cả 2 màn cùng đổi, thay vì chép
// đôi ~1200 dòng rồi phải nhớ sửa song song.

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Maximize2, Minimize2, Pencil, Menu, MessageSquareText, MessageSquareOff, Settings } from 'lucide-react'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useUserPreference } from '@/hooks/useUserPreference'
import { type MatchStatus, MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import { findIdColumnIndex, findPaxColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'

export function formatGiaVe(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN')
}

// Nhận diện ô raw NCC là số THUẦN (vd "899000", "-1932000") để tách hàng
// nghìn + căn phải khi hiện — file gốc NCC không tách hàng nghìn/không có
// dấu gì khác nên chỉ cần regex đơn giản, không cần biết cột nào là "giá"
// (raw không có schema cột cố định, xem raw-column-roles.ts).
export function parseRawNumericCell(v: string | undefined): number | null {
  const s = v?.trim()
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

// Bỏ hết ký tự không phải số (dấu phẩy ngăn cách nghìn, ký hiệu tiền tệ,
// khoảng trắng...). Nhận cả 2 kiểu số âm: dấu "-" đứng trước, hoặc dạng kế
// toán để trong ngoặc đơn "(1,234,000)" (gặp ở dòng hoàn/huỷ vé FCVN).
//
// LƯU Ý QUAN TRỌNG (bug thật đã sửa 2026-08-04): 1 số file NCC (FCVN) ghi
// số tiền có đuôi thập phân giả "1,538,181.0" dù VND không có phần lẻ —
// nếu chỉ xoá mọi ký tự không phải chữ số như bản cũ thì dấu "." biến mất
// nhưng chữ số "0" sau nó VẪN CÒN, nối vào cuối số nguyên → nhân số tiền
// lên gấp 10 lần một cách âm thầm. Phải cắt bỏ hẳn phần sau dấu "." (nếu
// có) TRƯỚC khi xoá ký tự, không chỉ đơn thuần lọc ký tự.
export function parseVndNumber(raw: string): number | null {
  let s = String(raw ?? '').trim()
  if (!s) return null
  const negative = /^\(.*\)$/.test(s) || s.trimStart().startsWith('-')
  s = s.replace(/[()]/g, '')
  const dotIdx = s.lastIndexOf('.')
  if (dotIdx !== -1) s = s.slice(0, dotIdx)
  const cleaned = s.replace(/[^\d]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return negative ? -n : n
}

// Bản dành riêng cho bảng raw (4 tab NCC) — CHỈ tách xuống dòng thuần tuý,
// KHÔNG bỏ đoạn nào (kể cả đoạn "N PAX..."/"N PAX ADT.NN" đầu, hay dấu ":"
// cuối). Đã gặp 2 định dạng ngăn cách thực tế ở file FCVN: "+" (vd "5 PAX
// ADT.05 + Tên A + Tên B...") và ";" (vd "4 PAX: Tên A; Tên B...") — ưu
// tiên ";" nếu có, không thì mới tới "+".
export function splitPaxLinesForDisplay(paxName: string | null): string[] {
  const s = (paxName ?? '').trim()
  if (!/^\d+\s*PAX\b/i.test(s)) return [paxName ?? '']
  const sep = s.includes(';') ? ';' : '+'
  const lines = s.split(sep).map(seg => seg.trim()).filter(Boolean)
  return lines.length > 0 ? lines : [paxName ?? '']
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsvGrid(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim() !== '').map(parseCsvLine)
}

// Cell Excel có thể là chuỗi thô, Date, hoặc object (formula {result},
// rich text {richText: [...]})  — quy hết về text hiển thị được.
export function cellToText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleDateString('vi-VN')
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text: string }>).map(t => t.text).join('')
    }
    if ('result' in o) return cellToText(o.result)
    return ''
  }
  return String(v)
}

export type SheetData = { name: string; grid: string[][] }

export function gridFromWorksheet(ws: import('exceljs').Worksheet): string[][] {
  const grid: string[][] = []
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const vals: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      vals[colNumber - 1] = cellToText(cell.value)
    })
    grid[rowNumber - 1] = vals
  })
  return grid
}

// Đọc TOÀN BỘ workbook — nhiều sheet (mỗi NCC 1 sheet là chuyện thường
// gặp, xem file mẫu thật user gửi có tới 8 sheet) — trả về tất cả để user
// chọn tay sheet nào cần import, không tự ý chỉ lấy sheet đầu tiên.
// Không giả định dòng nào là tiêu đề trong mỗi sheet — nhiều file công nợ
// thật có mấy dòng thông tin công ty/ngày tháng phía trên, tiêu đề thật
// nằm sâu bên dưới (dòng 7, dòng 12...), không phải luôn ở dòng 1.
export async function parseXlsxSheets(file: File): Promise<SheetData[]> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  return wb.worksheets.map(ws => ({ name: ws.name, grid: gridFromWorksheet(ws) }))
}

// exceljs không đọc được 1 số file .xlsx export từ hệ thống của NCC (đối
// chiếu thật với file "CNO VIETJET 1.3T8.xlsx") — file này vẫn là OOXML
// hợp lệ (đúng chuẩn zip, "Microsoft Excel 2007+") nhưng dùng namespace
// XML có TIỀN TỐ (`<x:worksheet xmlns:x="...">`) thay vì namespace mặc
// định — exceljs's parser tìm tag không đúng tên nên lỗi thẳng
// ("Cannot read properties of undefined (reading 'sheets')"). Đây là bộ
// đọc dự phòng: tự giải nén zip (jszip) + tự bóc XML (DOMParser có sẵn
// trên trình duyệt, không cần thêm lib) — so khớp theo `localName` của
// thẻ nên KHÔNG quan tâm tiền tố namespace là gì.
export function xmlLocalName(el: Element): string {
  return el.tagName.includes(':') ? el.tagName.split(':')[1] : el.tagName
}

export function xmlChildrenByLocalName(parent: Element | XMLDocument, name: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter(el => xmlLocalName(el) === name)
}

export function colRefToIdx(ref: string): number {
  const letters = ref.match(/^[A-Za-z]+/)?.[0] ?? ''
  let idx = 0
  for (const ch of letters.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx - 1
}

export async function parseXlsxSheetsFallback(file: File): Promise<SheetData[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const parser = new DOMParser()

  const ssEntry = zip.file('xl/sharedStrings.xml')
  const strings: string[] = []
  if (ssEntry) {
    const ssXml = parser.parseFromString(await ssEntry.async('text'), 'application/xml')
    for (const si of xmlChildrenByLocalName(ssXml, 'si')) {
      strings.push(xmlChildrenByLocalName(si, 't').map(t => t.textContent ?? '').join(''))
    }
  }

  const wbEntry = zip.file('xl/workbook.xml')
  const relsEntry = zip.file('xl/_rels/workbook.xml.rels')
  if (!wbEntry || !relsEntry) throw new Error('File .xlsx không đúng cấu trúc chuẩn')

  const wbXml = parser.parseFromString(await wbEntry.async('text'), 'application/xml')
  const relsXml = parser.parseFromString(await relsEntry.async('text'), 'application/xml')
  const relMap = new Map(
    xmlChildrenByLocalName(relsXml, 'Relationship').map(el => [el.getAttribute('Id'), el.getAttribute('Target')])
  )

  const sheets: SheetData[] = []
  for (const sheetEl of xmlChildrenByLocalName(wbXml, 'sheet')) {
    const name = sheetEl.getAttribute('name') || 'Sheet'
    const rId = sheetEl.getAttribute('r:id')
      ?? sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const target = rId ? relMap.get(rId) : null
    if (!target) continue
    const sheetPath = target.startsWith('/xl/') ? target.slice(1) : `xl/${target.replace(/^\.?\/?/, '')}`
    const sheetEntry = zip.file(sheetPath) ?? zip.file(target)
    if (!sheetEntry) continue

    const sheetXml = parser.parseFromString(await sheetEntry.async('text'), 'application/xml')
    const grid: string[][] = []
    for (const rowEl of xmlChildrenByLocalName(sheetXml, 'row')) {
      const rNum = parseInt(rowEl.getAttribute('r') ?? '0', 10)
      if (!rNum) continue
      const row: string[] = []
      for (const c of Array.from(rowEl.children).filter(el => xmlLocalName(el) === 'c')) {
        const ref = c.getAttribute('r') ?? ''
        const idx = colRefToIdx(ref)
        if (idx < 0) continue
        const type = c.getAttribute('t')
        const vEl = Array.from(c.children).find(el => xmlLocalName(el) === 'v')
        const isEl = Array.from(c.children).find(el => xmlLocalName(el) === 'is')
        if (type === 's' && vEl) row[idx] = strings[parseInt(vEl.textContent ?? '0', 10)] ?? ''
        else if (type === 'inlineStr' && isEl) row[idx] = isEl.textContent ?? ''
        else row[idx] = vEl?.textContent ?? ''
      }
      grid[rNum - 1] = row
    }
    sheets.push({ name, grid })
  }
  return sheets
}

export async function parseXlsxSheetsAny(file: File): Promise<SheetData[]> {
  try {
    return await parseXlsxSheets(file)
  } catch {
    return await parseXlsxSheetsFallback(file)
  }
}

// ── Nhận diện nhanh chữ ký Vietjet/FCVN để gợi ý sẵn tên NCC lúc chọn
// file, không tự tách/chuẩn hoá cột nữa (việc đó làm ở bước riêng sau).
export function findVietjetHeaderRow(grid: string[][]): number | null {
  const norm = (s: string) => (s || '').toLowerCase().trim()
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? []
    if (norm(row[0]) === 'pnr' && norm(row[1]).includes('pax name') &&
        norm(row[2]).includes('payment date') && norm(row[3]).includes('segments')) {
      return i
    }
  }
  return null
}

// Cột "SEGMENTS" trong file thô Vietjet gộp nhiều chặng dính liền nhau
// trong 1 ô, không có dấu phân cách rõ ràng — chỉ tách được nhờ mỗi chặng
// luôn bắt đầu bằng ngày dạng "Mon DD, YYYY". Dùng lookahead để cắt ngay
// trước mỗi lần ngày lặp lại, chỉ để HIỂN THỊ xuống dòng cho dễ đọc — dữ
// liệu lưu trong DB vẫn giữ nguyên xi, không đụng vào.
export function splitSegmentsForDisplay(value: string): string[] {
  return (value || '')
    .split(/(?=[A-Za-z]{3}\s\d{1,2},\s*\d{4})/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function findFcvnHeaderRow(grid: string[][]): number | null {
  const norm = (s: string) => (s || '').toLowerCase().trim()
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? []
    if (norm(row[0]) === 'order' && norm(row[1]).includes('receipt') &&
        norm(row[2]).includes('issue date') && norm(row[3]).includes('ticket')) {
      return i
    }
  }
  return null
}

// Dò dòng "rác" khi nhập nguyên xi (submitRaw, dùng chung cho cả 4 tab NCC)
// — dựa vào cột mã vé/PNR đã nhận diện được qua findIdColumnIndex
// (raw-column-roles.ts, đã dùng ổn cho cả 4 NCC ở tính năng khớp mã khách).
// Dòng dữ liệu thật luôn có mã vé/PNR đủ dài; dòng tiêu đề phụ lặp lại
// (mỗi ô chỉ có 1 chữ cái chú thích cột) hoặc dòng ngăn cách section (các
// ô khác đều trống) đều có ô này rỗng hoặc quá ngắn.
export function isLikelyJunkRow(row: string[], idColIdx: number | null): boolean {
  if (idColIdx == null) return false
  return (row[idColIdx] ?? '').trim().length < 4
}

// File .xls (nhị phân cũ, OLE2 — khác hẳn .xlsx là file zip) không đọc
// được bằng exceljs lẫn bộ dự phòng jszip+DOMParser ở trên (2 bộ đó chỉ
// đọc được .xlsx) — dùng `xlsx` (SheetJS) riêng cho .xls, thư viện này đọc
// được cả 2 định dạng nhưng chỉ dùng cho nhánh .xls để không đổi hành vi
// đang chạy ổn định của .xlsx/.csv.
export async function parseXlsFile(file: File): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map(name => ({
    name,
    grid: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' }),
  }))
}

// 4 NCC cố định (khớp yêu cầu 2026-08-13) — luôn hiện tab dù NCC đó chưa
// có dòng dữ liệu nào (khác cách cũ chỉ liệt kê NCC đã có sẵn trong rows).
export const NCC_TABS = ['FCVN', 'SAO ĐỎ', 'VIETJET', 'SUN PQC']

// Số dòng kẻ trống khi 1 tab NCC chưa có lô dữ liệu nào — chỉ để nhìn
// giống 1 file Excel trống, không mang ý nghĩa dữ liệu gì.
export const EMPTY_GRID_ROWS = 5

// Header gợi ý theo ĐÚNG cột thật của từng NCC — lấy trực tiếp từ dòng tiêu
// đề file mẫu thật "FILE VÉ GỬI QUỐC.xlsx" (sheet cùng tên NCC), hiện sẵn
// khi tab đó CHƯA có lô nào upload để nhìn giống hệt bảng thật thay vì
// lưới trống vô nghĩa. Ngay khi có lô đầu tiên upload lên, header thật lấy
// từ chính file đó sẽ thay thế, không còn dùng gợi ý này nữa.
export const NCC_HEADER_HINTS: Record<string, string[]> = {
  'FCVN': ['Order', 'Receipt Nbr.', 'Issue date', 'Ticket Nbr.', 'Pax Name', 'Route', 'T', 'Cust.', 'Curr', 'ROE', 'Fare', 'Tax', 'Charge', 'Vat', 'Sv.Fee', 'Penalty', 'ToTal AMT', 'Comm.', 'Net Amt', 'FB', 'Class', 'FLT Nbr.', 'Saler', 'Remark'],
  'VIETJET': ['PNR', 'PAX NAME', 'PAYMENT DATE', 'SEGMENTS', 'PAYMENT BY', 'TAKEN BY', 'ACCOUNT', 'AMOUNT CONVERT (VND)', 'CURRENCY', 'AMOUNT CONVERT (VND)', 'Payment Identifier'],
  'SAO ĐỎ': ['STT', 'NGAY XV', 'CODE/SO VE', 'TEN KHACH', 'HANH TRINH', 'NGAY DI', 'NGAY VE', 'Gia ve', 'Thue', 'Dich vu', 'CKTM', 'SL PAX', 'Ty gia', 'Thanh Tien', 'THANH TOAN', 'DƯ NỢ', 'GHI CHU'],
  'SUN PQC': ['STT', 'Loại giao dịch', 'Ngày giao dịch', 'Office ID', 'Loại chứng từ', 'Loại hành trình', 'Mã đặt chỗ (PNR)', 'Số vé', 'Tên khách', 'Hành trình', 'Hình thức thanh toán', 'Lý do phát hành', 'Ngày bay', 'Hãng vận chuyển', 'Số hiệu chuyến bay', 'Hạng vé', 'Loại khách', 'Giá vé', 'Phí hoàn vé', 'Phí xuất vé', 'Phí đổi', 'Phí phụ thu nhiên liệu', 'Phí quản trị hệ thống', 'Thuế suất', 'Thuế VAT', 'Phí sân bay', 'Phí soi chiếu', 'Thuế, phí khác', 'Tổng tiền', 'Loại tiền tệ', 'Người xuất vé'],
}
// Viền xanh lá đậm, góc vuông khi focus — giống ô đang nhập trong Excel
// thật (không phải nhẫn xanh dương bo tròn kiểu form web thông thường).
// ring-inset để viền nằm gọn trong ô, không đẩy layout xê dịch.
export const CELL_INPUT = 'w-full h-full bg-transparent text-xs px-1 py-0.5 rounded-none focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#107C41]'

// Hiện số có phân cách hàng nghìn (toLocaleString) khi không focus, đổi
// sang chuỗi số thô khi focus để gõ/dán tự nhiên — không thể vừa gõ vừa
// hiện dấu chấm phân cách bằng 1 giá trị input duy nhất.
export function EditableNumberCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value != null ? String(value) : '')
  const [focused, setFocused] = useState(false)
  useEffect(() => setV(value != null ? String(value) : ''), [value])
  return (
    <input value={focused ? v : (value != null ? value.toLocaleString('vi-VN') : '')}
      onFocus={() => setFocused(true)}
      onChange={e => setV(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const parsed = v.trim() === '' ? null : parseVndNumber(v)
        if (parsed !== value) onSave(parsed)
      }}
      className={`${CELL_INPUT} text-right`} />
  )
}

// Lô công nợ NCC upload nguyên xi (chưa chuẩn hoá) — dùng cho 4 tab NCC cố
// định (FCVN/SAO ĐỎ/VIETJET/SUN PQC), giữ đúng cột như file gốc.
export type RawMatchInfo = {
  row_index: number
  ma_khach: string | null
  match_status: MatchStatus
  matched_booking_id: string | null
  gia_mua: number | null
  gia_ban: number | null
  gia_source: 'message' | 'manual' | null
}

export type RawBatch = {
  id: string
  ncc: string
  source_file: string | null
  // Tên hiển thị tuỳ chỉnh (đổi qua double-click/chuột phải tab) — khác
  // source_file (tên file gốc lúc upload, không đổi) — null = chưa đổi tên,
  // hiển thị dùng source_file như trước. Đổi được vô số lần.
  display_name: string | null
  headers: string[]
  rows: string[][]
  created_at: string
  ve_debt_records_raw_match: RawMatchInfo[]
}
// Danh sách các lô upload nguyên xi của 1 tab NCC — mỗi lô là 1 "sheet"
// riêng, chọn qua thanh tab dính đáy màn hình giống Excel/Google Sheets
// (trước đây xếp chồng dọc, phải cuộn dài mới thấy hết các lần upload).
// Mỗi tab = 1 lần tải file từ NCC đó, giữ đúng cột/tên cột như file gốc
// (không ép về schema chung).
export type OpenRawMatch = (target: { batchId: string; rowIndex: number; idValue: string | null; paxLabel: string; matchStatus: MatchStatus | null }) => void

export function RawBatchesView({ batches, onDelete, onRename, ncc, onOpenMatch, onSaveGia }: { batches: RawBatch[]; onDelete: (id: string) => void; onRename: (id: string, displayName: string | null) => void; ncc: string; onOpenMatch: OpenRawMatch; onSaveGia: (batchId: string, rowIndex: number, field: 'gia_mua' | 'gia_ban', value: number | null) => void }) {
  // API trả về mới nhất TRƯỚC (created_at desc) — đảo lại để tab xếp theo
  // thứ tự thời gian như Excel (sheet mới thêm vào bên phải), lần tải mới
  // nhất nằm ngoài cùng bên phải và được chọn mặc định.
  const ordered = [...batches].reverse()
  const [activeId, setActiveId] = useState<string | null>(null)
  // Không tìm thấy (chưa chọn bao giờ, hoặc lô đang xem vừa bị xoá) → rơi
  // về lô mới nhất, không cần useEffect đồng bộ state.
  const active = ordered.find(b => b.id === activeId) ?? ordered[ordered.length - 1]

  // "Phóng to" quản lý Ở ĐÂY (không phải trong RawTableCard) vì phải bọc
  // fixed inset-0 quanh CẢ bảng lẫn thanh tab sheet bên dưới — để thanh tab
  // vẫn hiện, chọn được lô khác, ngay cả khi đang phóng to.
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Danh sách "Tất cả sheet" — giống nút ☰ ở đáy Google Sheets: khi có
  // nhiều lần tải, thanh tab cuộn ngang khó dò hết — bấm nút này để chọn
  // thẳng từ danh sách đầy đủ thay vì cuộn tìm.
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const tabMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tabMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) setTabMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [tabMenuOpen])

  // Đổi tên hiển thị của tab — double-click hoặc chuột phải → "Đổi tên"
  // (giống Excel/Google Sheets). Chỉ ghi display_name (xem onRename ở
  // CongNoVePage), source_file gốc không đổi — đổi được vô số lần, để
  // trống rồi lưu = xoá tên tuỳ chỉnh, quay lại hiển thị theo tên file gốc.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; batchId: string } | null>(null)

  useEffect(() => {
    if (!tabCtxMenu) return
    const close = () => setTabCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [tabCtxMenu])

  function startRename(b: RawBatch) {
    setRenamingId(b.id)
    setRenameDraft(b.display_name ?? b.source_file ?? '')
  }
  function commitRename(id: string) {
    const trimmed = renameDraft.trim()
    onRename(id, trimmed || null)
    setRenamingId(null)
  }

  // Đã đổi tên hiển thị thì vẫn kèm tên file gốc trong ngoặc ngay bên cạnh
  // — đổi tên nhiều lần dễ quên file gốc là file nào, nhất là lúc đối
  // chiếu lại. Chưa đổi tên thì chỉ hiện tên file gốc như trước, không lặp.
  function batchLabel(b: RawBatch): string {
    const original = b.source_file || 'Không rõ tên file'
    return b.display_name ? `${b.display_name} (${original})` : original
  }

  // Dòng nào CÓ tin nhắn Telegram khớp mã vé — hỏi 1 lượt cho cả lô đang
  // xem (xem route candidates-summary) để bảng chính hiện dấu hiệu sẵn cho
  // mọi dòng, thay vì phải bấm từng dòng mở panel mới biết là rỗng.
  // Lưu kèm batchId thay vì reset state khi đổi lô: state cũ của lô khác
  // coi như "chưa có dữ liệu" (candidateRows = null → chưa hiện icon), nên
  // không cần setState đồng bộ trong effect.
  const [candidateInfo, setCandidateInfo] = useState<{ batchId: string; rows: Set<number> } | null>(null)
  const activeId2 = active?.id
  useEffect(() => {
    if (!activeId2) return
    let cancelled = false
    fetch(`/api/ve-may-bay/cong-no-raw/${activeId2}/candidates-summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j?.data) return
        setCandidateInfo({ batchId: activeId2, rows: new Set<number>(j.data.rowsWithCandidates ?? []) })
      })
      .catch(() => { /* im lặng — chỉ mất dấu hiệu gợi ý, bảng vẫn dùng được */ })
    return () => { cancelled = true }
  }, [activeId2])
  const candidateRows = candidateInfo && candidateInfo.batchId === activeId2 ? candidateInfo.rows : null

  const tabBar = (
    <div className="shrink-0 flex items-stretch bg-gray-100 border border-t-0 border-gray-200">
      <div className="relative shrink-0" ref={tabMenuRef}>
        <button type="button" onClick={() => setTabMenuOpen(o => !o)} title="Tất cả các lần tải"
          className="h-full px-2 flex items-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 border-r border-gray-200 transition-colors">
          <Menu size={14} />
        </button>
        {tabMenuOpen && (
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[240px] max-h-64 overflow-y-auto">
            {ordered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">Chưa có lần tải nào</div>
            ) : ordered.map(b => {
              const isActive = b.id === active?.id
              return (
                <button key={b.id} type="button" onClick={() => { setActiveId(b.id); setTabMenuOpen(false) }}
                  title={new Date(b.created_at).toLocaleString('vi-VN')}
                  className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {batchLabel(b)}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex items-stretch gap-0.5 px-2 overflow-x-auto">
        {ordered.length === 0 ? (
          <span className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">Chưa có lần tải nào</span>
        ) : ordered.map(b => {
          const isActive = b.id === active?.id
          const label = b.display_name || b.source_file || 'Không rõ tên file'

          if (renamingId === b.id) {
            return (
              <input key={b.id} autoFocus value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onFocus={e => e.target.select()}
                onBlur={() => commitRename(b.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(b.id) }
                  if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                }}
                className="w-40 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-white border-t-2 border-brand-500 outline-none" />
            )
          }
          return (
            <button key={b.id} type="button" onClick={() => setActiveId(b.id)}
              onDoubleClick={() => startRename(b)}
              onContextMenu={e => { e.preventDefault(); setActiveId(b.id); setTabCtxMenu({ x: e.clientX, y: e.clientY, batchId: b.id }) }}
              title={`${batchLabel(b)} · ${b.rows.length} dòng · ${new Date(b.created_at).toLocaleString('vi-VN')}`}
              className={`px-3 py-1.5 text-xs whitespace-nowrap max-w-[220px] truncate border-t-2 transition-colors ${
                isActive
                  ? 'bg-white border-brand-500 text-brand-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:bg-gray-200/70'
              }`}>
              {label}
            </button>
          )
        })}
      </div>
      {/* Kẹp toạ độ trong viewport — thanh tab nằm sát đáy màn hình nên
          chuột phải ở đó có toạ độ y rất gần mép dưới, đặt top thẳng theo
          e.clientY sẽ đẩy menu lọt ra ngoài, chỉ thấy 1 mẩu. 150×40 là kích
          thước ước lượng đủ cho menu 1 mục "Đổi tên" hiện tại. */}
      {tabCtxMenu && createPortal(
        <div className="fixed z-[200] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[140px]"
          style={{ left: Math.min(tabCtxMenu.x, window.innerWidth - 158), top: Math.min(tabCtxMenu.y, window.innerHeight - 48) }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => {
            const b = ordered.find(x => x.id === tabCtxMenu.batchId)
            if (b) startRename(b)
            setTabCtxMenu(null)
          }} className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">
            Đổi tên
          </button>
        </div>,
        document.body
      )}
    </div>
  )

  const table = active ? (
    <RawTableCard key={active.id} ncc={ncc} headers={active.headers} rows={active.rows}
      info={`${batchLabel(active)} · ${active.rows.length} dòng · ${new Date(active.created_at).toLocaleString('vi-VN')}`}
      onDelete={() => onDelete(active.id)}
      matches={new Map(active.ve_debt_records_raw_match.map(m => [m.row_index, m]))}
      onSaveGia={(rowIndex, field, value) => onSaveGia(active.id, rowIndex, field, value)}
      expanded={expanded} onToggleExpand={() => setExpanded(e => !e)}
      candidateRows={candidateRows}
      onOpenMatch={rowIndex => {
        const idColIdx = findIdColumnIndex(active.headers)
        const paxColIdx = findPaxColumnIndex(active.headers)
        const row = active.rows[rowIndex]
        const existing = active.ve_debt_records_raw_match.find(m => m.row_index === rowIndex)
        onOpenMatch({
          batchId: active.id,
          rowIndex,
          idValue: idColIdx != null ? row?.[idColIdx]?.trim() || null : null,
          paxLabel: paxColIdx != null ? (row?.[paxColIdx]?.trim() || '—') : '—',
          matchStatus: existing?.match_status ?? null,
        })
      }} />
  ) : (
    <RawTableCard ncc={ncc} headers={NCC_HEADER_HINTS[ncc] ?? []} rows={[]} info="Chưa có dữ liệu" matches={new Map()} onOpenMatch={() => {}} onSaveGia={() => {}}
      expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} candidateRows={null} />
  )

  const body = (
    <div className={expanded ? 'fixed inset-0 z-[100] bg-white flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
      <div className="flex-1 min-h-0">{table}</div>
      {tabBar}
    </div>
  )

  return expanded && mounted ? createPortal(body, document.body) : body
}

export type RawTableMatch = Pick<RawMatchInfo, 'ma_khach' | 'match_status' | 'gia_mua' | 'gia_ban' | 'gia_source'>

// Ô giá mua/giá bán cho bảng raw — mặc định hiện số + nhãn nhỏ "từ tin
// nhắn" khi gia_source==='message' (tự điền lúc khớp mã khách/chọn pax từ
// slide-over, xem match-ma-khach-raw.ts), bấm cây viết mới lộ ra ô nhập —
// tránh nhìn giống ô luôn-sửa-được như EditableNumberCell (dữ liệu ở đây
// coi là số chính thức ngay khi tự điền, không phải ô nháp).
export function RawPriceCell({ value, source, onSave }: { value: number | null; source: 'message' | 'manual' | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    // absolute inset-0 (thay vì h-full) — chiều cao <td> do CẢ HÀNG quyết
    // định (phụ thuộc ô khác), height:100% tạo vòng lặp phụ thuộc nên trình
    // duyệt bỏ qua, quay về chiều cao tự nhiên của input (thấp hơn hàng
    // thật). absolute lấy input ra khỏi luồng, không góp phần tính chiều
    // cao <td> nữa nên hết vòng lặp — input lấp đúng khít cả 4 cạnh ô sau
    // khi hàng đã có chiều cao thật. Cần <td> tương ứng có "relative".
    return (
      <div className="absolute inset-0">
        <EditableNumberCell value={value} onSave={v => { onSave(v); setEditing(false) }} />
      </div>
    )
  }
  return (
    // px-2 py-1.5 bù lại phần padding đã bỏ khỏi <td> (xem RawTableCard) —
    // để lúc CHƯA sửa, nội dung vẫn nằm đúng vị trí như trước; lúc bấm bút
    // chuyển sang EditableNumberCell thì <td> trống padding, input tự
    // choán trọn ô nên viền xanh focus khớp đúng mép ô (kiểu Excel thật).
    <div className="flex items-center justify-end gap-1 px-2 py-1.5">
      <span className="text-right">{formatGiaVe(value)}</span>
      {source === 'message' && <span className="text-[10px] text-gray-400 whitespace-nowrap">từ tin nhắn</span>}
      <button type="button" onClick={() => setEditing(true)} title="Sửa" className="p-0.5 text-gray-300 hover:text-brand-600 shrink-0">
        <Pencil size={11} />
      </button>
    </div>
  )
}

// Khung bảng dùng chung cho cả lô đã upload lẫn tab chưa có dữ liệu (rows
// rỗng → tự kẻ lưới trống theo đúng số cột header) — có cùng thanh đếm
// dòng + nút "Phóng to" (portal thẳng document.body, giống bảng Tổng hợp)
// như bảng "Tổng hợp" để đồng nhất trải nghiệm giữa các tab.
//
// Cột "Mã khách" là cột THÊM VÀO ở UI (không nằm trong headers gốc — dữ
// liệu raw không đụng tới, xem migration_ve_debt_records_raw.sql), chỉ hiện
// khi có dòng thật. Ô mã vé/PNR và tên pax (idColIdx/paxColIdx, nhận diện
// qua raw-column-roles.ts) làm nút bấm mở slide-over — lồng bên trong <td>
// gốc, không đụng cellProps/cellClassName của useCellSelection nên không
// phá cơ chế kéo-chọn-Ctrl+C hiện có (đã xác nhận hook chỉ gắn
// onMouseDown/onMouseEnter/onContextMenu, không có onClick).
export const RAW_EXTRA_COLS = [
  { key: 'ma_khach', label: 'Mã khách', align: undefined as 'right' | undefined, width: 130 },
  { key: 'gia_mua', label: 'Giá mua', align: 'right' as const, width: 100 },
  { key: 'gia_ban', label: 'Giá bán', align: 'right' as const, width: 100 },
  { key: 'loi_nhuan', label: 'Lợi nhuận', align: 'right' as const, width: 100 },
]

// So khớp tên cột KHÔNG phân biệt hoa/thường/khoảng trắng/dấu câu (vd
// "Ticket Nbr." khớp "ticketnbr") — để chọn cột "mặc định hiện" theo TÊN
// vẫn đúng dù file khác nhau viết hoa/thường hay chấm phẩy khác nhau chút.
function normalizeHeader(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Cột hiện SẴN khi user CHƯA từng tự chỉnh (chưa có cài đặt lưu trong DB) —
// theo yêu cầu 2026-08-23: mỗi NCC chỉ hiện 1 tập cột "cần nhìn ngay", còn
// lại ẩn bớt (vẫn bật lại được qua nút cột hiển thị). NCC không có trong
// danh sách này (vd SUN PQC) → hiện đủ như cũ, không lọc gì.
const DEFAULT_VISIBLE_HEADERS: Record<string, string[]> = {
  'FCVN': ['issuedate', 'ticketnbr', 'paxname', 'route', 'tkt'],
  'SAO ĐỎ': ['ngayxv', 'codesove', 'tenkhach', 'hanhtrinh', 'ngaydi', 'ngayve', 'thanhtien', 'tkt'],
  'VIETJET': ['pnr', 'paxname', 'paymentdate', 'segments', 'amountconvertvnd', 'tkt'],
}
// Mã khách/Giá bán mặc định hiện ở CẢ 4 NCC — Giá mua/Lợi nhuận mặc định ẩn.
const DEFAULT_VISIBLE_EXTRA_COLS = ['ma_khach', 'gia_ban']

// File gốc FCVN có 1 cột KHÔNG có tên (header rỗng, hiện tạm "Cột 20") mà
// thực chất là "Net Amt VND" — không so khớp theo tên được (rỗng) nên phải
// chỉ đích danh theo VỊ TRÍ. index 0-based = "Cột 20" (nhãn hiện 1-based
// = index+1). Cột "Net Amt" GỐC (có tên thật) đổi nhãn hiển thị thành
// "Net Amt Local" để phân biệt, và mặc định ẨN (không phải đơn vị VND).
const FCVN_NET_AMT_VND_INDEX = 19

// Nhãn hiển thị cho 1 cột — override tên gốc khi cần (hiện chỉ FCVN, xem
// FCVN_NET_AMT_VND_INDEX ở trên), còn lại giữ nguyên tên trong file gốc.
function displayHeader(ncc: string, h: string, i: number): string {
  if (ncc === 'FCVN') {
    if (i === FCVN_NET_AMT_VND_INDEX) return 'Net Amt VND'
    if (normalizeHeader(h) === 'netamt') return 'Net Amt Local'
  }
  return h
}

// Danh sách cột ẨN mặc định (dùng làm defaultValue cho useUserPreference —
// chỉ áp dụng khi user CHƯA từng lưu lựa chọn nào, xem RawTableCard).
function computeDefaultHiddenCols(ncc: string, headers: string[]): string[] {
  const visible = DEFAULT_VISIBLE_HEADERS[ncc]
  if (!visible) return [] // NCC không cấu hình riêng → hiện đủ như cũ
  const hidden: string[] = []
  headers.forEach((h, i) => {
    if (ncc === 'FCVN' && i === FCVN_NET_AMT_VND_INDEX) return // luôn hiện
    if (!visible.includes(normalizeHeader(h))) hidden.push(String(i))
  })
  for (const c of RAW_EXTRA_COLS) {
    if (!DEFAULT_VISIBLE_EXTRA_COLS.includes(c.key)) hidden.push(c.key)
  }
  return hidden
}

export function RawTableCard({ ncc, headers, rows, info, onDelete, matches, onOpenMatch, onSaveGia, expanded, onToggleExpand, candidateRows }: {
  ncc: string; headers: string[]; rows: string[][]; info: string; onDelete?: () => void
  matches: Map<number, RawTableMatch>; onOpenMatch: (rowIndex: number) => void
  onSaveGia: (rowIndex: number, field: 'gia_mua' | 'gia_ban', value: number | null) => void
  expanded: boolean; onToggleExpand: () => void
  // null = chưa tải xong/không áp dụng → không hiện icon (tránh báo nhầm
  // "không có tin nhắn" trong lúc còn đang hỏi server).
  candidateRows: Set<number> | null
}) {
  const idColIdx = findIdColumnIndex(headers)
  const paxColIdx = findPaxColumnIndex(headers)

  // Ẩn/hiện cột — lưu theo TÀI KHOẢN (user_preferences qua DB, không phải
  // localStorage) nên đăng nhập máy khác vẫn giữ đúng lựa chọn. Định danh
  // cột dùng ĐÚNG quy ước đang có sẵn cho độ rộng cột (rawWidths bên dưới):
  // cột động = String(index), 4 cột thêm = key riêng — nhất quán, cùng
  // chấp nhận giới hạn "đổi file khác cột thứ N có thể mang ý nghĩa khác"
  // y hệt độ rộng cột đang chấp nhận từ trước.
  const { value: hiddenCols, set: setHiddenCols } = useUserPreference<string[]>(`column_visibility.raw_table_${ncc}`, computeDefaultHiddenCols(ncc, headers))
  const hiddenColSet = new Set(hiddenCols)
  function toggleCol(key: string) {
    setHiddenCols(hiddenColSet.has(key) ? hiddenCols.filter(k => k !== key) : [...hiddenCols, key])
  }

  // Thứ tự cột do người dùng tự kéo — cũng lưu theo tài khoản. Rỗng = dùng
  // thứ tự gốc của file. Lưu theo NCC (không theo từng lô) vì các lô cùng 1
  // NCC thường cùng cấu trúc cột, giống cách rawWidths đang làm.
  const { value: savedColOrder, set: setColOrder } = useUserPreference<string[]>(`column_order.raw_table_${ncc}`, [])
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!colMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [colMenuOpen])

  // Cột raw không cố định (đọc thẳng từ file NCC upload) nên key theo INDEX
  // thay vì tên cột — key theo tên dễ trùng/đổi giữa các lần upload khác
  // nhau. Lưu theo `raw-table-{ncc}` để việc kéo giãn cột "nhớ" lại đúng
  // cho từng tab NCC (FCVN/SAO ĐỎ/VIETJET/SUN PQC), dùng chung cho mọi lô
  // đã upload của cùng 1 NCC vì cấu trúc cột thường giống hệt nhau.
  const rawColDefaults: Record<string, number> = {}
  headers.forEach((_, i) => { rawColDefaults[String(i)] = 110 })
  for (const c of RAW_EXTRA_COLS) rawColDefaults[c.key] = c.width
  const { widths: rawWidths, startResize: startRawResize } = useResizableColumns(`raw-table-${ncc}`, rawColDefaults)

  // ── Mô hình cột có THỨ TỰ ────────────────────────────────────────────
  // Gộp cột dữ liệu (đọc từ file) và 4 cột thêm của app về 1 danh sách duy
  // nhất để kéo đổi chỗ lẫn nhau được. `dataIndex` giữ vị trí GỐC trong
  // rows[] — thứ tự hiển thị đổi nhưng đọc dữ liệu vẫn đúng ô.
  type ColDesc = { key: string; label: string; width: number; align?: 'right'; dataIndex: number | null }
  const defaultCols: ColDesc[] = [
    ...headers.map((h, i) => ({
      key: String(i),
      label: displayHeader(ncc, h, i) || `Cột ${i + 1}`,
      width: rawWidths[String(i)] ?? 110,
      dataIndex: i,
    })),
    ...RAW_EXTRA_COLS.map(c => ({
      key: c.key,
      label: c.label,
      width: rawWidths[c.key] ?? c.width,
      align: c.align,
      dataIndex: null,
    })),
  ]

  // Áp thứ tự đã lưu, nhưng phải HOÀ GIẢI với cấu trúc file hiện tại: lô
  // mới có thể nhiều/ít cột hơn lô lúc lưu → bỏ key không còn tồn tại, và
  // thêm key mới (chưa từng thấy) vào cuối thay vì mất hút.
  const orderedCols: ColDesc[] = (() => {
    const byKey = new Map(defaultCols.map(c => [c.key, c]))
    const out: ColDesc[] = []
    const seen = new Set<string>()
    for (const k of savedColOrder) {
      const c = byKey.get(k)
      if (c && !seen.has(k)) { out.push(c); seen.add(k) }
    }
    for (const c of defaultCols) if (!seen.has(c.key)) out.push(c)
    return out
  })()

  // Lô chưa có dòng nào → không hiện 4 cột thêm (giữ nguyên hành vi cũ).
  const activeCols = rows.length > 0 ? orderedCols : orderedCols.filter(c => c.dataIndex != null)
  const visibleCols = activeCols.filter(c => !hiddenColSet.has(c.key))
  const rawTotalWidth = visibleCols.reduce((sum, c) => sum + c.width, 0)

  // Chỉ số dùng cho việc kéo-chọn-vùng/Ctrl+C/mũi tên (useCellSelection):
  // đánh số LIÊN TỤC theo thứ tự nhìn thấy nhưng CHỈ tính cột dữ liệu — 4
  // cột thêm không tham gia vùng chọn (như trước giờ). Nhờ vậy dù kéo 1 cột
  // thêm vào giữa bảng, phím mũi tên vẫn đi liền mạch qua các cột dữ liệu,
  // không bị kẹt ở giữa.
  const selColDataIndexes: number[] = visibleCols.filter(c => c.dataIndex != null).map(c => c.dataIndex as number)
  const selIndexOf = new Map<string, number>()
  visibleCols.filter(c => c.dataIndex != null).forEach((c, n) => selIndexOf.set(c.key, n))

  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection(
    (r, c) => rows[r]?.[selColDataIndexes[c]] ?? ''
  )

  // Kéo đổi chỗ cột (HTML5 drag-and-drop gốc, không cần thư viện). Kéo từ
  // thanh đổi độ rộng KHÔNG kích hoạt kéo cột vì startResize gọi
  // preventDefault() trên mousedown — trình duyệt không khởi động drag nữa.
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  function moveColumn(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    const keys = orderedCols.map(c => c.key)
    const fromIdx = keys.indexOf(fromKey)
    const toIdx = keys.indexOf(toKey)
    if (fromIdx < 0 || toIdx < 0) return
    keys.splice(fromIdx, 1)
    // Sau khi rút phần tử ra, chèn tại đúng toIdx cũ cho ra kết quả tự
    // nhiên ở CẢ 2 chiều: kéo sang phải thì nằm SAU cột đích, kéo sang
    // trái thì nằm TRƯỚC cột đích (giống Excel/Google Sheets).
    keys.splice(toIdx, 0, fromKey)
    setColOrder(keys)
  }

  // Bảng CHOÁN HẾT chiều cao khung cha (h-full + min-h-0) thay vì max-h cố
  // định — khung cha (do RawBatchesView quyết định) đã bị chặn chiều cao
  // bởi layout cột của trang lúc bình thường, hoặc bằng cả màn hình lúc
  // "Phóng to" (RawBatchesView tự bọc fixed inset-0 + portal, bọc CẢ card
  // này lẫn thanh tab sheet — không tự làm ở đây nữa để thanh tab không bị
  // bỏ lại phía sau khi phóng to). Chỉ bo góc TRÊN lúc bình thường vì thanh
  // sheet nằm dính ngay dưới sẽ bo góc dưới; lúc phóng to bỏ bo góc luôn
  // (khít cả 4 cạnh màn hình).
  const content = (
    <div className={expanded ? 'bg-white flex flex-col h-full min-h-0 list-table-container' : 'bg-white border border-gray-100 shadow-sm list-table-container overflow-hidden flex flex-col h-full min-h-0'}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{info}</span>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button onClick={onDelete} title="Xoá lô này" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <div className="relative" ref={colMenuRef}>
            <button onClick={() => setColMenuOpen(o => !o)} title="Cột hiển thị"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
              <Settings size={13} />
            </button>
            {colMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-72 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 mb-1">Cột hiển thị</div>
                {/* Liệt kê theo ĐÚNG thứ tự cột đang hiển thị (kể cả sau khi
                    kéo đổi chỗ) để dễ dò, không theo thứ tự gốc của file. */}
                {activeCols.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={!hiddenColSet.has(col.key)} onChange={() => toggleCol(col.key)} />
                    <span className="truncate">{col.label}</span>
                  </label>
                ))}
                {savedColOrder.length > 0 && (
                  <button type="button" onClick={() => setColOrder([])}
                    className="w-full text-left px-3 py-1.5 mt-1 border-t border-gray-100 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                    Khôi phục thứ tự cột gốc
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={onToggleExpand}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors">
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {expanded ? 'Thu nhỏ' : 'Phóng to'}
          </button>
        </div>
      </div>
      <div {...wrapProps}
        className="flex-1 min-h-0 overflow-auto select-none outline-none">
        <table className="list-table text-xs fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: rawTotalWidth }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-gray-500">
              {visibleCols.map(col => (
                <th key={col.key} style={{ width: col.width }}
                  draggable
                  onDragStart={e => { setDragColKey(col.key); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragColKey && dragColKey !== col.key) setDragOverKey(col.key) }}
                  onDragLeave={() => setDragOverKey(k => k === col.key ? null : k)}
                  onDrop={e => { e.preventDefault(); if (dragColKey) moveColumn(dragColKey, col.key); setDragColKey(null); setDragOverKey(null) }}
                  onDragEnd={() => { setDragColKey(null); setDragOverKey(null) }}
                  title="Kéo để đổi vị trí cột"
                  className={`relative px-2 py-1.5 font-semibold border border-gray-200 whitespace-nowrap overflow-hidden select-none cursor-grab active:cursor-grabbing ${col.align === 'right' ? 'text-right' : 'text-left'} ${dragColKey === col.key ? 'opacity-40' : ''} ${dragOverKey === col.key ? 'bg-brand-100 ring-2 ring-inset ring-brand-500' : ''}`}>
                  {col.label}
                  <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startRawResize(col.key, e)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r, i) => {
              const match = matches.get(i)
              return (
              <tr key={i} className="border-t border-gray-100">
                {visibleCols.map(col => {
                  // Cột dữ liệu (đọc từ file) — dataIndex giữ vị trí GỐC
                  // trong rows[] nên kéo đổi chỗ cột không làm lệch dữ liệu.
                  if (col.dataIndex != null) {
                    const j = col.dataIndex
                    const h = headers[j]
                    const selIdx = selIndexOf.get(col.key) ?? 0
                    // "Receipt Nbr." là MÃ, không phải số lượng/tiền — dù toàn
                    // chữ số vẫn không được tách hàng nghìn (899000 → 899.000
                    // nhìn nhầm thành số thập phân), khác các cột tiền thật sự
                    // (Fare/Tax/Charge...) cố tình cần tách hàng nghìn.
                    const isCodeColumn = j === idColIdx || j === paxColIdx || h?.trim().toUpperCase().includes('RECEIPT')
                    const numericValue = !isCodeColumn ? parseRawNumericCell(r[j]) : null
                    return (
                      <td key={col.key}
                        {...cellProps(i, selIdx)}
                        title={r[j] || undefined}
                        className={cellClassName(i, selIdx, `border border-gray-100 px-2 py-1.5 text-gray-900 align-top cursor-cell overflow-hidden text-ellipsis ${numericValue != null ? 'text-right tabular-nums' : ''}`)}>
                        {h?.trim().toUpperCase() === 'SEGMENTS' ? (
                          <div className="space-y-0.5">
                            {splitSegmentsForDisplay(r[j]).map((seg, k) => <div key={k} className="whitespace-nowrap">{seg}</div>)}
                          </div>
                        ) : j === paxColIdx ? (
                          // Vé đoàn FCVN gộp nhiều pax vào 1 ô, nối bằng "+" (vd
                          // "5 PAX ADT.05 + DAO, THI THAM + GIANG, QUYNH ANH..."
                          // — tách xuống dòng cho dễ đọc bằng splitPaxLinesForDisplay.
                          <button type="button" onClick={() => onOpenMatch(i)}
                            className="text-left underline decoration-dotted decoration-gray-300 hover:decoration-brand-500 hover:text-brand-600 transition-colors">
                            <div className="space-y-0.5">
                              {splitPaxLinesForDisplay(r[j]).map((name, k) => <div key={k} className="whitespace-nowrap">{name}</div>)}
                            </div>
                          </button>
                        ) : j === idColIdx ? (
                          <button type="button" onClick={() => onOpenMatch(i)}
                            className="whitespace-nowrap underline decoration-dotted decoration-gray-300 hover:decoration-brand-500 hover:text-brand-600 transition-colors">
                            {r[j] || '—'}
                          </button>
                        ) : numericValue != null ? (
                          <span className="whitespace-nowrap">{numericValue.toLocaleString('vi-VN')}</span>
                        ) : (
                          <span className="whitespace-nowrap">{r[j] || '—'}</span>
                        )}
                      </td>
                    )
                  }
                  // 4 cột THÊM của app (không có trong file gốc).
                  if (col.key === 'ma_khach') return (
                    <td key={col.key} className="border border-gray-100 px-2 py-1.5 align-top overflow-hidden">
                      <div className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer" onClick={() => onOpenMatch(i)}>
                        <MatchStatusBadge status={match?.match_status ?? 'unmatched'} dense onClick={() => onOpenMatch(i)} />
                        {/* Có/không có tin nhắn Telegram khớp mã vé — chấm trạng
                            thái bên trái chỉ nói ĐÃ gán mã khách hay chưa, không
                            cho biết có nguồn để gán hay không. Bọc <span> vì
                            thuộc tính title đặt thẳng lên <svg> không phải trình
                            duyệt nào cũng hiện tooltip. */}
                        {candidateRows && (
                          <span className="shrink-0 flex items-center"
                            title={candidateRows.has(i)
                              ? 'Có tin nhắn Telegram khớp mã vé — bấm để xem'
                              : 'Không có tin nhắn Telegram nào khớp mã vé'}>
                            {candidateRows.has(i)
                              ? <MessageSquareText size={12} className="text-emerald-500" />
                              : <MessageSquareOff size={12} className="text-gray-300" />}
                          </span>
                        )}
                        {match?.ma_khach || <span className="text-gray-300">Chưa có</span>}
                      </div>
                    </td>
                  )
                  if (col.key === 'gia_mua' || col.key === 'gia_ban') return (
                    <td key={col.key} className="relative border border-gray-100 p-0 align-top overflow-hidden">
                      <RawPriceCell value={match?.[col.key] ?? null} source={match?.gia_source ?? null} onSave={v => onSaveGia(i, col.key as 'gia_mua' | 'gia_ban', v)} />
                    </td>
                  )
                  return (
                    <td key={col.key} className="border border-gray-100 px-2 py-1.5 align-top text-right overflow-hidden">
                      {match?.gia_mua != null && match?.gia_ban != null ? formatGiaVe(match.gia_ban - match.gia_mua) : '—'}
                    </td>
                  )
                })}
              </tr>
              )
            }) : Array.from({ length: EMPTY_GRID_ROWS }).map((_, i) => (
              <tr key={i}>
                {visibleCols.map(col => <td key={col.key} className="border border-gray-100 h-8">&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return <>{content}{menu}</>
}
