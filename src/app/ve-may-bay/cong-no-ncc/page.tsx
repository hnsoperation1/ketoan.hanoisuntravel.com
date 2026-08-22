'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Trash2, Loader2, Maximize2, Minimize2, X, Pencil } from 'lucide-react'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useTopbar } from '@/contexts/topbar'
import { type MatchStatus, MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import { findIdColumnIndex, findPaxColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { RawMatchPanel, type RawCandidateMessage, type RawKhachInfo, type RawCandidatePax } from './RawMatchPanel'

function formatGiaVe(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN')
}

// Nhận diện ô raw NCC là số THUẦN (vd "899000", "-1932000") để tách hàng
// nghìn + căn phải khi hiện — file gốc NCC không tách hàng nghìn/không có
// dấu gì khác nên chỉ cần regex đơn giản, không cần biết cột nào là "giá"
// (raw không có schema cột cố định, xem raw-column-roles.ts).
function parseRawNumericCell(v: string | undefined): number | null {
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
function parseVndNumber(raw: string): number | null {
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
function splitPaxLinesForDisplay(paxName: string | null): string[] {
  const s = (paxName ?? '').trim()
  if (!/^\d+\s*PAX\b/i.test(s)) return [paxName ?? '']
  const sep = s.includes(';') ? ';' : '+'
  const lines = s.split(sep).map(seg => seg.trim()).filter(Boolean)
  return lines.length > 0 ? lines : [paxName ?? '']
}

function parseCsvLine(line: string): string[] {
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

function parseCsvGrid(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim() !== '').map(parseCsvLine)
}

// Cell Excel có thể là chuỗi thô, Date, hoặc object (formula {result},
// rich text {richText: [...]})  — quy hết về text hiển thị được.
function cellToText(v: unknown): string {
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

type SheetData = { name: string; grid: string[][] }

function gridFromWorksheet(ws: import('exceljs').Worksheet): string[][] {
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
async function parseXlsxSheets(file: File): Promise<SheetData[]> {
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
function xmlLocalName(el: Element): string {
  return el.tagName.includes(':') ? el.tagName.split(':')[1] : el.tagName
}

function xmlChildrenByLocalName(parent: Element | XMLDocument, name: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter(el => xmlLocalName(el) === name)
}

function colRefToIdx(ref: string): number {
  const letters = ref.match(/^[A-Za-z]+/)?.[0] ?? ''
  let idx = 0
  for (const ch of letters.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx - 1
}

async function parseXlsxSheetsFallback(file: File): Promise<SheetData[]> {
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

async function parseXlsxSheetsAny(file: File): Promise<SheetData[]> {
  try {
    return await parseXlsxSheets(file)
  } catch {
    return await parseXlsxSheetsFallback(file)
  }
}

// ── Nhận diện nhanh chữ ký Vietjet/FCVN để gợi ý sẵn tên NCC lúc chọn
// file, không tự tách/chuẩn hoá cột nữa (việc đó làm ở bước riêng sau).
function findVietjetHeaderRow(grid: string[][]): number | null {
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
function splitSegmentsForDisplay(value: string): string[] {
  return (value || '')
    .split(/(?=[A-Za-z]{3}\s\d{1,2},\s*\d{4})/)
    .map(s => s.trim())
    .filter(Boolean)
}

function findFcvnHeaderRow(grid: string[][]): number | null {
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
function isLikelyJunkRow(row: string[], idColIdx: number | null): boolean {
  if (idColIdx == null) return false
  return (row[idColIdx] ?? '').trim().length < 4
}

// File .xls (nhị phân cũ, OLE2 — khác hẳn .xlsx là file zip) không đọc
// được bằng exceljs lẫn bộ dự phòng jszip+DOMParser ở trên (2 bộ đó chỉ
// đọc được .xlsx) — dùng `xlsx` (SheetJS) riêng cho .xls, thư viện này đọc
// được cả 2 định dạng nhưng chỉ dùng cho nhánh .xls để không đổi hành vi
// đang chạy ổn định của .xlsx/.csv.
async function parseXlsFile(file: File): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map(name => ({
    name,
    grid: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' }),
  }))
}

// 4 NCC cố định (khớp yêu cầu 2026-08-13) — luôn hiện tab dù NCC đó chưa
// có dòng dữ liệu nào (khác cách cũ chỉ liệt kê NCC đã có sẵn trong rows).
const NCC_TABS = ['FCVN', 'SAO ĐỎ', 'VIETJET', 'SUN PQC']

// Số dòng kẻ trống khi 1 tab NCC chưa có lô dữ liệu nào — chỉ để nhìn
// giống 1 file Excel trống, không mang ý nghĩa dữ liệu gì.
const EMPTY_GRID_ROWS = 5

// Header gợi ý theo ĐÚNG cột thật của từng NCC — lấy trực tiếp từ dòng tiêu
// đề file mẫu thật "FILE VÉ GỬI QUỐC.xlsx" (sheet cùng tên NCC), hiện sẵn
// khi tab đó CHƯA có lô nào upload để nhìn giống hệt bảng thật thay vì
// lưới trống vô nghĩa. Ngay khi có lô đầu tiên upload lên, header thật lấy
// từ chính file đó sẽ thay thế, không còn dùng gợi ý này nữa.
const NCC_HEADER_HINTS: Record<string, string[]> = {
  'FCVN': ['Order', 'Receipt Nbr.', 'Issue date', 'Ticket Nbr.', 'Pax Name', 'Route', 'T', 'Cust.', 'Curr', 'ROE', 'Fare', 'Tax', 'Charge', 'Vat', 'Sv.Fee', 'Penalty', 'ToTal AMT', 'Comm.', 'Net Amt', 'FB', 'Class', 'FLT Nbr.', 'Saler', 'Remark'],
  'VIETJET': ['PNR', 'PAX NAME', 'PAYMENT DATE', 'SEGMENTS', 'PAYMENT BY', 'TAKEN BY', 'ACCOUNT', 'AMOUNT CONVERT (VND)', 'CURRENCY', 'AMOUNT CONVERT (VND)', 'Payment Identifier'],
  'SAO ĐỎ': ['STT', 'NGAY XV', 'CODE/SO VE', 'TEN KHACH', 'HANH TRINH', 'NGAY DI', 'NGAY VE', 'Gia ve', 'Thue', 'Dich vu', 'CKTM', 'SL PAX', 'Ty gia', 'Thanh Tien', 'THANH TOAN', 'DƯ NỢ', 'GHI CHU'],
  'SUN PQC': ['STT', 'Loại giao dịch', 'Ngày giao dịch', 'Office ID', 'Loại chứng từ', 'Loại hành trình', 'Mã đặt chỗ (PNR)', 'Số vé', 'Tên khách', 'Hành trình', 'Hình thức thanh toán', 'Lý do phát hành', 'Ngày bay', 'Hãng vận chuyển', 'Số hiệu chuyến bay', 'Hạng vé', 'Loại khách', 'Giá vé', 'Phí hoàn vé', 'Phí xuất vé', 'Phí đổi', 'Phí phụ thu nhiên liệu', 'Phí quản trị hệ thống', 'Thuế suất', 'Thuế VAT', 'Phí sân bay', 'Phí soi chiếu', 'Thuế, phí khác', 'Tổng tiền', 'Loại tiền tệ', 'Người xuất vé'],
}
// Viền xanh lá đậm, góc vuông khi focus — giống ô đang nhập trong Excel
// thật (không phải nhẫn xanh dương bo tròn kiểu form web thông thường).
// ring-inset để viền nằm gọn trong ô, không đẩy layout xê dịch.
const CELL_INPUT = 'w-full h-full bg-transparent text-xs px-1 py-0.5 rounded-none focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#107C41]'

// Hiện số có phân cách hàng nghìn (toLocaleString) khi không focus, đổi
// sang chuỗi số thô khi focus để gõ/dán tự nhiên — không thể vừa gõ vừa
// hiện dấu chấm phân cách bằng 1 giá trị input duy nhất.
function EditableNumberCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
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
type RawMatchInfo = {
  row_index: number
  ma_khach: string | null
  match_status: MatchStatus
  matched_booking_id: string | null
  gia_mua: number | null
  gia_ban: number | null
  gia_source: 'message' | 'manual' | null
}

type RawBatch = {
  id: string
  ncc: string
  source_file: string | null
  headers: string[]
  rows: string[][]
  created_at: string
  ve_debt_records_raw_match: RawMatchInfo[]
}

// Bảng hành khách của TIN NHẮN đang chọn ở RawMatchPanel (bên trái) — hiện
// ngay trên danh sách lô công nợ raw, dạng bảng rộng (đồng bộ style với
// RawTableCard) thay vì card hẹp nhồi trong panel, dễ đọc/đối chiếu hơn khi
// tin nhắn có nhiều pax. "Chọn" gán mã khách của đúng dòng công nợ đang mở
// panel (viewingRawMatch) — y hệt hành vi choosePax cũ trong RawMatchPanel.
function SelectedMessagePaxTable({ message, khachInfo, onChoose }: {
  message: RawCandidateMessage
  khachInfo: RawKhachInfo
  onChoose: (p: RawCandidatePax, giaMua: number | null, giaBan: number | null) => void
}) {
  // Giá mua/bán AI đọc từ tin nhắn có thể sai — cho kế toán sửa NGAY tại
  // đây trước khi bấm "Chọn" thay vì phải chọn xong rồi sửa lại ở bảng công
  // nợ. Chỉ là state hiển thị tạm cho tin nhắn đang xem (không ghi DB ở
  // đây) — "Chọn" gửi đúng giá đã sửa (hoặc giá gốc nếu chưa sửa) lên qua
  // onChoose, page.tsx mới là nơi thật sự lưu vào ve_debt_records_raw_match.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, { gia_mua?: number | null; gia_ban?: number | null }>>({})

  function setPrice(paxId: string, field: 'gia_mua' | 'gia_ban', value: number | null) {
    setPriceOverrides(prev => ({ ...prev, [paxId]: { ...prev[paxId], [field]: value } }))
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500 truncate">
          Hành khách trong tin nhắn của <span className="font-semibold text-emerald-600">{message.from_user_name ?? 'Không rõ người gửi'}</span>
          {message.group_title && <span className="text-gray-400"> · Nhóm: {message.group_title}</span>}
        </span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{message.pax.length} khách</span>
      </div>
      <div className="overflow-auto max-h-[360px]">
        <table className="list-table text-xs w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-gray-500">
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap">Hành khách</th>
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap">Mã vé</th>
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap">TKT</th>
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap">Mã khách</th>
              <th className="px-2 py-1.5 text-right font-semibold border border-gray-200 whitespace-nowrap">Giá mua</th>
              <th className="px-2 py-1.5 text-right font-semibold border border-gray-200 whitespace-nowrap">Giá bán</th>
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {message.pax.map(p => {
              const info = p.ma_khach ? khachInfo[p.ma_khach] : undefined
              const invalid = p.ma_khach && !info
              const inactive = info && !info.active
              const giaMua = priceOverrides[p.id]?.gia_mua !== undefined ? priceOverrides[p.id].gia_mua! : p.gia_mua
              const giaBan = priceOverrides[p.id]?.gia_ban !== undefined ? priceOverrides[p.id].gia_ban! : p.gia_ban
              return (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="border border-gray-100 px-2 py-1.5 text-gray-900 whitespace-nowrap">{p.full_name || p.ten_khach_hang || 'Không rõ tên khách'}</td>
                  <td className="border border-gray-100 px-2 py-1.5 text-gray-500 whitespace-nowrap">{p.ticket_no ?? '—'}</td>
                  <td className="border border-gray-100 px-2 py-1.5 text-gray-500 whitespace-nowrap">{p.ve_tkt?.tkt_code ?? '—'}</td>
                  <td className="border border-gray-100 px-2 py-1.5 whitespace-nowrap">
                    <span className="font-semibold text-gray-800">{p.ma_khach ?? '—'}</span>
                    {info?.ten_khach && <span className="text-gray-400"> · {info.ten_khach}</span>}
                    {(invalid || inactive) && (
                      <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        {invalid ? 'Không có trong danh mục' : 'Đã ngừng hoạt động'}
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-100 px-2 py-1.5">
                    <RawPriceCell value={giaMua} source="message" onSave={v => setPrice(p.id, 'gia_mua', v)} />
                  </td>
                  <td className="border border-gray-100 px-2 py-1.5">
                    <RawPriceCell value={giaBan} source="message" onSave={v => setPrice(p.id, 'gia_ban', v)} />
                  </td>
                  <td className="border border-gray-100 px-2 py-1.5 whitespace-nowrap">
                    <button type="button" onClick={() => onChoose(p, giaMua, giaBan)} disabled={!p.ma_khach}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Chọn
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Danh sách các lô upload nguyên xi của 1 tab NCC — mỗi lô là 1 "sheet"
// riêng, chọn qua thanh tab dính đáy màn hình giống Excel/Google Sheets
// (trước đây xếp chồng dọc, phải cuộn dài mới thấy hết các lần upload).
// Mỗi tab = 1 lần tải file từ NCC đó, giữ đúng cột/tên cột như file gốc
// (không ép về schema chung).
type OpenRawMatch = (target: { batchId: string; rowIndex: number; idValue: string | null; paxLabel: string; matchStatus: MatchStatus | null }) => void

function RawBatchesView({ batches, onDelete, ncc, onOpenMatch, onSaveGia }: { batches: RawBatch[]; onDelete: (id: string) => void; ncc: string; onOpenMatch: OpenRawMatch; onSaveGia: (batchId: string, rowIndex: number, field: 'gia_mua' | 'gia_ban', value: number | null) => void }) {
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

  const tabBar = (
    <div className={`shrink-0 flex items-stretch gap-0.5 bg-gray-100 border border-t-0 border-gray-200 px-2 overflow-x-auto ${expanded ? '' : 'rounded-b-sm'}`}>
      {ordered.length === 0 ? (
        <span className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">Chưa có lần tải nào</span>
      ) : ordered.map(b => {
        const isActive = b.id === active?.id
        const label = b.source_file || 'Không rõ tên file'
        return (
          <button key={b.id} type="button" onClick={() => setActiveId(b.id)}
            title={`${label} · ${b.rows.length} dòng · ${new Date(b.created_at).toLocaleString('vi-VN')}`}
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
  )

  const table = active ? (
    <RawTableCard key={active.id} ncc={ncc} headers={active.headers} rows={active.rows}
      info={`${active.source_file || 'Không rõ tên file'} · ${active.rows.length} dòng · ${new Date(active.created_at).toLocaleString('vi-VN')}`}
      onDelete={() => onDelete(active.id)}
      matches={new Map(active.ve_debt_records_raw_match.map(m => [m.row_index, m]))}
      onSaveGia={(rowIndex, field, value) => onSaveGia(active.id, rowIndex, field, value)}
      expanded={expanded} onToggleExpand={() => setExpanded(e => !e)}
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
      expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} />
  )

  const body = (
    <div className={expanded ? 'fixed inset-0 z-[100] bg-white flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
      <div className="flex-1 min-h-0">{table}</div>
      {tabBar}
    </div>
  )

  return expanded && mounted ? createPortal(body, document.body) : body
}

type RawTableMatch = Pick<RawMatchInfo, 'ma_khach' | 'match_status' | 'gia_mua' | 'gia_ban' | 'gia_source'>

// Ô giá mua/giá bán cho bảng raw — mặc định hiện số + nhãn nhỏ "từ tin
// nhắn" khi gia_source==='message' (tự điền lúc khớp mã khách/chọn pax từ
// slide-over, xem match-ma-khach-raw.ts), bấm cây viết mới lộ ra ô nhập —
// tránh nhìn giống ô luôn-sửa-được như EditableNumberCell (dữ liệu ở đây
// coi là số chính thức ngay khi tự điền, không phải ô nháp).
function RawPriceCell({ value, source, onSave }: { value: number | null; source: 'message' | 'manual' | null; onSave: (v: number | null) => void }) {
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
const RAW_EXTRA_COLS = [
  { key: 'ma_khach', label: 'Mã khách', align: undefined as 'right' | undefined, width: 130 },
  { key: 'gia_mua', label: 'Giá mua', align: 'right' as const, width: 100 },
  { key: 'gia_ban', label: 'Giá bán', align: 'right' as const, width: 100 },
  { key: 'loi_nhuan', label: 'Lợi nhuận', align: 'right' as const, width: 100 },
]

function RawTableCard({ ncc, headers, rows, info, onDelete, matches, onOpenMatch, onSaveGia, expanded, onToggleExpand }: {
  ncc: string; headers: string[]; rows: string[][]; info: string; onDelete?: () => void
  matches: Map<number, RawTableMatch>; onOpenMatch: (rowIndex: number) => void
  onSaveGia: (rowIndex: number, field: 'gia_mua' | 'gia_ban', value: number | null) => void
  expanded: boolean; onToggleExpand: () => void
}) {
  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection((r, c) => rows[r]?.[c] ?? '')
  const idColIdx = findIdColumnIndex(headers)
  const paxColIdx = findPaxColumnIndex(headers)

  // Cột raw không cố định (đọc thẳng từ file NCC upload) nên key theo INDEX
  // thay vì tên cột — key theo tên dễ trùng/đổi giữa các lần upload khác
  // nhau. Lưu theo `raw-table-{ncc}` để việc kéo giãn cột "nhớ" lại đúng
  // cho từng tab NCC (FCVN/SAO ĐỎ/VIETJET/SUN PQC), dùng chung cho mọi lô
  // đã upload của cùng 1 NCC vì cấu trúc cột thường giống hệt nhau.
  const rawColDefaults: Record<string, number> = {}
  headers.forEach((_, i) => { rawColDefaults[String(i)] = 110 })
  for (const c of RAW_EXTRA_COLS) rawColDefaults[c.key] = c.width
  const { widths: rawWidths, startResize: startRawResize } = useResizableColumns(`raw-table-${ncc}`, rawColDefaults)
  const rawTotalWidth = headers.reduce((sum, _, i) => sum + (rawWidths[String(i)] ?? 110), 0)
    + (rows.length > 0 ? RAW_EXTRA_COLS.reduce((sum, c) => sum + (rawWidths[c.key] ?? c.width), 0) : 0)

  // Bảng CHOÁN HẾT chiều cao khung cha (h-full + min-h-0) thay vì max-h cố
  // định — khung cha (do RawBatchesView quyết định) đã bị chặn chiều cao
  // bởi layout cột của trang lúc bình thường, hoặc bằng cả màn hình lúc
  // "Phóng to" (RawBatchesView tự bọc fixed inset-0 + portal, bọc CẢ card
  // này lẫn thanh tab sheet — không tự làm ở đây nữa để thanh tab không bị
  // bỏ lại phía sau khi phóng to). Chỉ bo góc TRÊN lúc bình thường vì thanh
  // sheet nằm dính ngay dưới sẽ bo góc dưới; lúc phóng to bỏ bo góc luôn
  // (khít cả 4 cạnh màn hình).
  const content = (
    <div className={expanded ? 'bg-white flex flex-col h-full min-h-0 list-table-container' : 'bg-white border border-gray-100 rounded-t-sm shadow-sm list-table-container overflow-hidden flex flex-col h-full min-h-0'}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{info}</span>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button onClick={onDelete} title="Xoá lô này" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
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
              {headers.map((h, i) => (
                <th key={i} style={{ width: rawWidths[String(i)] ?? 110 }}
                  className="relative px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap overflow-hidden select-none">
                  {h || `Cột ${i + 1}`}
                  <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startRawResize(String(i), e)} />
                </th>
              ))}
              {rows.length > 0 && RAW_EXTRA_COLS.map(c => (
                <th key={c.key} style={{ width: rawWidths[c.key] ?? c.width }}
                  className={`relative px-2 py-1.5 font-semibold border border-gray-200 whitespace-nowrap overflow-hidden select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                  <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startRawResize(c.key, e)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r, i) => {
              const match = matches.get(i)
              return (
              <tr key={i} className="border-t border-gray-100">
                {headers.map((h, j) => {
                  const numericValue = j !== idColIdx && j !== paxColIdx ? parseRawNumericCell(r[j]) : null
                  return (
                  <td key={j}
                    {...cellProps(i, j)}
                    title={r[j] || undefined}
                    className={cellClassName(i, j, `border border-gray-100 px-2 py-1.5 text-gray-900 align-top cursor-cell overflow-hidden text-ellipsis ${numericValue != null ? 'text-right tabular-nums' : ''}`)}>
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
                })}
                <td className="border border-gray-100 px-2 py-1.5 align-top overflow-hidden">
                  <div className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer" onClick={() => onOpenMatch(i)}>
                    <MatchStatusBadge status={match?.match_status ?? 'unmatched'} dense onClick={() => onOpenMatch(i)} />
                    {match?.ma_khach || <span className="text-gray-300">Chưa có</span>}
                  </div>
                </td>
                <td className="relative border border-gray-100 p-0 align-top overflow-hidden">
                  <RawPriceCell value={match?.gia_mua ?? null} source={match?.gia_source ?? null} onSave={v => onSaveGia(i, 'gia_mua', v)} />
                </td>
                <td className="relative border border-gray-100 p-0 align-top overflow-hidden">
                  <RawPriceCell value={match?.gia_ban ?? null} source={match?.gia_source ?? null} onSave={v => onSaveGia(i, 'gia_ban', v)} />
                </td>
                <td className="border border-gray-100 px-2 py-1.5 align-top text-right overflow-hidden">
                  {match?.gia_mua != null && match?.gia_ban != null ? formatGiaVe(match.gia_ban - match.gia_mua) : '—'}
                </td>
              </tr>
              )
            }) : Array.from({ length: EMPTY_GRID_ROWS }).map((_, i) => (
              <tr key={i}>
                {headers.map((_, j) => <td key={j} className="border border-gray-100 h-8">&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return <>{content}{menu}</>
}

export default function CongNoVePage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload wizard
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [selectedSheet, setSelectedSheet] = useState<number | null>(null)
  const [rawGrid, setRawGrid] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  // Chỉ số (trong dataRows) của các dòng bị nghi là "rác" (tiêu đề phụ lặp
  // lại, dòng ngăn cách section...) nhưng kế toán đã bấm "Giữ dòng này" —
  // những dòng đó vẫn được nhập dù bị tô đỏ. Xem isLikelyJunkRow().
  const [keptJunkRows, setKeptJunkRows] = useState<Set<number>>(new Set())
  // Chiều ngược lại: dòng KHÔNG bị isLikelyJunkRow() tự phát hiện nhưng kế
  // toán nhìn thấy vẫn là rác — bấm "Bỏ dòng này" để tự thêm vào đây, loại
  // khỏi lượt nhập dù thuật toán bỏ sót.
  const [manualJunkRows, setManualJunkRows] = useState<Set<number>>(new Set())

  // Tab NCC đang xem — luôn có 1 trong 4 tab cố định được chọn (không còn
  // khái niệm "Tổng hợp" ở trang này nữa, xem /ve-may-bay/tong-hop-cong-no-ncc).
  const [nccFilter, setNccFilter] = useState(NCC_TABS[0])

  const [rematching, setRematching] = useState(false)
  const [viewingRawMatch, setViewingRawMatch] = useState<{ batchId: string; rowIndex: number; idValue: string | null; paxLabel: string; matchStatus: MatchStatus | null } | null>(null)
  // Tin nhắn đang chọn ở RawMatchPanel — đẩy lên đây để vẽ bảng hành khách
  // dạng bảng rộng bên phải (SelectedMessagePaxTable) thay vì card hẹp
  // trong panel bên trái, xem comment ở RawMatchPanel.tsx.
  const [selectedRawMessage, setSelectedRawMessage] = useState<{ message: RawCandidateMessage; khachInfo: RawKhachInfo } | null>(null)
  const { widths: rawPanelWidths, startResize: startRawPanelResize } = useResizableColumns('cong-no-raw-panel', { panel: 360 })
  const [resizingRawPanel, setResizingRawPanel] = useState(false)
  function startResizeRawPanel(e: React.MouseEvent) {
    setResizingRawPanel(true)
    startRawPanelResize('panel', e)
    const onUp = () => { setResizingRawPanel(false); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mouseup', onUp)
  }

  async function runRematch() {
    setRematching(true)
    try {
      await fetch('/api/ve-may-bay/cong-no-raw/match-ma-khach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      await loadRawData()
    } finally {
      setRematching(false)
    }
  }

  // Gán mã khách TAY cho 1 dòng trong lô raw (qua slide-over). matchedBookingId
  // khác null chỉ khi chọn từ 1 candidate cụ thể — giữ vết truy vết. giaMua/
  // giaBan đi kèm khi chọn đúng 1 pax cụ thể (có giá riêng từ tin nhắn) —
  // luôn ghi đè (khác auto-match chỉ điền khi đang rỗng) vì đây là hành động
  // kế toán chủ động chọn, không phải chạy nền tự động.
  async function saveRawMaKhachManual(batchId: string, rowIndex: number, maKhach: string, matchedBookingId: string | null, giaMua?: number | null, giaBan?: number | null) {
    const trimmed = maKhach.trim()
    const nextStatus: MatchStatus = trimmed ? 'manual' : 'unmatched'
    const hasGia = trimmed && matchedBookingId && (giaMua != null || giaBan != null)
    setRawBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      const existing = b.ve_debt_records_raw_match.find(m => m.row_index === rowIndex)
      const others = b.ve_debt_records_raw_match.filter(m => m.row_index !== rowIndex)
      return {
        ...b,
        ve_debt_records_raw_match: [
          ...others,
          {
            row_index: rowIndex,
            ma_khach: trimmed || null,
            match_status: nextStatus,
            matched_booking_id: trimmed ? matchedBookingId : null,
            gia_mua: hasGia ? (giaMua ?? existing?.gia_mua ?? null) : (existing?.gia_mua ?? null),
            gia_ban: hasGia ? (giaBan ?? existing?.gia_ban ?? null) : (existing?.gia_ban ?? null),
            gia_source: hasGia ? 'message' : (existing?.gia_source ?? null),
          },
        ],
      }
    }))
    const body: Record<string, unknown> = { ma_khach: trimmed, matched_booking_id: trimmed ? matchedBookingId : null }
    if (hasGia) {
      if (giaMua != null) body.gia_mua = giaMua
      if (giaBan != null) body.gia_ban = giaBan
    }
    await fetch(`/api/ve-may-bay/cong-no-raw/${batchId}/rows/${rowIndex}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  // Sửa tay 1 giá (bấm cây viết) — KHÔNG kèm matched_booking_id nên server
  // tự gắn gia_source='manual' (xem PATCH .../rows/[rowIndex]/route.ts).
  async function saveRawGiaManual(batchId: string, rowIndex: number, field: 'gia_mua' | 'gia_ban', value: number | null) {
    setRawBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      const existing = b.ve_debt_records_raw_match.find(m => m.row_index === rowIndex)
      const others = b.ve_debt_records_raw_match.filter(m => m.row_index !== rowIndex)
      return {
        ...b,
        ve_debt_records_raw_match: [
          ...others,
          {
            row_index: rowIndex,
            ma_khach: existing?.ma_khach ?? null,
            match_status: existing?.match_status ?? 'unmatched',
            matched_booking_id: existing?.matched_booking_id ?? null,
            gia_mua: field === 'gia_mua' ? value : (existing?.gia_mua ?? null),
            gia_ban: field === 'gia_ban' ? value : (existing?.gia_ban ?? null),
            gia_source: 'manual',
          },
        ],
      }
    }))
    await fetch(`/api/ve-may-bay/cong-no-raw/${batchId}/rows/${rowIndex}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  const [rawBatches, setRawBatches] = useState<RawBatch[]>([])

  const loadRawData = useCallback(async () => {
    try {
      const res = await fetch('/api/ve-may-bay/cong-no-raw')
      if (!res.ok) return
      const { data } = await res.json()
      setRawBatches(Array.isArray(data) ? data : [])
    } catch { /* im lặng — chỉ ảnh hưởng 4 tab NCC, không chặn trang */ }
  }, [setRawBatches])

  useEffect(() => {
    loadRawData()
  }, [loadRawData])

  async function deleteRawBatch(id: string) {
    if (!window.confirm('Xoá lô upload này? Không thể khôi phục.')) return
    try {
      await fetch(`/api/ve-may-bay/cong-no-raw/${id}`, { method: 'DELETE' })
      loadRawData()
    } catch { /* im lặng */ }
  }

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Đầu vào công nợ NCC</span>)
    setOnRefresh(loadRawData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadRawData])

  function resetWizard() {
    setSheets([]); setSelectedSheet(null); setRawGrid([]); setFileName('')
    setHeaderRowIndex(null); setImportError('')
    setKeptJunkRows(new Set()); setManualJunkRows(new Set())
    if (fileRef.current) fileRef.current.value = ''
  }

  // Sau khi có rawGrid (chọn xong sheet, hoặc file chỉ có 1 sheet/CSV) —
  // tự nhận diện đúng dòng tiêu đề + gợi ý sẵn tên NCC theo chữ ký
  // Vietjet/FCVN đã biết (đỡ phải tự cuộn/bấm chọn dòng tay), KHÔNG tự
  // tách sẵn cột — việc "biến đổi" (tách/chuẩn hoá cột) làm ở bước riêng
  // sau, cứ để rơi vào nhánh "chọn cột tay" như file NCC khác.
  function applyGrid(grid: string[][]) {
    setRawGrid(grid)
    const vjRow = findVietjetHeaderRow(grid)
    if (vjRow != null) {
      setHeaderRowIndex(vjRow)
      return
    }
    const fcvnRow = findFcvnHeaderRow(grid)
    if (fcvnRow != null) {
      setHeaderRowIndex(fcvnRow)
      return
    }
    setHeaderRowIndex(null)
  }

  async function handleFilePick(f: File) {
    setImportError('')
    setFileName(f.name)
    setSelectedSheet(null)
    setRawGrid([])
    setHeaderRowIndex(null)
    try {
      const isCsv = f.name.toLowerCase().endsWith('.csv')
      const isXls = f.name.toLowerCase().endsWith('.xls')
      if (isCsv) {
        const grid = parseCsvGrid(await f.text())
        if (grid.length === 0) { setImportError('File này không đọc được dòng nào.'); return }
        setSheets([{ name: f.name, grid }])
        setSelectedSheet(0)
        applyGrid(grid)
        return
      }
      const parsedSheets = (isXls ? await parseXlsFile(f) : await parseXlsxSheetsAny(f))
        .filter(s => s.grid.some(r => r?.some(c => c.trim() !== '')))
      if (parsedSheets.length === 0) {
        setImportError('File này không đọc được sheet/dòng nào.')
        return
      }
      setSheets(parsedSheets)
      if (parsedSheets.length === 1) {
        setSelectedSheet(0)
        applyGrid(parsedSheets[0].grid)
      }
    } catch {
      setImportError('Không đọc được file này — kiểm tra lại định dạng .xlsx/.xls/.csv.')
    }
  }

  function pickSheet(idx: number) {
    setSelectedSheet(idx)
    applyGrid(sheets[idx].grid)
  }

  function pickHeaderRow(idx: number) {
    setHeaderRowIndex(idx)
  }

  const dataRows = headerRowIndex == null ? [] : rawGrid.slice(headerRowIndex + 1).filter(r => r.some(c => c.trim() !== ''))
  const headers = headerRowIndex == null ? [] : (rawGrid[headerRowIndex] ?? [])
  const rawImportIdColIdx = findIdColumnIndex(headers)
  const junkRowIndexes = new Set(
    dataRows.reduce<number[]>((acc, r, i) => {
      const isJunk = isLikelyJunkRow(r, rawImportIdColIdx) ? !keptJunkRows.has(i) : manualJunkRows.has(i)
      if (isJunk) acc.push(i)
      return acc
    }, []),
  )
  const rowsToImport = dataRows.filter((_, i) => !junkRowIndexes.has(i))

  // Nhập không map cột — lưu y hệt header + dữ liệu thô của file gốc vào
  // ve_debt_records_raw. ncc lấy thẳng từ tab đang chọn (nccFilter).
  async function submitRaw() {
    const ncc = nccFilter
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/ve-may-bay/cong-no-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncc, source_file: fileName, headers, rows: rowsToImport }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Nhập thất bại' }))
        setImportError(error || 'Nhập thất bại')
        return
      }
      resetWizard()
      loadRawData()
    } catch {
      setImportError('Nhập thất bại, thử lại.')
    } finally {
      setImporting(false)
    }
  }

  return (
    // absolute inset-0 — <main> trong AppShell.tsx đã có "relative" nên khối
    // này phủ ĐÚNG BẰNG vùng nội dung (không hơn, không kém) → main không
    // sinh thanh cuộn dọc, mọi việc cuộn dồn vào trong bảng. Nhờ vậy thanh
    // "sheet" ở đáy luôn dính đáy màn hình và bảng lấp trọn phần còn lại,
    // giống Excel/Google Sheets (h-full/100% không dùng được ở đây vì chiều
    // cao của main do flex quyết định, không phải giá trị tường minh).
    <div className="absolute inset-0 flex flex-col px-5">
      {/* Tab NCC + nhập file + làm mới, cùng 1 dòng — cao bằng topbar
          (h-12 md:h-10, xem components/Topbar.tsx) và nằm sát topbar (không
          padding-top) để 2 thanh liền mạch nhau. */}
      <div className="shrink-0 min-h-12 md:min-h-10 flex items-center justify-between gap-3 flex-wrap border-b border-gray-200">
        <div className="flex items-center gap-1 flex-wrap">
          {NCC_TABS.map(n => (
            <button key={n} type="button"
              onClick={() => { setNccFilter(n); resetWizard() }}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                nccFilter === n ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePick(f) }} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} title="Nhập công nợ từ file"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 border border-gray-200 transition-colors">
            Tải file công nợ NCC
          </button>
          {fileName && <span className="text-xs text-gray-500 max-w-[140px] truncate" title={fileName}>{fileName}</span>}
          <button onClick={runRematch} disabled={rematching} title="Khớp lại mã khách theo tin nhắn Telegram"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {rematching && <Loader2 size={13} className="animate-spin" />} Tìm mã khách
          </button>
          <button onClick={loadRawData} title="Làm mới" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Nhập công nợ từ file — hiện dạng modal, chỉ khi có việc cần xử lý
          (chọn sheet/tiêu đề/cột...), không chiếm chỗ trên trang nữa. */}
      {(sheets.length > 0 || (importError && sheets.length === 0)) && createPortal(
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={resetWizard}>
      <div className="bg-white w-screen h-screen overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Nhập công nợ từ file</h2>
          <button onClick={resetWizard} title="Đóng" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        {importError && sheets.length === 0 && <p className="text-xs text-red-500">{importError}</p>}

        {sheets.length > 1 && selectedSheet == null && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500">
              File &quot;{fileName}&quot; có {sheets.length} sheet — chọn sheet cần nhập:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sheets.map((s, i) => (
                <button key={i} onClick={() => pickSheet(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white transition-colors">
                  {s.name} <span className="text-[10px] opacity-70">({s.grid.length} dòng)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSheet != null && rawGrid.length > 0 && headerRowIndex == null && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">
                Bấm chọn dòng nào là tiêu đề cột trong sheet &quot;{sheets[selectedSheet]?.name}&quot; (nhiều file công nợ hãng có mấy dòng thông tin công ty/ngày tháng phía trên, tiêu đề thật không phải lúc nào cũng ở dòng 1):
              </p>
              {sheets.length > 1 && (
                <button onClick={() => { setSelectedSheet(null); setRawGrid([]) }} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                  ← Chọn sheet khác
                </button>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-auto max-h-72">
              <table className="text-xs">
                <tbody>
                  {rawGrid.slice(0, 20).map((r, i) => (
                    <tr key={i} className="hover:bg-brand-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={() => pickHeaderRow(i)}>
                      <td className="px-2 py-1.5 text-gray-300 border-r border-gray-100 whitespace-nowrap sticky left-0 bg-white">
                        <button className="px-2 py-0.5 rounded bg-gray-100 hover:bg-brand-500 hover:text-white text-gray-500 font-semibold transition-colors">
                          Dòng {i + 1}
                        </button>
                      </td>
                      {r.slice(0, 12).map((c, j) => (
                        <td key={j} className="px-2 py-1.5 text-gray-600 whitespace-nowrap max-w-[160px] truncate">{c || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {headerRowIndex != null && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Nhập vào tab &quot;{nccFilter}&quot; — tiêu đề: dòng {headerRowIndex + 1} · {dataRows.length} dòng dữ liệu từ &quot;{fileName}&quot;.
                {junkRowIndexes.size > 0 && (
                  <span className="text-red-500 font-semibold"> · {junkRowIndexes.size} dòng tô đỏ bị nghi là rác (tiêu đề phụ/dòng ngăn cách), sẽ KHÔNG được nhập — bấm &quot;Giữ dòng này&quot; nếu vẫn muốn nhập.</span>
                )}
                {' '}Thấy dòng rác nào chưa bị tô đỏ? Rê chuột vào dòng đó, bấm &quot;Bỏ dòng này&quot; để loại luôn.
              </span>
              <button onClick={() => setHeaderRowIndex(null)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                ← Chọn lại dòng tiêu đề
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-auto max-h-[70vh]">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {rawImportIdColIdx != null && <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap"></th>}
                    {headers.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h || `Cột ${i + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((r, i) => {
                    const isJunk = junkRowIndexes.has(i)
                    const isAutoJunk = isLikelyJunkRow(r, rawImportIdColIdx)
                    return (
                    <tr key={i} className={`border-t border-gray-100 ${isJunk ? 'bg-red-50' : ''} group`}>
                      {rawImportIdColIdx != null && (
                        <td className="px-2 py-1.5 align-top">
                          {isJunk ? (
                            <button type="button"
                              onClick={() => isAutoJunk
                                ? setKeptJunkRows(prev => new Set(prev).add(i))
                                : setManualJunkRows(prev => { const next = new Set(prev); next.delete(i); return next })}
                              className="text-[10px] font-semibold text-red-600 hover:text-red-700 underline whitespace-nowrap">
                              Giữ dòng này
                            </button>
                          ) : (
                            <button type="button" onClick={() => setManualJunkRows(prev => new Set(prev).add(i))}
                              className="text-[10px] font-semibold text-gray-300 hover:text-red-600 underline whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                              Bỏ dòng này
                            </button>
                          )}
                        </td>
                      )}
                      {headers.map((h, j) => (
                        <td key={j} className={`px-2 py-1.5 align-top max-w-[200px] ${isJunk ? 'text-red-500' : ''}`}>
                          {h?.trim().toUpperCase() === 'SEGMENTS' ? (
                            <div className="space-y-0.5">
                              {splitSegmentsForDisplay(r[j]).map((seg, k) => <div key={k} className="whitespace-nowrap truncate">{seg}</div>)}
                            </div>
                          ) : (
                            <span className="whitespace-nowrap truncate block">{r[j] || '—'}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            <div className="flex items-center gap-2">
              <button onClick={submitRaw} disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {importing && <Loader2 size={14} className="animate-spin" />} Nhập {rowsToImport.length} dòng vào tab &quot;{nccFilter}&quot;
                {junkRowIndexes.size > 0 && <span className="opacity-75"> (đã bỏ {junkRowIndexes.size} dòng rác)</span>}
              </button>
              <button onClick={resetWizard} disabled={importing} type="button"
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors">
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
      </div>,
      document.body
      )}

      <div className="flex-1 min-h-0 flex items-stretch pt-2">
        <div
          className={`relative shrink-0 overflow-hidden ${resizingRawPanel ? '' : 'transition-[width,margin] duration-300 ease-out'} ${viewingRawMatch ? 'mr-4' : 'w-0 mr-0'}`}
          style={viewingRawMatch ? { width: rawPanelWidths.panel } : undefined}>
          <div style={{ width: rawPanelWidths.panel }}>
            <RawMatchPanel
              target={viewingRawMatch ? {
                id: `${viewingRawMatch.batchId}:${viewingRawMatch.rowIndex}`,
                ticketLabel: viewingRawMatch.idValue ?? 'Không có mã vé/PNR',
                contextLabel: viewingRawMatch.paxLabel,
                matchStatus: viewingRawMatch.matchStatus,
              } : null}
              candidatesUrl={viewingRawMatch ? `/api/ve-may-bay/cong-no-raw/${viewingRawMatch.batchId}/rows/${viewingRawMatch.rowIndex}/candidates` : null}
              onClose={() => setViewingRawMatch(null)}
              onSelectMessage={setSelectedRawMessage}
            />
          </div>
          {viewingRawMatch && (
            <div onMouseDown={startResizeRawPanel} title="Kéo để đổi độ rộng"
              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-300/50 active:bg-brand-400/60 transition-colors" />
          )}
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
          {selectedRawMessage && (
            <div className="shrink-0">
              <SelectedMessagePaxTable
                key={selectedRawMessage.message.parse_log_id}
                message={selectedRawMessage.message}
                khachInfo={selectedRawMessage.khachInfo}
                onChoose={(p, giaMua, giaBan) => p.ma_khach && viewingRawMatch && saveRawMaKhachManual(viewingRawMatch.batchId, viewingRawMatch.rowIndex, p.ma_khach, p.id, giaMua, giaBan)}
              />
            </div>
          )}
          <RawBatchesView batches={rawBatches.filter(b => b.ncc.trim().toUpperCase() === nccFilter.trim().toUpperCase())} onDelete={deleteRawBatch} ncc={nccFilter}
            onOpenMatch={setViewingRawMatch} onSaveGia={saveRawGiaManual} />
        </div>
      </div>
    </div>
  )
}
