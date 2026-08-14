'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Search, Trash2, Loader2, Table2, List, LayoutGrid, Maximize2, Minimize2, Check, X, Copy } from 'lucide-react'
import { tinhCongNo } from '@/lib/tinh-cong-no-ve'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useTopbar } from '@/contexts/topbar'

type DebtRow = {
  id: string
  ncc: string | null
  ticket_no: string | null
  pax_name: string | null
  issued_date: string | null
  payment_date: string | null
  departure_date: string | null
  return_date: string | null
  routing: string | null
  gia_mua: number | null
  cktm: number | null
  gia_ban: number | null
  com_khach: number | null
  tkt_tag: string | null
  ma_khach: string | null
  sale_chinh: string | null
  ghi_chu: string | null
  source_file: string | null
  created_at: string
}

function formatGiaVe(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN')
}

function formatPercent(n: number): string {
  return `${Math.round(n * 1000) / 10}%`
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

// Vé đoàn gộp nhiều pax vào 1 dòng dữ liệu (gặp ở file FCVN, vd "5 PAX
// ADT.05 + DAO, THI THAM + GIANG, QUYNH ANH + ... :") — theo quyết định
// lúc nhập, KHÔNG tách trong DB (số lượng pax không cố định, tự tách lúc
// import dễ sai) — chỉ tách hiển thị RIÊNG ở view Bảng cho dễ đọc, dữ
// liệu gốc trong DB vẫn nguyên 1 dòng/1 record. Không khớp mẫu "N PAX..."
// thì trả về mảng 1 phần tử (dòng bình thường, không đổi gì).
function splitPaxNames(paxName: string | null): string[] {
  const s = (paxName ?? '').trim()
  if (!/^\d+\s*PAX\b/i.test(s)) return [paxName ?? '']
  const names = s.split('+').slice(1).map(seg => seg.trim().replace(/:\s*$/, '').trim()).filter(Boolean)
  return names.length > 0 ? names : [paxName ?? '']
}

const REQUIRED_FIELDS = [
  { key: 'ticket_no', label: 'Mã vé' },
  { key: 'pax_name', label: 'Tên pax' },
  { key: 'issued_date', label: 'Ngày xuất vé' },
  { key: 'routing', label: 'Hành trình' },
  { key: 'gia_mua', label: 'Giá mua' },
] as const
const OPTIONAL_FIELDS = [
  { key: 'cktm', label: 'CKTM' },
  { key: 'gia_ban', label: 'Giá bán' },
  { key: 'com_khach', label: 'COM khách' },
] as const
type MapKey = typeof REQUIRED_FIELDS[number]['key'] | typeof OPTIONAL_FIELDS[number]['key']
const EMPTY_MAPPING: Record<MapKey, number | ''> = {
  ticket_no: '', pax_name: '', issued_date: '', routing: '', gia_mua: '', cktm: '', gia_ban: '', com_khach: '',
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

// ── Nhập liệu tối ưu riêng cho từng NCC (bắt đầu với Vietjet) ───────────────
// File công nợ gốc của Vietjet luôn cùng 1 cấu trúc cột cố định (đối chiếu
// từ file mẫu thật "CNO VIETJET 1.3T8.xlsx", 2026-08-04): PNR, PAX NAME,
// PAYMENT DATE, SEGMENTS, PAYMENT BY, TAKEN BY, ACCOUNT, AMOUNT CONVERT
// (VND), CURRENCY, AMOUNT CONVERT (VND) [lặp lại], Payment Identifier —
// nên nhận diện được bằng chữ ký 4 cột đầu, bỏ qua hẳn bước chọn dòng tiêu
// đề + map cột tay của wizard chung.
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

// SEGMENTS gộp chung ngày bay + hành trình trong 1 chuỗi, vd:
// "Aug 02, 2026 CXR - HAN CONF" → tách phần ngày (định dạng "Mon DD, YYYY"
// cố định) ra khỏi phần hành trình còn lại.
function splitVietjetSegments(segments: string): { flightDate: string; routing: string } {
  const m = (segments || '').match(/^([A-Za-z]{3}\s+\d{1,2},\s*\d{4})\s*(.*)$/)
  if (m) return { flightDate: m[1], routing: m[2].trim() }
  return { flightDate: '', routing: segments || '' }
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

// FCVN (đại lý bán vé nhiều hãng, không phải 1 hãng riêng như Vietjet) —
// đối chiếu từ file mẫu thật "CNO FCVN.XLS" (định dạng .xls nhị phân cũ,
// đọc bằng `xlsx`/SheetJS chứ không phải exceljs — xem parseXlsFile bên
// dưới). Header 2 tầng: dòng chữ (Order/Receipt Nbr./Issue date/Ticket
// Nbr./Pax Name/Route/T/Cust...) rồi 1 dòng ký hiệu phụ (A/B/C/D...) ngay
// dưới — nhận diện bằng dòng chữ. Dữ liệu xen lẫn các dòng tiêu đề nhóm
// ("Domestic Flights", "VIETNAM AIRLINES - VN"...) và dòng tổng/đối
// chiếu cuối bảng — lọc bằng quy tắc CHUNG: chỉ dòng nào cột "Order" là
// số nguyên dương mới là dòng dữ liệu thật (dòng nhóm/dòng phụ/dòng tổng
// đều để trống cột này) — 1 quy tắc lọc được hết mọi loại dòng rác.
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

function isFcvnDataRow(row: string[]): boolean {
  return /^\d+$/.test((row[0] ?? '').trim())
}

// "Issue date" gộp 3 ngày trong 1 chuỗi: ngày xuất vé - ngày bay đi -
// ngày bay về (đã xác nhận với user 2026-08-04), vd:
// "01/08/2026 - 04/08/2026 - 04/08/2026".
function splitFcvnIssueDate(raw: string): { issued: string; departure: string; returnDate: string } {
  const parts = (raw || '').split(/\s*-\s*/).map(s => s.trim()).filter(Boolean)
  return { issued: parts[0] ?? '', departure: parts[1] ?? '', returnDate: parts[2] ?? '' }
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

type KhachOpt = { ma_khach: string; ten_khach: string | null }

const SELECT ='border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400'

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
const CELL_INPUT = 'w-full bg-transparent text-xs px-1 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white'

// `suggestions` (nếu có) hiện qua dropdown tự vẽ thay vì <datalist> gốc
// trình duyệt (xấu, không style được, có mã trùng/không đọc được như báo
// lỗi) — vẫn là input tự do, gõ giá trị mới chưa có trong danh sách vẫn
// lưu bình thường, dropdown chỉ để chọn nhanh từ gợi ý cho đỡ gõ trùng/lệch.
function EditableCell({ value, onSave, placeholder, align, suggestions }: { value: string | null; onSave: (v: string) => void; placeholder?: string; align?: 'right'; suggestions?: string[] }) {
  const [v, setV] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setV(value ?? ''), [value])

  useEffect(() => {
    if (!suggestions) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setV(cur => { if (cur !== (value ?? '')) onSave(cur); return cur })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [suggestions, value, onSave])

  if (!suggestions) {
    return (
      <input value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== (value ?? '')) onSave(v) }}
        className={`${CELL_INPUT} ${align === 'right' ? 'text-right' : ''}`} />
    )
  }

  const q = v.trim().toLowerCase()
  const filtered = (q ? suggestions.filter(s => s.toLowerCase().includes(q)) : suggestions).slice(0, 50)

  function choose(s: string) {
    setV(s)
    setOpen(false)
    if (s !== (value ?? '')) onSave(s)
  }

  return (
    <div className="relative" ref={ref}>
      <input value={v} placeholder={placeholder}
        onChange={e => { setV(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') { setOpen(false); if (v !== (value ?? '')) onSave(v) }
          if (e.key === 'Escape') setOpen(false)
        }}
        className={`${CELL_INPUT} ${align === 'right' ? 'text-right' : ''}`} />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto w-56">
          {filtered.map(s => (
            <button key={s} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(s)}
              className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors truncate">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Ô "Tìm mã khách" riêng — khác EditableCell ở chỗ mở MODAL to giữa màn
// hình (không phải dropdown nhỏ neo dưới ô) và hiện kèm tên đầy đủ, vì
// danh mục khách hàng VMB giờ đã có tên (xem migration_vmb_khach_hang.sql),
// không chỉ có mã trơn như trước — vẫn cho gõ tự do, chọn trong danh sách
// chỉ để điền nhanh.
function MaKhachCell({ value, onSave, options }: { value: string | null; onSave: (v: string) => void; options: KhachOpt[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function openModal() {
    setQ('')
    setOpen(true)
  }

  function choose(ma: string) {
    setOpen(false)
    if (ma !== (value ?? '')) onSave(ma)
  }

  const qLower = q.trim().toLowerCase()
  const filtered = qLower
    ? options.filter(o => o.ma_khach.toLowerCase().includes(qLower) || (o.ten_khach ?? '').toLowerCase().includes(qLower))
    : options

  return (
    <>
      <button type="button" onClick={openModal}
        className={`${CELL_INPUT} text-left truncate ${value ? '' : 'text-gray-300'}`}>
        {value || 'Tìm mã khách...'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && q.trim()) choose(q.trim()) }}
                placeholder="Tìm mã khách hoặc tên khách..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Không tìm thấy trong danh mục.
                  {q.trim() && (
                    <button onClick={() => choose(q.trim())}
                      className="block mx-auto mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Dùng nguyên văn &quot;{q.trim()}&quot;
                    </button>
                  )}
                </div>
              ) : (
                filtered.map(o => {
                  const isSelected = o.ma_khach === value
                  return (
                    <div key={o.ma_khach} onClick={() => choose(o.ma_khach)}
                      className={`w-full px-5 py-3 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 cursor-pointer ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                      <div>
                        <div className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-800'}`}>{o.ma_khach}</div>
                        {o.ten_khach && <div className="text-xs text-gray-400 mt-0.5">{o.ten_khach}</div>}
                      </div>
                      {isSelected ? (
                        <button type="button" title="Bỏ chọn" onClick={e => { e.stopPropagation(); choose('') }}
                          className="flex-shrink-0 p-1.5 rounded-lg text-brand-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <X size={16} />
                        </button>
                      ) : (
                        <Check size={16} className="text-transparent flex-shrink-0" />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

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

type ViewMode = 'bang' | 'list' | 'card'

// Lô công nợ NCC upload nguyên xi (chưa chuẩn hoá) — dùng cho 4 tab NCC cố
// định (FCVN/SAO ĐỎ/VIETJET/SUN PQC), giữ đúng cột như file gốc.
type RawBatch = {
  id: string
  ncc: string
  source_file: string | null
  headers: string[]
  rows: string[][]
  created_at: string
}

export default function CongNoVePage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<DebtRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('bang')

  // Upload wizard
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [selectedSheet, setSelectedSheet] = useState<number | null>(null)
  const [rawGrid, setRawGrid] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)
  const [mapping, setMapping] = useState<Record<MapKey, number | ''>>(EMPTY_MAPPING)
  const [nccInput, setNccInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [vietjetMode, setVietjetMode] = useState(false)
  const [fcvnMode, setFcvnMode] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [nccFilter, setNccFilter] = useState('')
  const [tktFilter, setTktFilter] = useState('')
  const [khFilter, setKhFilter] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/cong-no')
      if (!res.ok) throw new Error('load failed')
      const { data } = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const [rawBatches, setRawBatches] = useState<RawBatch[]>([])

  const loadRawData = useCallback(async () => {
    try {
      const res = await fetch('/api/ve-may-bay/cong-no-raw')
      if (!res.ok) return
      const { data } = await res.json()
      setRawBatches(Array.isArray(data) ? data : [])
    } catch { /* im lặng — chỉ ảnh hưởng 4 tab NCC, không chặn trang */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRawData()
  }, [loadRawData])

  const loadAll = useCallback(() => {
    loadData()
    loadRawData()
  }, [loadData, loadRawData])

  async function deleteRawBatch(id: string) {
    if (!window.confirm('Xoá lô upload này? Không thể khôi phục.')) return
    try {
      await fetch(`/api/ve-may-bay/cong-no-raw/${id}`, { method: 'DELETE' })
      loadRawData()
    } catch { /* im lặng */ }
  }

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Công nợ NCC</span>)
    setOnRefresh(loadAll)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadAll])

  // Danh mục để gợi ý autocomplete cho "Tìm mã khách/TKT/sale chính" — kéo
  // từ nguồn CHUẨN thay vì chỉ suy ra từ các dòng đã gắn tay trong chính
  // bảng này (rows hầu hết còn trống 3 trường này nên tự suy ra gần như
  // rỗng): mã khách lấy từ /ve-may-bay/vmb-khach-hang (danh mục chuẩn có
  // tên đầy đủ, xem migration_vmb_khach_hang.sql — thay cho
  // /ve-may-bay/khach-hang-vmb cũ, chỉ có mã không có tên), TKT lấy từ bảng
  // ve_tkt thật, sale chính lấy từ danh sách nhân viên (users,
  // is_active=true) — RLS bảng users đã cho authenticated đọc thẳng, cùng
  // cách trang /nhan-vien đang dùng.
  const [dirMaKhach, setDirMaKhach] = useState<KhachOpt[]>([])
  const [dirTkt, setDirTkt] = useState<string[]>([])
  const [dirSaleChinh, setDirSaleChinh] = useState<string[]>([])

  const loadDirectories = useCallback(async () => {
    try {
      const res = await fetch('/api/ve-may-bay/vmb-khach-hang')
      const { data } = await res.json()
      if (Array.isArray(data)) setDirMaKhach(data.map((d: { ma_khach: string; ten_khach: string | null }) => ({ ma_khach: d.ma_khach, ten_khach: d.ten_khach })).filter((d: KhachOpt) => d.ma_khach))
    } catch { /* im lặng — chỉ ảnh hưởng gợi ý, không chặn trang */ }

    try {
      const res = await fetch('/api/ve-may-bay/tkt')
      const { data } = await res.json()
      if (Array.isArray(data)) setDirTkt(data.filter((t: { active: boolean }) => t.active).map((t: { tkt_code: string }) => t.tkt_code).filter(Boolean))
    } catch { /* im lặng */ }

    try {
      const res = await fetch('/api/ve-may-bay/users')
      const { data } = await res.json()
      if (Array.isArray(data)) setDirSaleChinh(data.map((u: { full_name: string }) => u.full_name).filter(Boolean))
    } catch { /* im lặng */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDirectories()
  }, [loadDirectories])

  function resetWizard() {
    setSheets([]); setSelectedSheet(null); setRawGrid([]); setFileName('')
    setHeaderRowIndex(null); setMapping(EMPTY_MAPPING); setNccInput(''); setImportError('')
    setVietjetMode(false); setFcvnMode(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Sau khi có rawGrid (chọn xong sheet, hoặc file chỉ có 1 sheet/CSV) —
  // vẫn TỰ NHẬN DIỆN đúng dòng tiêu đề + tên NCC theo chữ ký Vietjet/FCVN đã
  // biết (đỡ phải tự cuộn/bấm chọn dòng tay), nhưng KHÔNG tự tách sẵn cột
  // (ngày bay/hành trình từ SEGMENTS, ngày xuất/đi/về từ issue date FCVN...)
  // nữa — luồng chung giờ là xem nguyên xi/map cột tay, việc "biến đổi"
  // (tách/chuẩn hoá cột) làm ở bước riêng sau. Vì vậy KHÔNG bật
  // vietjetMode/fcvnMode (2 cờ đó vẫn giữ, chỉ dùng lại khi làm bước biến
  // đổi) — cứ để rơi vào nhánh "chọn cột tay" như file NCC khác.
  function applyGrid(grid: string[][]) {
    setRawGrid(grid)
    const vjRow = findVietjetHeaderRow(grid)
    if (vjRow != null) {
      setHeaderRowIndex(vjRow)
      setNccInput('Vietjet')
      return
    }
    const fcvnRow = findFcvnHeaderRow(grid)
    if (fcvnRow != null) {
      setHeaderRowIndex(fcvnRow)
      setNccInput('FCVN')
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
    setMapping(EMPTY_MAPPING)
    setVietjetMode(false)
    setFcvnMode(false)
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
    setMapping(EMPTY_MAPPING)
    applyGrid(sheets[idx].grid)
  }

  function pickHeaderRow(idx: number) {
    setHeaderRowIndex(idx)
    setVietjetMode(false)
    setFcvnMode(false)
    const headers = rawGrid[idx] ?? []
    const guess: Record<MapKey, number | ''> = { ...EMPTY_MAPPING }
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^\x00-\x7f]/g, '')
    headers.forEach((h, i) => {
      const n = norm(h)
      if (guess.ticket_no === '' && /ve|ticket|pnr|code/.test(n)) guess.ticket_no = i
      if (guess.pax_name === '' && /pax|khach|ten/.test(n)) guess.pax_name = i
      if (guess.issued_date === '' && /xuat|issue/.test(n)) guess.issued_date = i
      if (guess.routing === '' && /hanh trinh|routing|chang|segment/.test(n)) guess.routing = i
      if (guess.gia_mua === '' && /gia mua|fare|price|tien|amount/.test(n)) guess.gia_mua = i
      if (guess.cktm === '' && /cktm|chiet khau/.test(n)) guess.cktm = i
      if (guess.gia_ban === '' && /gia ban/.test(n)) guess.gia_ban = i
      if (guess.com_khach === '' && /com khach|hoa hong/.test(n)) guess.com_khach = i
    })
    setMapping(guess)
  }

  const dataRows = headerRowIndex == null ? [] : rawGrid.slice(headerRowIndex + 1).filter(r => r.some(c => c.trim() !== ''))
  const headers = headerRowIndex == null ? [] : (rawGrid[headerRowIndex] ?? [])

  // Vị trí cột cố định theo đúng file mẫu Vietjet — xem findVietjetHeaderRow.
  // Lưu ý tên cột trong file gốc GÂY NHẦM: cột "PAYMENT DATE" (r[2]) thực
  // chất là ngày xuất vé của Vietjet, không phải ngày thanh toán (Vietjet
  // không có khái niệm ngày thanh toán riêng trong file này) — còn ngày
  // tách được từ SEGMENTS (r[3]) là ngày bay đi, không phải ngày xuất vé.
  const vietjetRows = !vietjetMode ? [] : dataRows.map(r => {
    const { flightDate, routing } = splitVietjetSegments(r[3] ?? '')
    return {
      ticket_no: r[0] ?? '',
      pax_name: r[1] ?? '',
      issued_date: r[2] ?? '',
      departure_date: flightDate,
      routing,
      gia_mua: parseVndNumber(r[7] ?? ''),
    }
  })

  async function submitVietjetImport() {
    if (!nccInput.trim()) {
      setImportError('Chưa nhập NCC (nhà cung cấp) cho lô này.')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/ve-may-bay/cong-no', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncc: nccInput.trim(), source_file: fileName, rows: vietjetRows }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Nhập thất bại' }))
        setImportError(error || 'Nhập thất bại')
        return
      }
      resetWizard()
      loadData()
    } catch {
      setImportError('Nhập thất bại, thử lại.')
    } finally {
      setImporting(false)
    }
  }

  // Vị trí cột cố định theo đúng file mẫu FCVN — xem findFcvnHeaderRow.
  // Lọc bỏ dòng nhóm/dòng phụ/dòng tổng bằng isFcvnDataRow (Order phải là
  // số nguyên dương) — dataRows (lọc "not all-empty" chung) không đủ vì
  // các dòng đó vẫn có vài ô không rỗng (tên hãng, chữ "Total"...).
  const fcvnRows = !fcvnMode ? [] : dataRows.filter(isFcvnDataRow).map(r => {
    const { issued, departure, returnDate } = splitFcvnIssueDate(r[2] ?? '')
    return {
      ticket_no: r[3] ?? '',
      pax_name: r[4] ?? '',
      issued_date: issued,
      departure_date: departure,
      return_date: returnDate,
      routing: r[5] ?? '',
      gia_mua: parseVndNumber(r[16] ?? ''),
    }
  })

  async function submitFcvnImport() {
    if (!nccInput.trim()) {
      setImportError('Chưa nhập NCC (nhà cung cấp) cho lô này.')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/ve-may-bay/cong-no', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncc: nccInput.trim(), source_file: fileName, rows: fcvnRows }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Nhập thất bại' }))
        setImportError(error || 'Nhập thất bại')
        return
      }
      resetWizard()
      loadData()
    } catch {
      setImportError('Nhập thất bại, thử lại.')
    } finally {
      setImporting(false)
    }
  }

  async function submitImport() {
    const missing = REQUIRED_FIELDS.filter(f => mapping[f.key] === '')
    if (missing.length > 0) {
      setImportError(`Chưa chọn cột cho: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    if (!nccInput.trim()) {
      setImportError('Chưa nhập NCC (nhà cung cấp) cho lô này.')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const importRows = dataRows.map(r => ({
        ticket_no: r[mapping.ticket_no as number] ?? '',
        pax_name: r[mapping.pax_name as number] ?? '',
        issued_date: r[mapping.issued_date as number] ?? '',
        routing: r[mapping.routing as number] ?? '',
        gia_mua: parseVndNumber(r[mapping.gia_mua as number] ?? ''),
        cktm: mapping.cktm === '' ? null : parseVndNumber(r[mapping.cktm as number] ?? ''),
        gia_ban: mapping.gia_ban === '' ? null : parseVndNumber(r[mapping.gia_ban as number] ?? ''),
        com_khach: mapping.com_khach === '' ? null : parseVndNumber(r[mapping.com_khach as number] ?? ''),
      }))
      const res = await fetch('/api/ve-may-bay/cong-no', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncc: nccInput.trim(), source_file: fileName, rows: importRows }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Nhập thất bại' }))
        setImportError(error || 'Nhập thất bại')
        return
      }
      resetWizard()
      loadData()
    } catch {
      setImportError('Nhập thất bại, thử lại.')
    } finally {
      setImporting(false)
    }
  }

  // Nhập không map cột — lưu y hệt header + dữ liệu thô của file gốc vào
  // ve_debt_records_raw. Dùng cho cả 4 tab NCC cố định (ncc = nccFilter)
  // lẫn tab "Tổng hợp" (ncc = nhập tay/tự nhận diện qua nccInput) — việc
  // chuẩn hoá về định dạng chung cho Tổng hợp làm ở bước riêng sau.
  async function submitRaw() {
    const ncc = nccFilter || nccInput.trim()
    if (!ncc) {
      setImportError('Chưa nhập NCC (nhà cung cấp) cho lô này.')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/ve-may-bay/cong-no-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncc, source_file: fileName, headers, rows: dataRows }),
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

  async function saveField(id: string, field: 'tkt_tag' | 'ma_khach' | 'sale_chinh' | 'ghi_chu', value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value || null } : r))
    await fetch(`/api/ve-may-bay/cong-no/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function saveNumberField(id: string, field: 'gia_mua' | 'cktm' | 'gia_ban' | 'com_khach', value: number | null) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await fetch(`/api/ve-may-bay/cong-no/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/ve-may-bay/cong-no/${id}`, { method: 'DELETE' })
  }

  // So khớp không phân biệt hoa/thường/khoảng trắng — tab NCC cố định
  // (FCVN/SAO ĐỎ/VIETJET/SUN PQC) chưa chắc khớp Y HỆT cách viết hoa/thường
  // đã lưu trong dữ liệu (vd "Vietjet" lúc nhập file vs tab "VIETJET").
  const byNcc = rows.filter(r => !nccFilter || (r.ncc ?? '').trim().toUpperCase() === nccFilter.trim().toUpperCase())
  const tkts = Array.from(new Set(byNcc.map(r => r.tkt_tag).filter(Boolean))) as string[]
  const byTkt = byNcc.filter(r => !tktFilter || r.tkt_tag === tktFilter)
  const khs = Array.from(new Set(byTkt.map(r => r.ma_khach).filter(Boolean))) as string[]
  const byKh = byTkt.filter(r => !khFilter || r.ma_khach === khFilter)

  const filtered = byKh.filter(r => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const hay = [r.ticket_no, r.pax_name, r.routing, r.ncc, r.tkt_tag, r.ma_khach].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })

  const tongLoiNhuan = filtered.reduce((s, r) => s + tinhCongNo(r).loi_nhuan, 0)

  // Gợi ý autocomplete cho ô "Tìm TKT"/"Tìm mã khách"/"Tìm sale chính" —
  // hợp cả danh mục CHUẨN (dirTkt/dirMaKhach/dirSaleChinh, xem loadDirectories)
  // VÀ giá trị đã từng gắn tay trong chính bảng này (rows), phòng khi có
  // tag cũ không khớp danh mục chuẩn (gõ tự do trước khi có autocomplete).
  const allTktTags = Array.from(new Set([...dirTkt, ...rows.map(r => r.tkt_tag).filter(Boolean) as string[]]))
  const allMaKhach: KhachOpt[] = (() => {
    const map = new Map<string, KhachOpt>()
    for (const d of dirMaKhach) map.set(d.ma_khach.toUpperCase(), d)
    for (const r of rows) {
      if (r.ma_khach && !map.has(r.ma_khach.toUpperCase())) map.set(r.ma_khach.toUpperCase(), { ma_khach: r.ma_khach, ten_khach: null })
    }
    return Array.from(map.values()).sort((a, b) => a.ma_khach.localeCompare(b.ma_khach))
  })()
  const allSaleChinh = Array.from(new Set([...dirSaleChinh, ...rows.map(r => r.sale_chinh).filter(Boolean) as string[]]))

  return (
    <div className="p-5 space-y-4">
      {/* Tab NCC + nhập file + làm mới, cùng 1 dòng */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-200">
        <div className="flex items-center gap-1 flex-wrap">
          {(['', ...NCC_TABS] as const).map(n => (
            <button key={n || 'tong-hop'} type="button"
              onClick={() => { setNccFilter(n); setTktFilter(''); setKhFilter(''); resetWizard() }}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                nccFilter === n ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {n || 'Tổng hợp'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePick(f) }} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} title="Nhập công nợ từ file"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 border border-gray-200 transition-colors">
            Tải file công nợ NCC
          </button>
          {fileName && <span className="text-xs text-gray-500 max-w-[140px] truncate" title={fileName}>{fileName}</span>}
          <button onClick={loadAll} title="Làm mới" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Nhập công nợ từ file — hiện dạng modal, chỉ khi có việc cần xử lý
          (chọn sheet/tiêu đề/cột...), không chiếm chỗ trên trang nữa. */}
      {(sheets.length > 0 || (importError && sheets.length === 0)) && createPortal(
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={resetWizard}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
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

        {headerRowIndex != null && vietjetMode && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-600">
                ✓ Nhận diện: file công nợ Vietjet — tự tách sẵn ngày bay/hành trình từ SEGMENTS, {vietjetRows.length} dòng dữ liệu từ &quot;{fileName}&quot;.
              </p>
              <button onClick={() => { setVietjetMode(false); setHeaderRowIndex(null) }} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                Không phải Vietjet? Chọn cột thủ công
              </button>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 mb-1">NCC (nhà cung cấp) *</label>
              <input value={nccInput} onChange={e => setNccInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="border border-gray-200 rounded-xl overflow-auto max-h-72">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {['Mã vé (PNR)', 'Pax', 'Ngày xuất vé', 'Ngày bay đi', 'Hành trình', 'Giá mua'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vietjetRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.ticket_no || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.pax_name || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.issued_date || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.departure_date || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.routing || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">{r.gia_mua != null ? r.gia_mua.toLocaleString('vi-VN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            <div className="flex items-center gap-2">
              <button onClick={submitVietjetImport} disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {importing && <Loader2 size={14} className="animate-spin" />} Nhập {vietjetRows.length} dòng vào hệ thống
              </button>
              <button onClick={resetWizard} disabled={importing} type="button"
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors">
                Hủy
              </button>
            </div>
          </div>
        )}

        {headerRowIndex != null && fcvnMode && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-600">
                ✓ Nhận diện: file công nợ FCVN — tự tách sẵn ngày xuất/ngày bay đi/về, bỏ qua dòng tiêu đề nhóm hãng, {fcvnRows.length} dòng dữ liệu từ &quot;{fileName}&quot;.
              </p>
              <button onClick={() => { setFcvnMode(false); setHeaderRowIndex(null) }} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                Không phải FCVN? Chọn cột thủ công
              </button>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 mb-1">NCC (nhà cung cấp) *</label>
              <input value={nccInput} onChange={e => setNccInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="border border-gray-200 rounded-xl overflow-auto max-h-72">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {['Mã vé', 'Pax', 'Ngày xuất', 'Ngày bay đi', 'Ngày bay về', 'Hành trình', 'Giá mua'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fcvnRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.ticket_no || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.pax_name || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.issued_date || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.departure_date || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.return_date || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.routing || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">{r.gia_mua != null ? r.gia_mua.toLocaleString('vi-VN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            <div className="flex items-center gap-2">
              <button onClick={submitFcvnImport} disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {importing && <Loader2 size={14} className="animate-spin" />} Nhập {fcvnRows.length} dòng vào hệ thống
              </button>
              <button onClick={resetWizard} disabled={importing} type="button"
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors">
                Hủy
              </button>
            </div>
          </div>
        )}

        {headerRowIndex != null && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {nccFilter ? `Nhập vào tab "${nccFilter}"` : 'Nhập vào tab "Tổng hợp"'} — tiêu đề: dòng {headerRowIndex + 1} · {dataRows.length} dòng dữ liệu từ &quot;{fileName}&quot;.
              </span>
              <button onClick={() => setHeaderRowIndex(null)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                ← Chọn lại dòng tiêu đề
              </button>
            </div>

            {!nccFilter && (
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-gray-500 mb-1">NCC (nhà cung cấp) *</label>
                <input value={nccInput} onChange={e => setNccInput(e.target.value)} placeholder="VD: Vietnam Airlines, Đại lý ABC..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            )}

            <div className="border border-gray-200 rounded-xl overflow-auto max-h-72">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {headers.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h || `Cột ${i + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {headers.map((h, j) => (
                        <td key={j} className="px-2 py-1.5 align-top max-w-[200px]">
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
                  ))}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            <div className="flex items-center gap-2">
              <button onClick={submitRaw} disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {importing && <Loader2 size={14} className="animate-spin" />} Nhập {dataRows.length} dòng vào tab &quot;{nccFilter || nccInput || '—'}&quot;
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

      {nccFilter === '' ? (
        <>
          {/* Filters + view mode */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã vé, pax, NCC..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <select value={tktFilter} onChange={e => { setTktFilter(e.target.value); setKhFilter('') }} className={SELECT}>
              <option value="">Tất cả TKT</option>
              {tkts.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={khFilter} onChange={e => setKhFilter(e.target.value)} className={SELECT}>
              <option value="">Tất cả khách hàng</option>
              {khs.map(k => <option key={k} value={k}>{k}</option>)}
            </select>

            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {([
                { key: 'bang', icon: Table2, title: 'Bảng (giống Excel)' },
                { key: 'list', icon: List, title: 'Danh sách' },
                { key: 'card', icon: LayoutGrid, title: 'Thẻ' },
              ] as const).map(v => (
                <button key={v.key} title={v.title} onClick={() => setViewMode(v.key)}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === v.key ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <v.icon size={14} />
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} dòng · lợi nhuận {formatGiaVe(tongLoiNhuan)}</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center text-gray-300">Đang tải...</div>
          ) : loadError ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
              <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
              <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center text-gray-400">Chưa có dòng công nợ nào — upload file ở trên để bắt đầu.</div>
          ) : viewMode === 'bang' ? (
            <BangExcelView rows={filtered} onSaveField={saveField} onSaveNumberField={saveNumberField} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} saleChinhSuggestions={allSaleChinh} />
          ) : viewMode === 'list' ? (
            <ListView rows={filtered} onSaveField={saveField} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} saleChinhSuggestions={allSaleChinh} />
          ) : (
            <CardView rows={filtered} onSaveField={saveField} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} />
          )}
        </>
      ) : (
        <RawBatchesView batches={rawBatches.filter(b => b.ncc.trim().toUpperCase() === nccFilter.trim().toUpperCase())} onDelete={deleteRawBatch} ncc={nccFilter} />
      )}
    </div>
  )
}

// Danh sách các lô upload nguyên xi của 1 tab NCC — mỗi lô 1 bảng riêng,
// giữ đúng cột/tên cột như file gốc (không ép về schema chung).
function RawBatchesView({ batches, onDelete, ncc }: { batches: RawBatch[]; onDelete: (id: string) => void; ncc: string }) {
  if (batches.length === 0) {
    return <RawTableCard headers={NCC_HEADER_HINTS[ncc] ?? []} rows={[]} info="Chưa có dữ liệu" />
  }
  return (
    <div className="space-y-4">
      {batches.map(b => (
        <RawTableCard key={b.id} headers={b.headers} rows={b.rows}
          info={`${b.source_file || 'Không rõ tên file'} · ${b.rows.length} dòng · ${new Date(b.created_at).toLocaleString('vi-VN')}`}
          onDelete={() => onDelete(b.id)} />
      ))}
    </div>
  )
}

// Khung bảng dùng chung cho cả lô đã upload lẫn tab chưa có dữ liệu (rows
// rỗng → tự kẻ lưới trống theo đúng số cột header) — có cùng thanh đếm
// dòng + nút "Phóng to" (portal thẳng document.body, giống BangExcelView)
// như bảng "Tổng hợp" để đồng nhất trải nghiệm giữa các tab.
function RawTableCard({ headers, rows, info, onDelete }: { headers: string[]; rows: string[][]; info: string; onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Chọn vùng ô kiểu Excel (kéo chuột chọn hình chữ nhật hàng×cột) rồi
  // Ctrl+C copy đúng vùng đó dạng TSV — thay cho bôi đen văn bản mặc định
  // của trình duyệt (chạy theo thứ tự DOM nên lem sang ô/dòng khác, không
  // theo đúng hình chữ nhật người dùng kéo).
  const [selStart, setSelStart] = useState<{ r: number; c: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ r: number; c: number } | null>(null)
  const selecting = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stop = () => { selecting.current = false }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const selBounds = selStart && selEnd ? {
    r0: Math.min(selStart.r, selEnd.r), r1: Math.max(selStart.r, selEnd.r),
    c0: Math.min(selStart.c, selEnd.c), c1: Math.max(selStart.c, selEnd.c),
  } : null
  const isSelected = (r: number, c: number) => !!selBounds && r >= selBounds.r0 && r <= selBounds.r1 && c >= selBounds.c0 && c <= selBounds.c1

  function startSelect(r: number, c: number) {
    selecting.current = true
    setSelStart({ r, c })
    setSelEnd({ r, c })
    wrapRef.current?.focus()
  }
  function extendSelect(r: number, c: number) {
    if (selecting.current) setSelEnd({ r, c })
  }
  function copySelection() {
    if (!selBounds) return
    // Ô SEGMENTS (và có thể vài cột khác) chứa xuống dòng thật trong dữ
    // liệu gốc — nếu để nguyên, Excel hiểu nhầm ký tự xuống dòng đó là bắt
    // đầu 1 dòng bảng tính mới, làm lệch hẳn các cột phía sau khi dán. Bọc
    // trong dấu ngoặc kép (đúng chuẩn escape CSV/TSV) để Excel giữ nguyên
    // trong 1 ô như khi copy thật từ Excel ra.
    const esc = (v: string) => {
      const s = v ?? ''
      return /[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const tsv = rows.slice(selBounds.r0, selBounds.r1 + 1)
      .map(r => r.slice(selBounds.c0, selBounds.c1 + 1).map(c => esc(c)).join('\t'))
      .join('\r\n')
    navigator.clipboard.writeText(tsv).catch(() => {})
  }

  // Menu chuột phải — chỉ có 1 nút "Sao chép" copy đúng vùng đang chọn
  // (bấm chuột phải ngoài vùng đang chọn thì thu vùng chọn về đúng 1 ô đó
  // trước, giống hành vi Excel).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [ctxMenu])
  function handleContextMenu(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault()
    if (!isSelected(r, c)) { setSelStart({ r, c }); setSelEnd({ r, c }) }
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const content = (
    <div className={expanded ? 'fixed inset-0 z-[100] bg-white flex flex-col list-table-container' : 'bg-white border border-gray-100 rounded-2xl shadow-sm list-table-container overflow-hidden'}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{info} {rows.length > 0 && <span className="text-gray-300">· kéo chọn vùng rồi Ctrl+C để copy</span>}</span>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button onClick={onDelete} title="Xoá lô này" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors">
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {expanded ? 'Thu nhỏ' : 'Phóng to'}
          </button>
        </div>
      </div>
      <div ref={wrapRef} tabIndex={0}
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') copySelection() }}
        className={`${expanded ? 'flex-1 overflow-auto' : 'overflow-auto max-h-[480px]'} select-none outline-none`}>
        <table className="list-table text-xs w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-gray-500">
              {headers.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold border border-gray-200 whitespace-nowrap">{h || `Cột ${i + 1}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                {headers.map((h, j) => (
                  <td key={j}
                    onMouseDown={() => startSelect(i, j)}
                    onMouseEnter={() => extendSelect(i, j)}
                    onContextMenu={e => handleContextMenu(e, i, j)}
                    className={`border border-gray-100 px-2 py-1.5 text-gray-900 align-top cursor-cell ${isSelected(i, j) ? 'bg-brand-100' : ''}`}>
                    {h?.trim().toUpperCase() === 'SEGMENTS' ? (
                      <div className="space-y-0.5">
                        {splitSegmentsForDisplay(r[j]).map((seg, k) => <div key={k} className="whitespace-nowrap">{seg}</div>)}
                      </div>
                    ) : (
                      <span className="whitespace-nowrap">{r[j] || '—'}</span>
                    )}
                  </td>
                ))}
              </tr>
            )) : Array.from({ length: EMPTY_GRID_ROWS }).map((_, i) => (
              <tr key={i}>
                {headers.map((_, j) => <td key={j} className="border border-gray-100 h-8">&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const menu = ctxMenu && mounted ? createPortal(
    <div className="fixed z-[200] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[140px]"
      style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
      <button onClick={() => { copySelection(); setCtxMenu(null) }}
        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2">
        <Copy size={13} /> Sao chép
      </button>
    </div>,
    document.body
  ) : null

  if (expanded && mounted) return <>{createPortal(content, document.body)}{menu}</>
  return <>{content}{menu}</>
}

type FieldSaver = (id: string, field: 'tkt_tag' | 'ma_khach' | 'sale_chinh' | 'ghi_chu', value: string) => void
type NumberFieldSaver = (id: string, field: 'gia_mua' | 'cktm' | 'gia_ban' | 'com_khach', value: number | null) => void

// Chế độ "Bảng" — cố tình giống Excel nhất có thể: 1 kiểu chữ/1 size/1 màu
// đồng nhất cho mọi ô (không dùng badge màu, không bo góc, viền kẻ ô như
// gridline thật), số căn phải.
type ColDef = { key: string; label: string; align?: 'right'; width: number }
const BANG_COLS: ColDef[] = [
  { key: 'stt', label: 'STT', width: 40 },
  { key: 'ncc', label: 'NCC', width: 70 },
  { key: 'ngay_xuat', label: 'Ngày xuất vé', width: 110 },
  { key: 'ma_ve', label: 'Mã vé', width: 100 },
  { key: 'pax', label: 'Pax', width: 150 },
  { key: 'ngay_di', label: 'Ngày bay đi', width: 100 },
  { key: 'ngay_ve', label: 'Ngày bay về', width: 100 },
  { key: 'hanh_trinh', label: 'Hành trình', width: 170 },
  { key: 'gia_mua', label: 'Giá mua', align: 'right', width: 100 },
  { key: 'cktm', label: 'CKTM', align: 'right', width: 80 },
  { key: 'tong_mua', label: 'Tổng mua', align: 'right', width: 100 },
  { key: 'gia_ban', label: 'Giá bán', align: 'right', width: 100 },
  { key: 'com_khach', label: 'COM khách', align: 'right', width: 90 },
  { key: 'loi_nhuan', label: 'Lợi nhuận', align: 'right', width: 100 },
  { key: 'ma_khach', label: 'Mã khách', width: 120 },
  { key: 'tkt', label: 'TKT', width: 90 },
  { key: 'sale_chinh', label: 'Sale chính', width: 110 },
  { key: 'ln_truoc_com', label: 'LN trước COM', align: 'right', width: 110 },
  { key: 'ln_tinh_thue', label: 'LN tính thuế', align: 'right', width: 100 },
  { key: 'ty_le_thue', label: '% Thuế TNDN', align: 'right', width: 90 },
  { key: 'thue_tndn', label: 'Thuế TNDN', align: 'right', width: 100 },
  { key: 'thue_gtgt', label: 'Thuế GTGT 8%', align: 'right', width: 100 },
  { key: 'quy_cskh', label: 'Quỹ CSKH 5%', align: 'right', width: 100 },
  { key: 'ln_con_lai_hh', label: 'LN còn lại chia HH', align: 'right', width: 130 },
  { key: 'hh_tkt', label: 'HH TKT 10%', align: 'right', width: 100 },
  { key: 'hh_kt1', label: 'HH KT1 3%', align: 'right', width: 100 },
  { key: 'hh_kt2', label: 'HH KT2 1,5%', align: 'right', width: 100 },
  { key: 'hh_sale_chinh', label: 'HH Sale chính 25%', align: 'right', width: 110 },
  { key: 'ln_cty', label: 'LN Cty còn lại', align: 'right', width: 110 },
  { key: 'ghi_chu', label: 'Ghi chú', width: 160 },
  { key: 'action', label: '', width: 36 },
]
const BANG_COL_DEFAULTS = Object.fromEntries(BANG_COLS.map(c => [c.key, c.width]))

function BangExcelView({ rows, onSaveField, onSaveNumberField, onDelete, tktSuggestions, khSuggestions, saleChinhSuggestions }: {
  rows: DebtRow[]; onSaveField: FieldSaver; onSaveNumberField: NumberFieldSaver; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[]; saleChinhSuggestions: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { widths, startResize } = useResizableColumns('ve-cong-no-bang', BANG_COL_DEFAULTS)

  const TH = 'relative px-2 py-1.5 border border-gray-300 bg-gray-100 font-semibold text-gray-700 whitespace-nowrap text-left overflow-hidden'
  const TD = 'px-2 py-1 border border-gray-300 text-gray-800 whitespace-nowrap font-normal overflow-hidden text-ellipsis'

  // "Phóng to": render qua Portal thẳng vào document.body — tránh mọi rủi
  // ro về containing block bị lệch nếu 1 ancestor nào đó (AppShell/Sidebar)
  // vô tình có transform/filter khiến fixed không bám đúng viewport thật;
  // portal thoát hẳn khỏi cây DOM của trang, chắc chắn phủ kín màn hình.
  // 1 div DUY NHẤT vừa cuộn dọc vừa cuộn ngang, chiều cao bị chặn đúng
  // viewport (flex-1) nên thanh cuộn ngang luôn nằm cố định ở đáy màn
  // hình thật. Header sticky top-0 để bám lại khi cuộn dọc bên trong.
  const content = (
    <div className={expanded ? 'fixed inset-0 z-[100] bg-white flex flex-col list-table-container' : 'bg-white border border-gray-300 list-table-container'}>
      <style jsx>{`
        .cong-no-scroll::-webkit-scrollbar { height: 18px; width: 18px; }
        .cong-no-scroll::-webkit-scrollbar-track { background: #f3f4f6; }
        .cong-no-scroll::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 9px; border: 4px solid #f3f4f6; }
        .cong-no-scroll::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        .cong-no-scroll::-webkit-scrollbar-corner { background: #f3f4f6; }
      `}</style>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{rows.length} dòng</span>
        <button onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors">
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {expanded ? 'Thu nhỏ' : 'Phóng to'}
        </button>
      </div>
      <div className={`cong-no-scroll ${expanded ? 'flex-1 overflow-auto' : 'overflow-auto'}`}>
      <table className="text-xs border-collapse list-table" style={{ fontFamily: 'Calibri, Arial, sans-serif', tableLayout: 'fixed' }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {BANG_COLS.map(c => (
              <th key={c.key} style={{ width: widths[c.key] ?? c.width }}
                className={`${TH} select-none ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
                <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand-400/40" onMouseDown={e => startResize(c.key, e)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r, i) => {
            const d = tinhCongNo(r)
            const names = splitPaxNames(r.pax_name)
            if (names.length <= 1) {
              return (
                <tr key={r.id}>
                  <td className={TD}>{i + 1}</td>
                  <td className={TD}>{r.ncc ?? '—'}</td>
                  <td className={TD}>{r.issued_date ?? '—'}</td>
                  <td className={TD}>{r.ticket_no ?? '—'}</td>
                  <td className={TD}>{r.pax_name ?? '—'}</td>
                  <td className={TD}>{r.departure_date ?? '—'}</td>
                  <td className={TD}>{r.return_date ?? '—'}</td>
                  <td className={TD}>{r.routing ?? '—'}</td>
                  <td className={`${TD} p-0`}><EditableNumberCell value={r.gia_mua} onSave={v => onSaveNumberField(r.id, 'gia_mua', v)} /></td>
                  <td className={`${TD} p-0`}><EditableNumberCell value={r.cktm} onSave={v => onSaveNumberField(r.id, 'cktm', v)} /></td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.tong_mua)}</td>
                  <td className={`${TD} p-0`}><EditableNumberCell value={r.gia_ban} onSave={v => onSaveNumberField(r.id, 'gia_ban', v)} /></td>
                  <td className={`${TD} p-0`}><EditableNumberCell value={r.com_khach} onSave={v => onSaveNumberField(r.id, 'com_khach', v)} /></td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.loi_nhuan)}</td>
                  <td className={`${TD} p-0`}><MaKhachCell value={r.ma_khach} onSave={v => onSaveField(r.id, 'ma_khach', v)} options={khSuggestions} /></td>
                  <td className={`${TD} p-0`}><EditableCell value={r.tkt_tag} placeholder="Tìm TKT..." onSave={v => onSaveField(r.id, 'tkt_tag', v)} suggestions={tktSuggestions} /></td>
                  <td className={`${TD} p-0`}><EditableCell value={r.sale_chinh} placeholder="Tìm sale chính..." onSave={v => onSaveField(r.id, 'sale_chinh', v)} suggestions={saleChinhSuggestions} /></td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.ln_truoc_com)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.ln_tinh_thue)}</td>
                  <td className={`${TD} text-right`}>{formatPercent(d.ty_le_thue_tndn)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.thue_tndn)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.thue_gtgt)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.quy_cskh)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.ln_con_lai_hoa_hong)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_tkt)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_kt1)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_kt2)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_sale_chinh)}</td>
                  <td className={`${TD} text-right`}>{formatGiaVe(d.ln_cty_con_lai)}</td>
                  <td className={`${TD} p-0`}><EditableCell value={r.ghi_chu} placeholder="Ghi chú..." onSave={v => onSaveField(r.id, 'ghi_chu', v)} /></td>
                  <td className={`${TD} text-center`}>
                    <button onClick={() => onDelete(r.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              )
            }
            // Vé đoàn nhiều pax: dòng đầu (pax thứ nhất) hiện đủ thông tin
            // + ô sửa như bình thường; các dòng phụ (pax thứ 2 trở đi) chỉ
            // hiện tên, còn lại để trống — vì tất cả vẫn CHUNG 1 bản ghi
            // DB (r.id), sửa ở dòng nào cũng ảnh hưởng chung, tránh để ô
            // input lặp lại gây hiểu nhầm mỗi pax có dữ liệu riêng.
            return names.map((name, j) => (
              <tr key={`${r.id}-${j}`} className={j > 0 ? 'bg-gray-50/60' : undefined}>
                <td className={TD}>{names.length > 1 ? `${i + 1}.${j + 1}` : i + 1}</td>
                {j === 0 ? (
                  <>
                    <td className={TD}>{r.ncc ?? '—'}</td>
                    <td className={TD}>{r.issued_date ?? '—'}</td>
                    <td className={TD}>{r.ticket_no ?? '—'}</td>
                    <td className={`${TD} font-semibold`}>{name}</td>
                    <td className={TD}>{r.departure_date ?? '—'}</td>
                    <td className={TD}>{r.return_date ?? '—'}</td>
                    <td className={TD}>{r.routing ?? '—'}</td>
                    <td className={`${TD} p-0`}><EditableNumberCell value={r.gia_mua} onSave={v => onSaveNumberField(r.id, 'gia_mua', v)} /></td>
                    <td className={`${TD} p-0`}><EditableNumberCell value={r.cktm} onSave={v => onSaveNumberField(r.id, 'cktm', v)} /></td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.tong_mua)}</td>
                    <td className={`${TD} p-0`}><EditableNumberCell value={r.gia_ban} onSave={v => onSaveNumberField(r.id, 'gia_ban', v)} /></td>
                    <td className={`${TD} p-0`}><EditableNumberCell value={r.com_khach} onSave={v => onSaveNumberField(r.id, 'com_khach', v)} /></td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.loi_nhuan)}</td>
                    <td className={`${TD} p-0`}><MaKhachCell value={r.ma_khach} onSave={v => onSaveField(r.id, 'ma_khach', v)} options={khSuggestions} /></td>
                    <td className={`${TD} p-0`}><EditableCell value={r.tkt_tag} placeholder="Tìm TKT..." onSave={v => onSaveField(r.id, 'tkt_tag', v)} suggestions={tktSuggestions} /></td>
                    <td className={`${TD} p-0`}><EditableCell value={r.sale_chinh} placeholder="Tìm sale chính..." onSave={v => onSaveField(r.id, 'sale_chinh', v)} suggestions={saleChinhSuggestions} /></td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.ln_truoc_com)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.ln_tinh_thue)}</td>
                    <td className={`${TD} text-right`}>{formatPercent(d.ty_le_thue_tndn)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.thue_tndn)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.thue_gtgt)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.quy_cskh)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.ln_con_lai_hoa_hong)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_tkt)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_kt1)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_kt2)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.hoa_hong_sale_chinh)}</td>
                    <td className={`${TD} text-right`}>{formatGiaVe(d.ln_cty_con_lai)}</td>
                    <td className={`${TD} p-0`}><EditableCell value={r.ghi_chu} placeholder="Ghi chú..." onSave={v => onSaveField(r.id, 'ghi_chu', v)} /></td>
                    <td className={`${TD} text-center`}>
                      <button onClick={() => onDelete(r.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    {/* ncc, ngày xuất, mã vé — để trống */}
                    {Array.from({ length: 3 }).map((_, k) => <td key={`b1-${k}`} className={TD}></td>)}
                    <td className={`${TD} text-gray-500`}>↳ {name}</td>
                    {/* ngày đi, ngày về, hành trình + 23 cột công thức/tag/ghi chú/action còn lại — để trống */}
                    {Array.from({ length: 26 }).map((_, k) => <td key={`b2-${k}`} className={TD}></td>)}
                  </>
                )}
              </tr>
            ))
          })}
        </tbody>
      </table>
      </div>
    </div>
  )

  if (expanded && mounted) return createPortal(content, document.body)
  return content
}

function ListView({ rows, onSaveField, onDelete, tktSuggestions, khSuggestions, saleChinhSuggestions }: { rows: DebtRow[]; onSaveField: FieldSaver; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[]; saleChinhSuggestions: string[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      {rows.map(r => {
        const d = tinhCongNo(r)
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50/70 transition-colors">
            <div className="w-24 shrink-0">
              <div className="text-xs font-semibold text-gray-800">{r.ncc ?? '—'}</div>
              <div className="text-[11px] text-gray-400">{r.issued_date ?? '—'}</div>
              {r.payment_date && <div className="text-[11px] text-gray-400">TT: {r.payment_date}</div>}
              {(r.departure_date || r.return_date) && (
                <div className="text-[11px] text-gray-400">Đi/về: {r.departure_date ?? '—'} → {r.return_date ?? '—'}</div>
              )}
            </div>
            <div className="min-w-[140px]">
              <div className="text-sm text-gray-800">{r.pax_name ?? '—'}</div>
              <div className="text-xs text-gray-400">{r.ticket_no ?? '—'} · {r.routing ?? '—'}</div>
            </div>
            <div className="ml-auto flex items-center gap-4 text-right">
              <div>
                <div className="text-[10px] text-gray-400">Giá mua</div>
                <div className="text-sm text-gray-700">{formatGiaVe(r.gia_mua)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">CKTM</div>
                <div className="text-sm text-gray-700">{formatGiaVe(r.cktm)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Tổng mua</div>
                <div className="text-sm text-gray-700">{formatGiaVe(d.tong_mua)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Giá bán</div>
                <div className="text-sm text-gray-700">{formatGiaVe(r.gia_ban)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">COM khách</div>
                <div className="text-sm text-gray-700">{formatGiaVe(r.com_khach)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Lợi nhuận</div>
                <div className="text-sm font-semibold text-emerald-600">{formatGiaVe(d.loi_nhuan)}</div>
              </div>
            </div>
            <div className="w-32 shrink-0">
              <MaKhachCell value={r.ma_khach} onSave={v => onSaveField(r.id, 'ma_khach', v)} options={khSuggestions} />
            </div>
            <div className="w-28 shrink-0">
              <EditableCell value={r.tkt_tag} placeholder="Tìm TKT..." onSave={v => onSaveField(r.id, 'tkt_tag', v)} suggestions={tktSuggestions} />
            </div>
            <div className="w-28 shrink-0">
              <EditableCell value={r.sale_chinh} placeholder="Tìm sale chính..." onSave={v => onSaveField(r.id, 'sale_chinh', v)} suggestions={saleChinhSuggestions} />
            </div>
            <button onClick={() => onDelete(r.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function CardView({ rows, onSaveField, onDelete, tktSuggestions, khSuggestions }: { rows: DebtRow[]; onSaveField: FieldSaver; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(r => {
        const d = tinhCongNo(r)
        return (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs font-semibold text-brand-600">{r.ncc ?? '—'}</div>
                <div className="text-sm font-bold text-gray-900">{r.pax_name ?? '—'}</div>
              </div>
              <button onClick={() => onDelete(r.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5 mb-3">
              <div>Mã vé: <span className="text-gray-800">{r.ticket_no ?? '—'}</span></div>
              <div>Hành trình: <span className="text-gray-800">{r.routing ?? '—'}</span></div>
              <div>Ngày xuất: <span className="text-gray-800">{r.issued_date ?? '—'}</span></div>
              {r.payment_date && <div>Ngày thanh toán: <span className="text-gray-800">{r.payment_date}</span></div>}
              {(r.departure_date || r.return_date) && (
                <div>Đi/về: <span className="text-gray-800">{r.departure_date ?? '—'} → {r.return_date ?? '—'}</span></div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs mb-3 pt-2 border-t border-gray-100">
              <div>
                <div className="text-gray-400">Giá bán</div>
                <div className="font-semibold text-gray-700">{formatGiaVe(r.gia_ban)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400">Lợi nhuận</div>
                <div className="font-semibold text-emerald-600">{formatGiaVe(d.loi_nhuan)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditableCell value={r.tkt_tag} placeholder="Tìm TKT..." onSave={v => onSaveField(r.id, 'tkt_tag', v)} suggestions={tktSuggestions} />
              <MaKhachCell value={r.ma_khach} onSave={v => onSaveField(r.id, 'ma_khach', v)} options={khSuggestions} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
