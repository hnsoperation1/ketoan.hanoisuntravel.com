'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Loader2, X } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { type MatchStatus } from '@/lib/ve-may-bay/match-status'
import { findIdColumnIndex } from '@/lib/ve-may-bay/raw-column-roles'
import { type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { MatchSlideOver } from '../cong-no-ncc/MatchSlideOver'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { type RawCandidateMessage, type RawKhachInfo } from '../cong-no-ncc/RawMatchPanel'
import {
  type SheetData, type RawBatch,
  parseCsvGrid, parseXlsFile, parseXlsxSheetsAny,
  findVietjetHeaderRow, findFcvnHeaderRow, isLikelyJunkRow, splitSegmentsForDisplay,
  NCC_TABS, RawBatchesView, useCandidatesBulkCache,
} from '../cong-no-ncc/raw-shared'

// Bản v2 của màn "Đầu vào công nợ NCC" — KHÁC v1 (../cong-no-ncc) ĐÚNG 1
// điểm: cách hiển thị phần khớp mã khách.
//   v1: panel tin nhắn Telegram chiếm cố định 1 cột bên trái + bảng hành
//       khách của tin nhắn đang chọn chèn phía trên bảng lô công nợ → bảng
//       chính bị ép hẹp lại cả chiều ngang lẫn chiều dọc.
//   v2: bảng lô công nợ chiếm TRỌN màn hình, bấm mã vé/PNR mới mở
//       MatchSlideOver đè lên (đúng slide-over dùng chung với màn "Tổng hợp
//       công nợ NCC") — trong slide-over có sẵn 3 cột: tin nhắn khớp | hành
//       khách trong tin nhắn | tự tìm trong danh mục KH.
// Toàn bộ phần còn lại (đọc file, wizard nhập, bảng lô, thanh tab "sheet"
// theo lần tải) dùng CHUNG module ../cong-no-ncc/raw-shared.tsx — sửa ở đó
// là cả 2 màn cùng đổi.
export default function CongNoVeV2Page() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const { confirm, dialog } = useConfirmDialog()
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

  // Tab NCC đang xem — luôn có 1 trong 4 tab cố định được chọn.
  const [nccFilter, setNccFilter] = useState(NCC_TABS[0])

  const [rematching, setRematching] = useState(false)
  const [viewingRawMatch, setViewingRawMatch] = useState<{ batchId: string; rowIndex: number; idValue: string | null; paxLabel: string; matchStatus: MatchStatus | null; preloadedCandidates?: { messages: RawCandidateMessage[]; khachInfo: RawKhachInfo } } | null>(null)

  // Danh mục khách hàng chuẩn — chỉ để đổ vào cột "tự tìm trong danh mục"
  // của MatchSlideOver (v1 không cần vì panel bên trái đã bỏ mục tìm tay).
  const [dirMaKhach, setDirMaKhach] = useState<KhachOpt[]>([])
  const loadDirectories = useCallback(async () => {
    try {
      const res = await fetch('/api/ve-may-bay/vmb-khach-hang')
      const { data } = await res.json()
      if (Array.isArray(data)) setDirMaKhach(data.map((d: { ma_khach: string; ten_khach: string | null }) => ({ ma_khach: d.ma_khach, ten_khach: d.ten_khach })).filter((d: KhachOpt) => d.ma_khach))
    } catch { /* im lặng — chỉ ảnh hưởng gợi ý, không chặn trang */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDirectories()
  }, [loadDirectories])

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
    const ok = await confirm({ title: 'Bạn có chắc chắn muốn xoá không?', confirmLabel: 'Xoá', tone: 'danger' })
    if (!ok) return
    try {
      await fetch(`/api/ve-may-bay/cong-no-raw/${id}`, { method: 'DELETE' })
      loadRawData()
    } catch { /* im lặng */ }
  }

  // Đổi tên hiển thị của 1 lô (tab "sheet") — chỉ ghi display_name, KHÔNG
  // đụng source_file (tên file gốc, giữ nguyên để truy vết).
  async function renameRawBatch(id: string, displayName: string | null) {
    setRawBatches(prev => prev.map(b => b.id === id ? { ...b, display_name: displayName } : b))
    await fetch(`/api/ve-may-bay/cong-no-raw/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
  }

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Đầu vào công nợ NCC v2</span>)
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
  // tự nhận diện đúng dòng tiêu đề theo chữ ký Vietjet/FCVN đã biết (đỡ
  // phải tự cuộn/bấm chọn dòng tay), KHÔNG tự tách sẵn cột.
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
    // này phủ ĐÚNG BẰNG vùng nội dung → main không sinh thanh cuộn dọc, mọi
    // việc cuộn dồn vào trong bảng, thanh "sheet" luôn dính đáy màn hình.
    <div className="absolute inset-0 flex flex-col px-5">
      {dialog}
      {/* Tab NCC + nhập file + làm mới, cùng 1 dòng — cao bằng topbar
          (h-12 md:h-10, xem components/Topbar.tsx) và nằm sát topbar. */}
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

      {/* Bảng lô công nợ chiếm TRỌN vùng còn lại — không còn cột panel bên
          trái lẫn bảng hành khách chèn phía trên như v1. */}
      <div className="flex-1 min-h-0 flex flex-col pt-2">
        <RawBatchesView batches={rawBatches.filter(b => b.ncc.trim().toUpperCase() === nccFilter.trim().toUpperCase())} onDelete={deleteRawBatch} onRename={renameRawBatch} ncc={nccFilter}
          onOpenMatch={setViewingRawMatch} onSaveGia={saveRawGiaManual} onSaveTkt={saveRawTktManual} candidatesCache={candidatesCache} />
      </div>

      {/* Bấm mã vé/PNR trong bảng → mở slide-over đè lên (portal ra
          document.body, xem MatchSlideOver.tsx). Đóng lại là bảng nguyên
          vẹn như cũ, không đẩy/ép layout gì hết. */}
      {viewingRawMatch && (
        <MatchSlideOver
          target={{
            id: `${viewingRawMatch.batchId}:${viewingRawMatch.rowIndex}`,
            ticketLabel: viewingRawMatch.idValue ?? 'Không có mã vé/PNR',
            contextLabel: viewingRawMatch.paxLabel,
            matchStatus: viewingRawMatch.matchStatus,
          }}
          candidatesUrl={`/api/ve-may-bay/cong-no-raw/${viewingRawMatch.batchId}/rows/${viewingRawMatch.rowIndex}/candidates`}
          preloaded={viewingRawMatch.preloadedCandidates}
          khSuggestions={dirMaKhach}
          onSaved={(maKhach, matchedBookingId, giaMua, giaBan) =>
            saveRawMaKhachManual(viewingRawMatch.batchId, viewingRawMatch.rowIndex, maKhach, matchedBookingId, giaMua, giaBan)}
          onClose={() => setViewingRawMatch(null)} />
      )}
    </div>
  )
}
