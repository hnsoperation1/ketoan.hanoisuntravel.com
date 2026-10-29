'use client'

// Bảng tổng hợp đoàn (LIST TỔNG, đặc tả §10.5) — mỗi dòng 1 đoàn đã nối đơn CRM. Lưới theo ERP_TABLE_UI_STANDARD.md:
// hàng toạ độ A, B, C…, hàng tiêu đề = hàng 0, cột số dòng cố định trái, kéo đổi độ rộng / thứ tự cột, chọn vùng + Ctrl+C,
// dòng tổng nằm trong lưới. Bấm tên đoàn (hoặc nháy đúp dòng) → tab Quyết toán của đoàn.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowDown, ArrowUp, Download, GripVertical, Loader2, Lock, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { SelectMenu } from '@/components/SelectMenu'
import { useTopbar } from '@/contexts/topbar'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useCellSelection } from '@/hooks/useCellSelection'
import { formatDateVN, formatTien } from '@/lib/format'
import { CHI_PHI_TRANG_THAI_LABEL, KHACH_TRANG_THAI_LABEL, TINH_TRANG_CHAY_LABEL, type ChiPhiTrangThai, type KhachTrangThai } from '@/lib/quyetToan'
import type { QtListRow } from '@/lib/quyetToanBundle'

type Col = {
  key: string
  label: string
  width: number
  num?: boolean // cột tiền: căn phải, có dòng tổng
  get: (r: QtListRow, i: number) => string | number | null
  text?: (r: QtListRow, i: number) => string // chữ hiển thị / sao chép
}

const thangVN = (t: string | null) => (t ? `${t.slice(5, 7)}/${t.slice(0, 4)}` : '')
const trangThaiQt = (r: QtListRow) =>
  r.da_khoa ? 'Đã khoá sổ' : `${CHI_PHI_TRANG_THAI_LABEL[r.chi_phi_trang_thai as ChiPhiTrangThai] ?? r.chi_phi_trang_thai} · ${KHACH_TRANG_THAI_LABEL[r.khach_trang_thai as KhachTrangThai] ?? r.khach_trang_thai}`

// Đúng thứ tự cột LIST TỔNG của mẫu QT chuẩn (+ Tình trạng, Trạng thái QT ở cuối)
const COLS: Col[] = [
  { key: 'stt', label: 'STT', width: 56, get: (_r, i) => i + 1 },
  { key: 'ngay', label: 'Ngày', width: 150, get: (r) => r.ngay_di, text: (r) => [formatDateVN(r.ngay_di), formatDateVN(r.ngay_ve)].filter(Boolean).join(' – ') },
  { key: 'phan_loai', label: 'Phân loại', width: 100, get: (r) => r.phan_loai },
  { key: 'thang', label: 'Tháng', width: 80, get: (r) => r.thang, text: (r) => thangVN(r.thang) },
  { key: 'khach', label: 'Mã khách', width: 180, get: (r) => r.khach },
  { key: 'ten_doan', label: 'Tên đoàn', width: 240, get: (r) => r.ten_doan },
  { key: 'lich_trinh', label: 'Lịch trình', width: 200, get: (r) => r.lich_trinh },
  { key: 'so_hd', label: 'Số HĐ', width: 150, get: (r) => r.so_hop_dong },
  { key: 'sale_chinh', label: 'Sale chính', width: 140, get: (r) => r.sale_chinh },
  { key: 'sale_phu', label: 'Sale phụ', width: 140, get: (r) => r.sale_phu },
  { key: 'dh', label: 'ĐH', width: 140, get: (r) => r.dieu_hanh },
  { key: 'kt', label: 'KT', width: 140, get: (r) => r.ke_toan },
  { key: 'tkt', label: 'TKT', width: 140, get: (r) => r.tkt },
  { key: 'dt', label: 'DT', width: 130, num: true, get: (r) => r.tong_quyet_toan },
  { key: 'thanh_toan', label: 'Thanh toán', width: 130, num: true, get: (r) => r.da_thu },
  { key: 'cong_no', label: 'Công nợ', width: 130, num: true, get: (r) => r.cong_no_khach },
  { key: 'thu', label: 'Thu', width: 130, num: true, get: (r) => r.doanh_thu },
  { key: 'chi', label: 'Chi', width: 130, num: true, get: (r) => r.tong_chi },
  { key: 'ln', label: 'LN', width: 130, num: true, get: (r) => r.loi_nhuan },
  { key: 'cskh', label: 'CSKH 5%', width: 120, num: true, get: (r) => r.cskh },
  { key: 'ln_hh', label: 'LN tính HH', width: 130, num: true, get: (r) => r.ln_tinh_hh },
  { key: 'hh_sc', label: 'HH sale chính', width: 125, num: true, get: (r) => r.hh_sale_chinh },
  { key: 'hh_sp', label: 'HH sale phụ', width: 120, num: true, get: (r) => r.hh_sale_phu },
  { key: 'hh_dh', label: 'HH ĐH', width: 115, num: true, get: (r) => r.hh_dieu_hanh },
  { key: 'hh_kt', label: 'HH KT', width: 115, num: true, get: (r) => r.hh_ke_toan },
  { key: 'ln_con_lai', label: 'LN còn lại', width: 130, num: true, get: (r) => r.ln_con_lai },
  { key: 'vat', label: 'VAT nộp NSNN', width: 130, num: true, get: (r) => r.gtgt },
  { key: 'tang_giam', label: 'Tăng / giảm LN', width: 130, num: true, get: (r) => r.tang_giam_ln },
  { key: 'ly_do', label: 'Lý do tăng giảm', width: 220, get: (r) => r.ly_do_tang_giam_ln },
  { key: 'bo_phan', label: 'Bộ phận', width: 140, get: (r) => r.bo_phan },
  { key: 'cong_no_ncc', label: 'Công nợ NCC', width: 130, num: true, get: (r) => r.cong_no_ncc },
  { key: 'tinh_trang', label: 'Tình trạng', width: 110, get: (r) => TINH_TRANG_CHAY_LABEL[r.tinh_trang] },
  { key: 'trang_thai_qt', label: 'Trạng thái QT', width: 230, get: (r) => trangThaiQt(r) },
]
const COL_MAP = new Map(COLS.map((c) => [c.key, c]))
const ORDER_KEY = 'qt-list-tong:col-order'
const GUTTER_W = 52
const ROW_H_COORD = 22
const colLetter = (i: number) => {
  let s = ''
  let x = i + 1
  while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26) }
  return s
}
const cellText = (c: Col, r: QtListRow, i: number) => {
  if (c.text) return c.text(r, i)
  const v = c.get(r, i)
  if (v == null) return ''
  return c.num && typeof v === 'number' ? formatTien(v) : String(v)
}

type Loc = { vp: string; tt: string; thang: string; pl: string; sc: string; sp: string; dh: string; kt: string }
const LOC_RONG: Loc = { vp: '', tt: '', thang: '', pl: '', sc: '', sp: '', dh: '', kt: '' }

export default function QuyetToanListPage() {
  const router = useRouter()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<QtListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loi, setLoi] = useState<string | null>(null)
  const [migration, setMigration] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState<Loc>(LOC_RONG)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [order, setOrder] = useState<string[]>(COLS.map((c) => c.key))
  const [drag, setDrag] = useState<string | null>(null)
  const [xuat, setXuat] = useState(false)
  const { widths, startResize } = useResizableColumns('qt-list-tong', Object.fromEntries(COLS.map((c) => [c.key, c.width])))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quyet-toan')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setLoi(j.error ?? 'Không tải được dữ liệu')
      else if (j.migration_missing) setMigration(j.message)
      else { setLoi(null); setMigration(null); setRows(j.rows ?? []) }
    } catch {
      setLoi('Không kết nối được máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu khi mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Quyết toán · Bảng tổng hợp đoàn</span>)
    setOnRefresh(load)
    return () => { setBreadcrumb(null); setOnRefresh(null) }
  }, [setBreadcrumb, setOnRefresh, load])

  // Thứ tự cột đã lưu (cột mới thêm sau vẫn hiện ở cuối)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? 'null') as string[] | null
      if (Array.isArray(saved)) {
        const valid = saved.filter((k) => COL_MAP.has(k))
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage sau khi mount (tránh lệch SSR)
        setOrder([...valid, ...COLS.map((c) => c.key).filter((k) => !valid.includes(k))])
      }
    } catch { /* bỏ qua */ }
  }, [])
  const luuOrder = (next: string[]) => {
    setOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch { /* bỏ qua */ }
  }

  const opts = (vals: (string | null)[], label: (v: string) => string = (v) => v) => {
    const uniq = [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => label(a).localeCompare(label(b), 'vi'))
    return uniq.map((v) => ({ value: v, label: label(v) }))
  }
  const boLoc = useMemo(() => ({
    vp: opts(rows.map((r) => r.bo_phan)),
    thang: opts(rows.map((r) => r.thang), thangVN).sort((a, b) => b.value.localeCompare(a.value)),
    pl: opts(rows.map((r) => r.phan_loai)),
    sc: opts(rows.map((r) => r.sale_chinh)),
    sp: opts(rows.map((r) => r.sale_phu)),
    dh: opts(rows.map((r) => r.dieu_hanh)),
    kt: opts(rows.map((r) => r.ke_toan)),
  }), [rows])

  const shown = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    const k = norm(q.trim())
    let out = rows.filter((r) =>
      (!loc.vp || r.bo_phan === loc.vp) && (!loc.tt || r.tinh_trang === loc.tt) && (!loc.thang || r.thang === loc.thang) &&
      (!loc.pl || r.phan_loai === loc.pl) && (!loc.sc || r.sale_chinh === loc.sc) && (!loc.sp || r.sale_phu === loc.sp) &&
      (!loc.dh || r.dieu_hanh === loc.dh) && (!loc.kt || r.ke_toan === loc.kt) &&
      (!k || norm(`${r.ten_doan} ${r.khach ?? ''} ${r.lich_trinh ?? ''} ${r.so_hop_dong ?? ''}`).includes(k)))
    if (sort) {
      const c = COL_MAP.get(sort.key)
      if (c && c.key !== 'stt') {
        out = [...out].sort((a, b) => {
          const va = c.get(a, 0), vb = c.get(b, 0)
          if (va == null && vb == null) return 0
          if (va == null) return 1
          if (vb == null) return -1
          const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'vi')
          return sort.dir === 'asc' ? d : -d
        })
      }
    }
    return out
  }, [rows, loc, q, sort])

  const cols = order.map((k) => COL_MAP.get(k)!).filter(Boolean)
  const tong = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of COLS) if (c.num) t[c.key] = shown.reduce((s, r, i) => s + (Number(c.get(r, i)) || 0), 0)
    return t
  }, [shown])

  // Toạ độ dữ liệu: hàng 1..N = dòng đoàn, hàng N+1 = dòng tổng
  const getCellText = (r: number, c: number) => {
    const col = cols[c]
    if (!col) return ''
    if (r === shown.length) return col.num ? String(Math.round(tong[col.key] ?? 0)) : c === 0 ? 'Tổng' : ''
    const row = shown[r]
    if (!row) return ''
    const v = col.get(row, r)
    return col.num ? (v == null ? '' : String(Math.round(Number(v)))) : cellText(col, row, r)
  }
  const sel = useCellSelection(getCellText)
  const totalW = GUTTER_W + cols.reduce((s, c) => s + (widths[c.key] ?? c.width), 0)
  const coLoc = Object.values(loc).some(Boolean) || !!q

  async function xuatExcel() {
    setXuat(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('LIST TỔNG', { views: [{ state: 'frozen', ySplit: 1 }] })
      ws.columns = COLS.map((c) => ({ header: c.label, key: c.key, width: Math.max(8, Math.round(c.width / 7)) }))
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F4' } }
      shown.forEach((r, i) => {
        const vals: Record<string, string | number | null> = {}
        for (const c of COLS) vals[c.key] = c.num ? (c.get(r, i) as number | null) : c.key === 'stt' ? i + 1 : cellText(c, r, i)
        ws.addRow(vals)
      })
      const tr: Record<string, string | number> = { stt: '', ten_doan: 'TỔNG' }
      for (const c of COLS) if (c.num) tr[c.key] = tong[c.key]
      const last = ws.addRow(tr)
      last.font = { bold: true }
      COLS.forEach((c, i) => { if (c.num) ws.getColumn(i + 1).numFmt = '#,##0;[Red]-#,##0' })
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `LIST TONG quyet toan ${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally {
      setXuat(false)
    }
  }

  const locSelect = (k: keyof Loc, placeholder: string, options: { value: string; label: string }[]) => (
    <SelectMenu size="sm" className="w-40" value={loc[k]} placeholder={placeholder}
      options={[{ value: '', label: `${placeholder}: tất cả` }, ...options]} onChange={(v) => setLoc((x) => ({ ...x, [k]: v }))} />
  )

  const thBase = 'border-b border-r border-[#e0e0e0] bg-[#f8f9fa] text-[#5f6368] font-medium'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
        <h1 className="mr-2 text-base font-bold text-gray-900">Bảng tổng hợp đoàn</h1>
        <div className="relative w-56">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm đoàn, khách, số HĐ"
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-7 text-xs outline-none focus:ring-2 focus:ring-brand-100" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
        </div>
        {locSelect('vp', 'Văn phòng', boLoc.vp)}
        {locSelect('tt', 'Tình trạng', Object.entries(TINH_TRANG_CHAY_LABEL).map(([value, label]) => ({ value, label })))}
        {locSelect('thang', 'Tháng', boLoc.thang)}
        {locSelect('pl', 'Phân loại', boLoc.pl)}
        {locSelect('sc', 'Sale chính', boLoc.sc)}
        {locSelect('sp', 'Sale phụ', boLoc.sp)}
        {locSelect('dh', 'ĐH', boLoc.dh)}
        {locSelect('kt', 'KT', boLoc.kt)}
        {coLoc && <button type="button" onClick={() => { setLoc(LOC_RONG); setQ('') }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100">Bỏ lọc</button>}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">{shown.length.toLocaleString('vi-VN')} / {rows.length.toLocaleString('vi-VN')} đoàn</span>
          <button type="button" disabled={xuat || !shown.length} onClick={xuatExcel}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {xuat ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Xuất Excel
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : migration ? (
          <div className="m-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /> {migration}</div>
        ) : loi ? (
          <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{loi}</div>
        ) : (
          <div {...sel.wrapProps} className="erp-sheet-scroll absolute inset-0 overflow-auto outline-none">
            <table className="border-separate text-xs" style={{ borderSpacing: 0, tableLayout: 'fixed', width: totalW, borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0' }}>
              <colgroup>
                <col style={{ width: GUTTER_W }} />
                {cols.map((c) => <col key={c.key} style={{ width: widths[c.key] ?? c.width }} />)}
              </colgroup>
              <thead>
                <tr style={{ height: ROW_H_COORD }}>
                  <th className={clsx(thBase, 'sticky left-0 top-0 z-30')} />
                  {cols.map((c, i) => (
                    <th key={c.key} className={clsx(thBase, 'sticky top-0 z-20 text-center text-[11px]')}>{colLetter(i)}</th>
                  ))}
                </tr>
                <tr>
                  <th className={clsx(thBase, 'sticky left-0 z-30 text-center')} style={{ top: ROW_H_COORD }}>0</th>
                  {cols.map((c) => {
                    const s = sort?.key === c.key ? sort.dir : null
                    return (
                      <th key={c.key} draggable
                        onDragStart={(e) => { setDrag(c.key); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={(e) => { if (drag) e.preventDefault() }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (!drag || drag === c.key) return
                          const next = order.filter((k) => k !== drag)
                          next.splice(next.indexOf(c.key), 0, drag)
                          luuOrder(next)
                          setDrag(null)
                        }}
                        onDragEnd={() => setDrag(null)}
                        className={clsx(thBase, 'sticky z-20 select-none px-1.5 py-1.5 text-left font-semibold text-[#3c4043]', drag === c.key && 'opacity-40')}
                        style={{ top: ROW_H_COORD }}>
                        <div className="flex items-center gap-1">
                          <GripVertical size={11} className="shrink-0 cursor-grab text-gray-300" aria-hidden />
                          <button type="button" aria-label={`Sắp xếp theo ${c.label}`}
                            onClick={() => setSort((x) => (x?.key !== c.key ? { key: c.key, dir: 'asc' } : x.dir === 'asc' ? { key: c.key, dir: 'desc' } : null))}
                            className={clsx('flex min-w-0 flex-1 items-center gap-0.5 truncate text-left', c.num && 'justify-end', s && 'text-brand-700')}>
                            <span className="truncate">{c.label}</span>
                            {s === 'asc' && <ArrowUp size={11} className="shrink-0" />}
                            {s === 'desc' && <ArrowDown size={11} className="shrink-0" />}
                          </button>
                        </div>
                        <div className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-brand-400/50" onMouseDown={(e) => startResize(c.key, e)} />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="border-b border-r border-[#e0e0e0] px-4 py-10 text-center text-sm text-[#9aa0a6]">
                    {rows.length === 0 ? 'Chưa có đoàn nào nối với đơn CRM.' : 'Không có đoàn nào khớp bộ lọc.'}
                  </td></tr>
                )}
                {shown.map((r, ri) => (
                  <tr key={r.doan_id} className={clsx(sel.selectedRow === ri && '[&>td]:bg-brand-50/60')}
                    onDoubleClick={() => router.push(`/doan/${r.doan_id}?tab=quyet-toan`)}>
                    <td className="sticky left-0 z-10 border-b border-r border-[#e0e0e0] bg-[#f8f9fa] text-center font-medium text-[#5f6368]">{ri + 1}</td>
                    {cols.map((c, ci) => {
                      const v = c.get(r, ri)
                      return (
                        <td key={c.key} {...sel.cellProps(ri, ci)}
                          className={sel.cellClassName(ri, ci, clsx('truncate border-b border-r border-[#e0e0e0] bg-white px-1.5 py-1 text-[#3c4043]', c.num && 'text-right tabular-nums'))}
                          title={c.num ? undefined : cellText(c, r, ri)}>
                          {c.key === 'ten_doan' ? (
                            <Link href={`/doan/${r.doan_id}?tab=quyet-toan`} className="font-semibold text-brand-700 hover:underline" onMouseDown={(e) => e.stopPropagation()}>
                              {r.da_khoa && <Lock size={10} className="mr-1 inline text-violet-500" />}{r.ten_doan}
                            </Link>
                          ) : c.num ? (
                            <span className={typeof v === 'number' && v < 0 ? 'text-red-600' : ''}>{v == null ? '' : formatTien(v as number)}</span>
                          ) : cellText(c, r, ri)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {shown.length > 0 && (
                  <tr>
                    <td className="sticky left-0 z-10 border-b border-r border-[#e0e0e0] bg-[#f8f9fa] text-center font-medium text-[#5f6368]">{shown.length + 1}</td>
                    {cols.map((c, ci) => (
                      <td key={c.key} {...sel.cellProps(shown.length, ci)}
                        className={sel.cellClassName(shown.length, ci, clsx('truncate border-b border-r border-[#e0e0e0] bg-[#f8f9fa] px-1.5 py-1 font-bold text-[#3c4043]', c.num && 'text-right tabular-nums'))}>
                        {c.num ? <span className={(tong[c.key] ?? 0) < 0 ? 'text-red-600' : ''}>{formatTien(tong[c.key] ?? 0)}</span> : ci === 0 ? 'Tổng' : ''}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            {sel.menu}
          </div>
        )}
      </div>
    </div>
  )
}
