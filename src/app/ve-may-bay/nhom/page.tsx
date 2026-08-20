'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Send, ShieldCheck, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'

type Tkt = { id: string; tkt_code: string; ten_nhan_vien: string | null; active: boolean }
type Group = {
  id: string
  telegram_chat_id: number
  telegram_chat_title: string | null
  tkt_id: string | null
  ma_khach_mac_dinh: string | null
  active: boolean
  chi_hoan_ve: boolean
  created_at: string
  ve_tkt: { tkt_code: string; ten_nhan_vien: string | null } | null
}

// "Khách hàng mặc định" — mặc định chỉ hiện text to + icon bút, KHÔNG cho
// gõ trực tiếp (dễ bấm nhầm sửa khi đang lướt bảng); bấm bút mới bật input
// để sửa, Enter/rời ô để lưu, Esc để huỷ.
function MaKhachCell({ groupId, value, saving, onSave }: {
  groupId: string
  value: string | null
  saving: boolean
  onSave: (groupId: string, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value ?? '')
  useEffect(() => { setText(value ?? '') }, [value])

  function commit() {
    setEditing(false)
    if (text.trim() !== (value ?? '')) onSave(groupId, text)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        disabled={saving}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setText(value ?? ''); setEditing(false) }
        }}
        placeholder="Mã khách..."
        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white w-44"
      />
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} disabled={saving}
      className="flex items-center gap-2 group text-left disabled:opacity-50">
      <span className={value ? 'text-sm font-semibold text-gray-800' : 'text-sm text-gray-300'}>
        {value || 'Chưa gán'}
      </span>
      <Pencil size={13} className="text-gray-300 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
    </button>
  )
}

export default function NhomTelegramPage() {
  const { user } = useAuth()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [groups, setGroups] = useState<Group[]>([])
  const [tkts, setTkts] = useState<Tkt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [groupsRes, tktRes] = await Promise.all([
        fetch('/api/ve-may-bay/groups'),
        fetch('/api/ve-may-bay/tkt'),
      ])
      if (!groupsRes.ok || !tktRes.ok) throw new Error('load failed')
      const { data: groupData } = await groupsRes.json()
      const { data: tktData } = await tktRes.json()
      setGroups(Array.isArray(groupData) ? groupData : [])
      setTkts(Array.isArray(tktData) ? tktData : [])
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
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Nhóm Telegram</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  if (!user?.is_super_admin) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 40px)' }}>
        <div className="text-center">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-500 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-400 text-sm">Chỉ Super Admin mới có thể quản lý nhóm Telegram.</p>
        </div>
      </div>
    )
  }

  async function ganTkt(groupId: string, tktId: string) {
    setSaving(groupId)
    try {
      const res = await fetch(`/api/ve-may-bay/groups/${groupId}/gan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tkt_id: tktId || null }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setGroups(prev => prev.map(g => g.id === groupId ? data : g))
      }
    } finally {
      setSaving(null)
    }
  }

  async function updateMaKhach(groupId: string, maKhach: string) {
    setSaving(groupId)
    try {
      const res = await fetch(`/api/ve-may-bay/groups/${groupId}/gan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ma_khach_mac_dinh: maKhach || null }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setGroups(prev => prev.map(g => g.id === groupId ? data : g))
      }
    } finally {
      setSaving(null)
    }
  }

  async function toggleChiHoanVe(groupId: string, value: boolean) {
    setSaving(groupId)
    try {
      const res = await fetch(`/api/ve-may-bay/groups/${groupId}/gan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chi_hoan_ve: value }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setGroups(prev => prev.map(g => g.id === groupId ? data : g))
      }
    } finally {
      setSaving(null)
    }
  }

  const choGan = groups.filter(g => !g.tkt_id)
  const daGan = groups.filter(g => g.tkt_id)

  return (
    <div className="px-5 pb-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Add bot vào nhóm TKT trong Telegram trước — nhóm sẽ tự xuất hiện ở đây để gán.
        </p>
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {loadError && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
          <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
        </div>
      )}

      {!loadError && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Send size={16} className="text-brand-500" /> Nhóm chờ gán ({loading ? '…' : choGan.length})
            </h2>
            {loading ? (
              <p className="text-sm text-gray-400">Đang tải...</p>
            ) : choGan.length === 0 ? (
              <p className="text-sm text-gray-400">Không có nhóm nào đang chờ gán.</p>
            ) : (
              <div className="space-y-2">
                {choGan.map(g => (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                    <div>
                      <div className="font-semibold text-gray-800">{g.telegram_chat_title ?? `Chat ${g.telegram_chat_id}`}</div>
                      <div className="text-xs text-gray-400">chat_id: {g.telegram_chat_id}</div>
                    </div>
                    <select disabled={saving === g.id} defaultValue=""
                      onChange={e => ganTkt(g.id, e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                      <option value="" disabled>Chọn TKT...</option>
                      {tkts.map(t => (
                        <option key={t.id} value={t.id}>{t.tkt_code}{t.ten_nhan_vien ? ` — ${t.ten_nhan_vien}` : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 list-table-container">
            <h2 className="font-bold text-gray-900 mb-3">Nhóm đã gán ({loading ? '…' : daGan.length})</h2>
            {loading ? (
              <p className="text-sm text-gray-400">Đang tải...</p>
            ) : daGan.length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có nhóm nào được gán TKT.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm list-table">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-3 py-2 font-semibold">Nhóm</th>
                      <th className="px-3 py-2 font-semibold">TKT</th>
                      <th className="px-3 py-2 font-semibold">Khách hàng mặc định</th>
                      <th className="px-3 py-2 font-semibold">Chỉ vé hoàn</th>
                      <th className="px-3 py-2 font-semibold">Trạng thái</th>
                      <th className="px-3 py-2 font-semibold">Đổi TKT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {daGan.map(g => (
                      <tr key={g.id}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-800">{g.telegram_chat_title ?? `Chat ${g.telegram_chat_id}`}</div>
                          <div className="text-xs text-gray-400">chat_id: {g.telegram_chat_id}</div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {g.ve_tkt?.tkt_code}
                          {g.ve_tkt?.ten_nhan_vien && <span className="text-gray-400"> — {g.ve_tkt.ten_nhan_vien}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <MaKhachCell groupId={g.id} value={g.ma_khach_mac_dinh} saving={saving === g.id} onSave={updateMaKhach} />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={g.chi_hoan_ve} disabled={saving === g.id}
                            onChange={e => toggleChiHoanVe(g.id, e.target.checked)}
                            title="Bot mặc định đọc mọi tin trong nhóm này là vé hoàn"
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${g.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            {g.active ? 'Bot đang trong nhóm' : 'Bot đã rời nhóm'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <select disabled={saving === g.id} value={g.tkt_id ?? ''}
                            onChange={e => ganTkt(g.id, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                            <option value="">— Bỏ gán —</option>
                            {tkts.map(t => (
                              <option key={t.id} value={t.id}>{t.tkt_code}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
