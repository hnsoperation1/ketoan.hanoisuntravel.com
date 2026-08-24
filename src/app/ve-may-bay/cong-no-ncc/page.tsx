'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Loader2, X } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { type MatchStatus } from '@/lib/ve-may-bay/match-status'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { RawMatchPanel, type RawCandidateMessage, type RawKhachInfo, type RawCandidatePax } from './RawMatchPanel'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import {
  type SheetData, type RawBatch,
  parseCsvGrid, parseXlsFile, parseXlsxSheetsAny,
  findVietjetHeaderRow, findFcvnHeaderRow, isLikelyJunkRow, splitSegmentsForDisplay,
  NCC_TABS, RawBatchesView, RawPriceCell, useCandidatesBulkCache,
} from './raw-shared'

// Bảng hành khách của TIN NHẮN đang chọn ở RawMatchPanel (bên trái) — hiện
// ngay trên danh sách lô công nợ raw, dạng bảng rộng (đồng bộ style với
// RawTableCard) thay vì card hẹp nhồi trong panel, dễ đọc/đối chiếu hơn khi
// tin nhắn có nhiều pax. "Chọn" gán mã khách của đúng dòng công nợ đang mở
// panel (viewingRawMatch) — y hệt hành vi choosePax cũ trong RawMatchPanel.
function SelectedMessagePaxTable({ message, khachInfo, onChoose, maxHeight }: {
  message: RawCandidateMessage
  khachInfo: RawKhachInfo
  onChoose: (p: RawCandidatePax, giaMua: number | null, giaBan: number | null) => void
  maxHeight: number
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
    <div className="bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500 truncate">
          Hành khách trong tin nhắn của <span className="font-semibold text-emerald-600">{message.from_user_name ?? 'Không rõ người gửi'}</span>
          {message.group_title && <span className="text-gray-400"> · Nhóm: {message.group_title}</span>}
        </span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{message.pax.length} khách</span>
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
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
                  <td className="relative border border-gray-100 p-0">
                    <RawPriceCell value={giaMua} onSave={v => setPrice(p.id, 'gia_mua', v)} />
                  </td>
                  <td className="relative border border-gray-100 p-0">
                    <RawPriceCell value={giaBan} onSave={v => setPrice(p.id, 'gia_ban', v)} />
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
  const [viewingRawMatch, setViewingRawMatch] = useState<{ batchId: string; rowIndex: number; idValue: string | null; paxLabel: string; matchStatus: MatchStatus | null; preloadedCandidates?: { messages: RawCandidateMessage[]; khachInfo: RawKhachInfo } } | null>(null)
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

  // Chiều cao bảng hành khách (SelectedMessagePaxTable) kéo giãn được —
  // axis 'y' (xem useResizableColumns.ts), cùng cơ chế với thanh kéo giãn
  // độ RỘNG panel bên trái ở trên, chỉ khác trục.
  const { widths: paxTableSize, startResize: startPaxTableResizeRaw } = useResizableColumns('cong-no-raw-pax-table', { h: 360 }, 'y')
  const [resizingPaxTable, setResizingPaxTable] = useState(false)
  function startResizePaxTable(e: React.MouseEvent) {
    setResizingPaxTable(true)
    startPaxTableResizeRaw('h', e)
    const onUp = () => { setResizingPaxTable(false); window.removeEventListener('mouseup', onUp) }
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
            tkt_tag: existing?.tkt_tag ?? null,
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
            tkt_tag: existing?.tkt_tag ?? null,
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

  // Sửa tay TKT (gõ trực tiếp trong ô, không qua slide-over) — cùng cơ chế
  // optimistic update + PATCH partial như saveRawGiaManual ở trên.
  async function saveRawTktManual(batchId: string, rowIndex: number, value: string | null) {
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
            gia_mua: existing?.gia_mua ?? null,
            gia_ban: existing?.gia_ban ?? null,
            gia_source: existing?.gia_source ?? null,
            tkt_tag: value,
          },
        ],
      }
    }))
    await fetch(`/api/ve-may-bay/cong-no-raw/${batchId}/rows/${rowIndex}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tkt_tag: value }),
    })
  }

  const [rawBatches, setRawBatches] = useState<RawBatch[]>([])
  // Tải sẵn tin nhắn Telegram khớp mã vé cho TOÀN BỘ lô ngay khi có danh
  // sách lô (không đợi mở tab NCC hay bấm dòng nào) — đổi tab/bấm dòng chỉ
  // đọc lại cache này, không gọi API nữa.
  const candidatesCache = useCandidatesBulkCache(rawBatches)

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

  // Đổi tên hiển thị của 1 lô (tab "sheet") — chỉ ghi display_name, KHÔNG
  // đụng source_file (tên file gốc, giữ nguyên để truy vết). Đổi được vô
  // số lần; displayName = null khi để trống lúc lưu (quay lại hiển thị
  // theo tên file gốc).
  async function renameRawBatch(id: string, displayName: string | null) {
    setRawBatches(prev => prev.map(b => b.id === id ? { ...b, display_name: displayName } : b))
    await fetch(`/api/ve-may-bay/cong-no-raw/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
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
              onClick={() => {
                setNccFilter(n)
                resetWizard()
                // Đổi tab NCC = đổi hẳn danh sách lô đang xem — panel/bảng
                // hành khách đang hiện thuộc về 1 dòng của lô NCC CŨ, không
                // còn liên quan gì tới tab mới, phải đóng lại chứ không thể
                // giữ nguyên nội dung cũ (viewingRawMatch trỏ đúng batchId
                // cũ chứ không tự biết "đã đổi tab", xem RawMatchPanel).
                setViewingRawMatch(null)
                setSelectedRawMessage(null)
              }}
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
          className={`relative shrink-0 overflow-hidden ${resizingRawPanel ? '' : 'transition-[width] duration-300 ease-out'}`}
          style={{ width: viewingRawMatch ? rawPanelWidths.panel : 0 }}>
          <div className="h-full" style={{ width: rawPanelWidths.panel }}>
            <RawMatchPanel
              target={viewingRawMatch ? {
                id: `${viewingRawMatch.batchId}:${viewingRawMatch.rowIndex}`,
                ticketLabel: viewingRawMatch.idValue ?? 'Không có mã vé/PNR',
                contextLabel: viewingRawMatch.paxLabel,
                matchStatus: viewingRawMatch.matchStatus,
              } : null}
              candidatesUrl={viewingRawMatch ? `/api/ve-may-bay/cong-no-raw/${viewingRawMatch.batchId}/rows/${viewingRawMatch.rowIndex}/candidates` : null}
              preloaded={viewingRawMatch?.preloadedCandidates}
              onClose={() => setViewingRawMatch(null)}
              onSelectMessage={setSelectedRawMessage}
            />
          </div>
        </div>
        {/* Tay cầm kéo giãn NẰM NGAY TRONG khoảng trống giữa panel và bảng
            (trước đây là 1 dải mỏng 6px nép sát mép trong của panel, lọt
            thỏm dưới khoảng trống mr-4 nhìn thấy được — dễ hiểu nhầm chỗ
            cầm) — giờ chính khoảng trống đó (rộng 16px, w-4) LÀ tay cầm,
            có vạch tròn xám làm dấu hiệu luôn nhìn thấy được, không cần rê
            trúng mới biết. Vẫn co giãn theo cùng nhịp với panel lúc
            đóng/mở (transition width 0 ↔ 16px) để không bị giật hình. */}
        <div
          onMouseDown={viewingRawMatch ? startResizeRawPanel : undefined}
          title={viewingRawMatch ? 'Kéo để đổi độ rộng' : undefined}
          className={`shrink-0 flex items-center justify-center group ${resizingRawPanel ? '' : 'transition-[width] duration-300 ease-out'} ${viewingRawMatch ? 'w-4 cursor-col-resize' : 'w-0'}`}>
          {viewingRawMatch && (
            <div className="w-1 h-10 rounded-full bg-gray-200 group-hover:bg-brand-400 group-active:bg-brand-500 transition-colors" />
          )}
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {selectedRawMessage && (
            <>
              <div className="shrink-0">
                <SelectedMessagePaxTable
                  key={selectedRawMessage.message.parse_log_id}
                  message={selectedRawMessage.message}
                  khachInfo={selectedRawMessage.khachInfo}
                  maxHeight={paxTableSize.h}
                  onChoose={(p, giaMua, giaBan) => p.ma_khach && viewingRawMatch && saveRawMaKhachManual(viewingRawMatch.batchId, viewingRawMatch.rowIndex, p.ma_khach, p.id, giaMua, giaBan)}
                />
              </div>
              {/* Thanh kéo giãn CHIỀU CAO giữa bảng hành khách và bảng lô
                  công nợ bên dưới — cùng kiểu tay cầm (vạch tròn giữa 1 dải
                  rộng) như thanh kéo giãn độ rộng panel bên trái, chỉ xoay
                  ngang vì kéo theo trục dọc. */}
              <div
                onMouseDown={startResizePaxTable}
                title="Kéo để đổi chiều cao"
                className={`shrink-0 h-4 flex items-center justify-center cursor-row-resize group ${resizingPaxTable ? '' : 'transition-colors'}`}>
                <div className="h-1 w-10 rounded-full bg-gray-200 group-hover:bg-brand-400 group-active:bg-brand-500 transition-colors" />
              </div>
            </>
          )}
          <RawBatchesView batches={rawBatches.filter(b => b.ncc.trim().toUpperCase() === nccFilter.trim().toUpperCase())} onDelete={deleteRawBatch} onRename={renameRawBatch} ncc={nccFilter}
            onOpenMatch={setViewingRawMatch} onSaveGia={saveRawGiaManual} onSaveTkt={saveRawTktManual} syncOnSelect
            relatedTicketNos={selectedRawMessage ? new Set(selectedRawMessage.message.pax.map(p => p.ticket_no).filter((x): x is string => !!x)) : null}
            candidatesCache={candidatesCache} />
        </div>
      </div>
    </div>
  )
}
