'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Search, Trash2, Loader2, Table2, List, LayoutGrid, Maximize2, Minimize2, Check, X } from 'lucide-react'
import { tinhCongNo } from '@/lib/tinh-cong-no-ve'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useTopbar } from '@/contexts/topbar'
import { filterKhachOptions, type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { type MatchStatus, MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { MatchSlideOver } from '../cong-no-ncc/MatchSlideOver'

export type DebtRow = {
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
  match_status: MatchStatus | null
  matched_booking_id: string | null
}

function formatGiaVe(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN')
}

function formatPercent(n: number): string {
  return `${Math.round(n * 1000) / 10}%`
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

// Dò dòng "rác" khi nhập nguyên xi (submitRaw) — dựa vào cột mã vé/PNR đã
// nhận diện được qua findIdColumnIndex (raw-column-roles.ts, đã dùng ổn
// cho cả 4 NCC ở tính năng khớp mã khách). Dòng dữ liệu thật luôn có mã
// vé/PNR đủ dài; dòng tiêu đề phụ lặp lại (mỗi ô chỉ có 1 chữ cái chú
// thích cột) hoặc dòng ngăn cách section (các ô khác đều trống) đều có ô
// này rỗng hoặc quá ngắn.
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

const SELECT ='border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400'

// Viền xanh lá đậm, góc vuông khi focus — giống ô đang nhập trong Excel
// thật (không phải nhẫn xanh dương bo tròn kiểu form web thông thường).
// ring-inset để viền nằm gọn trong ô, không đẩy layout xê dịch.
const CELL_INPUT = 'w-full h-full bg-transparent text-xs px-1 py-0.5 rounded-none focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#107C41]'

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

  const filtered = filterKhachOptions(options, q)

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

type FieldSaver = (id: string, field: 'tkt_tag' | 'sale_chinh' | 'ghi_chu', value: string) => void
type MaKhachSaver = (id: string, maKhach: string, matchedBookingId: string | null) => void
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

function BangExcelView({ rows, onSaveField, onSaveNumberField, onSaveMaKhach, onOpenMatch, onDelete, tktSuggestions, khSuggestions, saleChinhSuggestions }: {
  rows: DebtRow[]; onSaveField: FieldSaver; onSaveNumberField: NumberFieldSaver; onSaveMaKhach: MaKhachSaver; onOpenMatch: (row: DebtRow) => void; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[]; saleChinhSuggestions: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { widths, startResize } = useResizableColumns('ve-cong-no-bang', BANG_COL_DEFAULTS)

  // BẮT BUỘC phải set width tường minh cho <table>: theo chuẩn CSS,
  // `table-layout: fixed` CHỈ có hiệu lực khi bảng có width khác `auto`.
  // Thiếu nó, trình duyệt âm thầm quay về auto layout — lúc đó `width` đặt
  // trên từng <th> chỉ là "gợi ý", độ rộng thật do NỘI DUNG ô quyết định,
  // nên kéo giãn cột đổi state/inline style nhưng màn hình không nhúc nhích.
  const totalWidth = BANG_COLS.reduce((sum, c) => sum + (widths[c.key] ?? c.width), 0)

  const TH = 'relative px-2 py-1.5 border border-gray-300 bg-gray-100 font-semibold text-gray-700 whitespace-nowrap text-left overflow-hidden'
  const TD = 'px-2 py-1 border border-gray-300 text-gray-800 whitespace-nowrap font-normal overflow-hidden text-ellipsis'

  // "Phóng to": render qua Portal thẳng vào document.body — tránh mọi rủi
  // ro về containing block bị lệch nếu 1 ancestor nào đó (AppShell/Sidebar)
  // vô tình có transform/filter khiến fixed không bám đúng viewport thật;
  // portal thoát hẳn khỏi cây DOM của trang, chắc chắn phủ kín màn hình.
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
      <table className="text-xs border-collapse list-table fixed-cols-table" style={{ fontFamily: 'Calibri, Arial, sans-serif', tableLayout: 'fixed', width: totalWidth }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {BANG_COLS.map(c => (
              <th key={c.key} style={{ width: widths[c.key] ?? c.width }}
                className={`${TH} select-none ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startResize(c.key, e)} />
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
                  <td className={`${TD} p-0`}>
                    <div className="flex items-center gap-1 px-1">
                      <MatchStatusBadge status={r.match_status ?? 'unmatched'} dense onClick={() => onOpenMatch(r)} />
                      <MaKhachCell value={r.ma_khach} onSave={v => onSaveMaKhach(r.id, v, null)} options={khSuggestions} />
                    </div>
                  </td>
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
                    <td className={`${TD} p-0`}>
                      <div className="flex items-center gap-1 px-1">
                        <MatchStatusBadge status={r.match_status ?? 'unmatched'} dense onClick={() => onOpenMatch(r)} />
                        <MaKhachCell value={r.ma_khach} onSave={v => onSaveMaKhach(r.id, v, null)} options={khSuggestions} />
                      </div>
                    </td>
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

function ListView({ rows, onSaveField, onSaveMaKhach, onOpenMatch, onDelete, tktSuggestions, khSuggestions, saleChinhSuggestions }: { rows: DebtRow[]; onSaveField: FieldSaver; onSaveMaKhach: MaKhachSaver; onOpenMatch: (row: DebtRow) => void; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[]; saleChinhSuggestions: string[] }) {
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
            <div className="w-32 shrink-0 space-y-0.5">
              <MatchStatusBadge status={r.match_status ?? 'unmatched'} onClick={() => onOpenMatch(r)} />
              <MaKhachCell value={r.ma_khach} onSave={v => onSaveMaKhach(r.id, v, null)} options={khSuggestions} />
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

function CardView({ rows, onSaveField, onSaveMaKhach, onOpenMatch, onDelete, tktSuggestions, khSuggestions }: { rows: DebtRow[]; onSaveField: FieldSaver; onSaveMaKhach: MaKhachSaver; onOpenMatch: (row: DebtRow) => void; onDelete: (id: string) => void; tktSuggestions: string[]; khSuggestions: KhachOpt[] }) {
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
              <div className="flex items-center gap-1">
                <MatchStatusBadge status={r.match_status ?? 'unmatched'} dense onClick={() => onOpenMatch(r)} />
                <MaKhachCell value={r.ma_khach} onSave={v => onSaveMaKhach(r.id, v, null)} options={khSuggestions} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TongHopCongNoNccPage() {
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
  const [nccInput, setNccInput] = useState('')
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

  // Filters
  const [search, setSearch] = useState('')
  const [rowNccFilter, setRowNccFilter] = useState('')
  const [tktFilter, setTktFilter] = useState('')
  const [khFilter, setKhFilter] = useState('')

  const [rematching, setRematching] = useState(false)
  const [viewingMatchRow, setViewingMatchRow] = useState<DebtRow | null>(null)

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

  async function runRematch() {
    setRematching(true)
    try {
      await fetch('/api/ve-may-bay/cong-no/match-ma-khach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      await loadData()
    } finally {
      setRematching(false)
    }
  }

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Tổng hợp công nợ NCC</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  // Danh mục để gợi ý autocomplete cho "Tìm mã khách/TKT/sale chính" — kéo
  // từ nguồn CHUẨN thay vì chỉ suy ra từ các dòng đã gắn tay trong chính
  // bảng này (rows hầu hết còn trống 3 trường này nên tự suy ra gần như
  // rỗng): mã khách lấy từ /ve-may-bay/vmb-khach-hang, TKT lấy từ bảng
  // ve_tkt thật, sale chính lấy từ danh sách nhân viên (users,
  // is_active=true).
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
    setHeaderRowIndex(null); setNccInput(''); setImportError('')
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
  // ve_debt_records_raw (giống 4 tab NCC ở trang "Đầu vào CNO NCC"). Việc
  // chuẩn hoá dữ liệu về ve_debt_records (bảng Tổng hợp) làm ở bước riêng
  // sau, không phải qua wizard này.
  async function submitRaw() {
    const ncc = nccInput.trim()
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
        body: JSON.stringify({ ncc, source_file: fileName, headers, rows: rowsToImport }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Nhập thất bại' }))
        setImportError(error || 'Nhập thất bại')
        return
      }
      resetWizard()
    } catch {
      setImportError('Nhập thất bại, thử lại.')
    } finally {
      setImporting(false)
    }
  }

  async function saveField(id: string, field: 'tkt_tag' | 'sale_chinh' | 'ghi_chu', value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value || null } : r))
    await fetch(`/api/ve-may-bay/cong-no/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  // Gán mã khách TAY (qua ô MaKhachCell hoặc slide-over) — khác saveField ở
  // chỗ luôn kéo theo đổi match_status. matchedBookingId khác null chỉ khi
  // gọi từ slide-over (chọn đúng 1 candidate cụ thể, giữ vết truy vết); null
  // khi gõ tự do/chọn từ danh mục chuẩn (MaKhachCell) — không có booking cụ
  // thể nào đứng sau lựa chọn đó. Rỗng ('') = bỏ chọn → quay lại 'unmatched'
  // (đỏ) thay vì giữ trạng thái cũ, đúng ngữ nghĩa "chưa có mã khách nào".
  async function saveMaKhachManual(id: string, maKhach: string, matchedBookingId: string | null) {
    const trimmed = maKhach.trim()
    const nextStatus: MatchStatus = trimmed ? 'manual' : 'unmatched'
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, ma_khach: trimmed || null, match_status: nextStatus, matched_booking_id: trimmed ? matchedBookingId : null }
      : r))
    await fetch(`/api/ve-may-bay/cong-no/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ma_khach: trimmed, matched_booking_id: trimmed ? matchedBookingId : null }),
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

  const nccOptions = Array.from(new Set(rows.map(r => r.ncc).filter(Boolean))) as string[]
  const byRowNcc = rows.filter(r => !rowNccFilter || r.ncc === rowNccFilter)
  const tkts = Array.from(new Set(byRowNcc.map(r => r.tkt_tag).filter(Boolean))) as string[]
  const byTkt = byRowNcc.filter(r => !tktFilter || r.tkt_tag === tktFilter)
  const khs = Array.from(new Set(byTkt.map(r => r.ma_khach).filter(Boolean))) as string[]
  const byKh = byTkt.filter(r => !khFilter || r.ma_khach === khFilter)

  const filtered = byKh.filter(r => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const hay = [r.ticket_no, r.pax_name, r.routing, r.ncc, r.tkt_tag, r.ma_khach].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })

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
    <>
    <div className="px-5 pb-5 space-y-2">
      {/* Nhập file + làm mới — cao bằng topbar (h-12 md:h-10, xem
          components/Topbar.tsx) và nằm sát topbar (không padding-top) để 2
          thanh liền mạch nhau. */}
      <div className="min-h-12 md:min-h-10 flex items-center justify-end gap-2 border-b border-gray-200">
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
        <button onClick={loadData} title="Làm mới" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
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
            <div className="border border-gray-200 overflow-auto max-h-72">
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
                Nhập vào tab &quot;Tổng hợp&quot; — tiêu đề: dòng {headerRowIndex + 1} · {dataRows.length} dòng dữ liệu từ &quot;{fileName}&quot;.
                {junkRowIndexes.size > 0 && (
                  <span className="text-red-500 font-semibold"> · {junkRowIndexes.size} dòng tô đỏ bị nghi là rác (tiêu đề phụ/dòng ngăn cách), sẽ KHÔNG được nhập — bấm &quot;Giữ dòng này&quot; nếu vẫn muốn nhập.</span>
                )}
                {' '}Thấy dòng rác nào chưa bị tô đỏ? Rê chuột vào dòng đó, bấm &quot;Bỏ dòng này&quot; để loại luôn.
              </span>
              <button onClick={() => setHeaderRowIndex(null)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 ml-3">
                ← Chọn lại dòng tiêu đề
              </button>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 mb-1">NCC (nhà cung cấp) *</label>
              <input value={nccInput} onChange={e => setNccInput(e.target.value)} placeholder="VD: Vietnam Airlines, Đại lý ABC..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="border border-gray-200 overflow-auto max-h-[70vh]">
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
                {importing && <Loader2 size={14} className="animate-spin" />} Nhập {rowsToImport.length} dòng vào tab &quot;{nccInput || '—'}&quot;
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

      {/* Filters + view mode */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-1/2 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã vé, pax, NCC..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <select value={rowNccFilter} onChange={e => { setRowNccFilter(e.target.value); setTktFilter(''); setKhFilter('') }} className={SELECT}>
          <option value="">Tất cả NCC</option>
          {nccOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={tktFilter} onChange={e => { setTktFilter(e.target.value); setKhFilter('') }} className={SELECT}>
          <option value="">Tất cả TKT</option>
          {tkts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={khFilter} onChange={e => setKhFilter(e.target.value)} className={SELECT}>
          <option value="">Tất cả khách hàng</option>
          {khs.map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 ml-auto">
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
        <BangExcelView rows={filtered} onSaveField={saveField} onSaveNumberField={saveNumberField} onSaveMaKhach={saveMaKhachManual} onOpenMatch={setViewingMatchRow} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} saleChinhSuggestions={allSaleChinh} />
      ) : viewMode === 'list' ? (
        <ListView rows={filtered} onSaveField={saveField} onSaveMaKhach={saveMaKhachManual} onOpenMatch={setViewingMatchRow} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} saleChinhSuggestions={allSaleChinh} />
      ) : (
        <CardView rows={filtered} onSaveField={saveField} onSaveMaKhach={saveMaKhachManual} onOpenMatch={setViewingMatchRow} onDelete={deleteRow} tktSuggestions={allTktTags} khSuggestions={allMaKhach} />
      )}
    </div>
    {viewingMatchRow && (
      <MatchSlideOver
        target={{
          id: viewingMatchRow.id,
          ticketLabel: viewingMatchRow.ticket_no ?? 'Không có mã vé',
          contextLabel: `${viewingMatchRow.pax_name ?? '—'} · ${viewingMatchRow.routing ?? '—'}`,
          matchStatus: viewingMatchRow.match_status,
        }}
        candidatesUrl={`/api/ve-may-bay/cong-no/${viewingMatchRow.id}/candidates`}
        khSuggestions={allMaKhach}
        onSaved={(maKhach, matchedBookingId) => saveMaKhachManual(viewingMatchRow.id, maKhach, matchedBookingId)}
        onClose={() => setViewingMatchRow(null)} />
    )}
    </>
  )
}
