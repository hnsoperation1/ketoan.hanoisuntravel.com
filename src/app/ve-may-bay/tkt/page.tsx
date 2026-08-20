'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useResizableColumns } from '@/hooks/useResizableColumns'

type Tkt = { id: string; tkt_code: string; ten_nhan_vien: string | null; active: boolean; created_at: string }

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white placeholder:text-gray-300'

const TKT_COLS = [
  { key: 'ma_tkt', label: 'Mã TKT', width: 150 },
  { key: 'nv', label: 'Nhân viên phụ trách', width: 220 },
  { key: 'trang_thai', label: 'Trạng thái', width: 120 },
  { key: 'action', label: '', width: 60 },
]

export default function TktPage() {
  const { user } = useAuth()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [tkts, setTkts] = useState<Tkt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tktCode, setTktCode] = useState('')
  const [tenNhanVien, setTenNhanVien] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/tkt')
      if (!res.ok) throw new Error('load failed')
      const { data } = await res.json()
      setTkts(Array.isArray(data) ? data : [])
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

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">TKT</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  // useCellSelection/useResizableColumns PHẢI gọi trước early-return bên
  // dưới (Rules of Hooks — số lượng/thứ tự hook gọi phải giống nhau ở mọi
  // lần render, kể cả nhánh "Không có quyền truy cập").
  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection((r, c) => {
    const t = tkts[r]
    if (!t) return ''
    if (c === 0) return t.tkt_code ?? ''
    if (c === 1) return t.ten_nhan_vien ?? ''
    if (c === 2) return t.active ? 'Đang hoạt động' : 'Đã tắt'
    return ''
  })
  const { widths: tktWidths, startResize: startTktResize } = useResizableColumns('tkt-page', Object.fromEntries(TKT_COLS.map(c => [c.key, c.width])))
  const tktTotalWidth = TKT_COLS.reduce((sum, c) => sum + (tktWidths[c.key] ?? c.width), 0)

  if (!user?.is_super_admin) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 40px)' }}>
        <div className="text-center">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-500 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-400 text-sm">Chỉ Super Admin mới có thể quản lý TKT.</p>
        </div>
      </div>
    )
  }

  function openAdd() {
    setEditingId(null)
    setTktCode('')
    setTenNhanVien('')
    setFormOpen(true)
  }

  function openEdit(t: Tkt) {
    setEditingId(t.id)
    setTktCode(t.tkt_code)
    setTenNhanVien(t.ten_nhan_vien ?? '')
    setFormOpen(true)
  }

  async function save() {
    if (!tktCode.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ve-may-bay/tkt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, tkt_code: tktCode.trim(), ten_nhan_vien: tenNhanVien.trim() || null, active: true }),
      })
      if (res.ok) {
        setFormOpen(false)
        loadData()
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(t: Tkt) {
    await fetch('/api/ve-may-bay/tkt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, tkt_code: t.tkt_code, ten_nhan_vien: t.ten_nhan_vien, active: !t.active }),
    })
    loadData()
  }

  return (
    <div className="px-5 pb-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Mỗi TKT gán 1 nhóm Telegram ở trang &quot;Nhóm Telegram&quot;.</p>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={15} /> Thêm TKT
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 mb-3">{editingId ? 'Sửa TKT' : 'Thêm TKT'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mã TKT *</label>
                <input value={tktCode} onChange={e => setTktCode(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tên nhân viên phụ trách</label>
                <input value={tenNhanVien} onChange={e => setTenNhanVien(e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">Huỷ</button>
              <button onClick={save} disabled={saving || !tktCode.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saving && <Loader2 size={14} className="animate-spin" />} Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div {...wrapProps} className="overflow-x-auto select-none outline-none">
          <table className="text-sm list-table border-collapse" style={{ tableLayout: 'fixed', width: tktTotalWidth }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {TKT_COLS.map(c => (
                  <th key={c.key} style={{ width: tktWidths[c.key] ?? c.width }}
                    className="relative text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none">
                    {c.label}
                    <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startTktResize(c.key, e)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={4} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : tkts.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-14 text-center text-gray-400">Chưa có TKT nào.</td></tr>
              ) : tkts.map((t, i) => (
                <tr key={t.id} className="hover:bg-gray-50/70 transition-colors">
                  <td {...cellProps(i, 0)} className={cellClassName(i, 0, 'px-4 py-2.5 font-semibold text-gray-800 cursor-cell')}>{t.tkt_code}</td>
                  <td {...cellProps(i, 1)} className={cellClassName(i, 1, 'px-4 py-2.5 text-gray-600 cursor-cell')}>{t.ten_nhan_vien ?? '—'}</td>
                  <td {...cellProps(i, 2)} className={cellClassName(i, 2, 'px-4 py-2.5 cursor-cell')}>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      {t.active ? 'Đang hoạt động' : 'Đã tắt'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(t)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 mr-3">Sửa</button>
                    <button onClick={() => toggleActive(t)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
                      {t.active ? 'Tắt' : 'Bật lại'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {menu}
    </div>
  )
}
