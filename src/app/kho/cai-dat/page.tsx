'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

interface Kho {
  id: string
  ten_kho: string
  dia_chi: string | null
}
interface VatPham {
  id: string
  ten: string
  don_vi: string
}
interface ThuKho {
  telegram_user_id: number
  ho_ten: string
  kho_id: string
}
interface TelegramGroup {
  chat_id: number
  label: string
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1 mb-4">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

function RowItem({ label, sub, onDelete }: { label: string; sub?: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-gray-800 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function KhoCaiDatPage() {
  const { setBreadcrumb } = useTopbar()
  const [kho, setKho] = useState<Kho[]>([])
  const [vatPham, setVatPham] = useState<VatPham[]>([])
  const [thuKho, setThuKho] = useState<ThuKho[]>([])
  const [groups, setGroups] = useState<TelegramGroup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [rKho, rThuKho, rGroups] = await Promise.all([
      fetch('/api/kho'),
      fetch('/api/kho/thu-kho'),
      fetch('/api/kho/telegram-groups'),
    ])
    if (rKho.ok) {
      const d = await rKho.json()
      setKho(d.kho)
      setVatPham(d.vatPham)
    }
    if (rThuKho.ok) setThuKho((await rThuKho.json()).thuKho)
    if (rGroups.ok) setGroups((await rGroups.json()).groups)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi mount, pattern chuẩn cho fetch-on-mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(
      <span className="text-sm font-semibold text-gray-700">
        <a href="/kho" className="hover:underline text-gray-400">Kho quà tặng</a> / Cài đặt
      </span>,
    )
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  const khoTen = (id: string) => kho.find((k) => k.id === id)?.ten_kho ?? '—'

  // ─── Kho ───
  const [tenKho, setTenKho] = useState('')
  async function addKho(e: React.FormEvent) {
    e.preventDefault()
    if (!tenKho.trim()) return
    await fetch('/api/kho', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ten_kho: tenKho }) })
    setTenKho('')
    load()
  }
  async function deleteKho(id: string) {
    await fetch(`/api/kho/${id}`, { method: 'DELETE' })
    load()
  }

  // ─── Vật phẩm ───
  const [tenVatPham, setTenVatPham] = useState('')
  const [donViVatPham, setDonViVatPham] = useState('')
  async function addVatPham(e: React.FormEvent) {
    e.preventDefault()
    if (!tenVatPham.trim()) return
    await fetch('/api/kho/vat-pham', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten: tenVatPham, don_vi: donViVatPham }),
    })
    setTenVatPham('')
    setDonViVatPham('')
    load()
  }
  async function deleteVatPham(id: string) {
    await fetch(`/api/kho/vat-pham/${id}`, { method: 'DELETE' })
    load()
  }

  // ─── Thủ kho ───
  const [tkTelegramId, setTkTelegramId] = useState('')
  const [tkHoTen, setTkHoTen] = useState('')
  const [tkKhoId, setTkKhoId] = useState('')
  async function addThuKho(e: React.FormEvent) {
    e.preventDefault()
    if (!tkTelegramId.trim() || !tkHoTen.trim() || !tkKhoId) return
    await fetch('/api/kho/thu-kho', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_user_id: tkTelegramId, ho_ten: tkHoTen, kho_id: tkKhoId }),
    })
    setTkTelegramId('')
    setTkHoTen('')
    setTkKhoId('')
    load()
  }
  async function deleteThuKho(id: number) {
    await fetch(`/api/kho/thu-kho/${id}`, { method: 'DELETE' })
    load()
  }

  // ─── Nhóm Telegram ───
  const [grpChatId, setGrpChatId] = useState('')
  const [grpLabel, setGrpLabel] = useState('')
  async function addGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!grpChatId.trim() || !grpLabel.trim()) return
    await fetch('/api/kho/telegram-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: grpChatId, label: grpLabel }),
    })
    setGrpChatId('')
    setGrpLabel('')
    load()
  }
  async function deleteGroup(chatId: number) {
    await fetch(`/api/kho/telegram-groups/${chatId}`, { method: 'DELETE' })
    load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="animate-spin text-gray-300" size={28} />
      </div>
    )
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400'
  const addBtnCls = 'flex items-center justify-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Cài đặt kho</h1>

      <Section title="Nhóm Telegram" hint="Nhóm chat bot lắng nghe cho luồng kho. Thêm bot vào nhóm, nhắn thử 1 tin — bot sẽ báo chat ID (số âm) để dán vào đây.">
        <form onSubmit={addGroup} className="flex gap-2 mb-3">
          <input placeholder="Chat ID (vd -1001234567890)" value={grpChatId} onChange={(e) => setGrpChatId(e.target.value)} className={inputCls} />
          <input placeholder="Tên nhóm" value={grpLabel} onChange={(e) => setGrpLabel(e.target.value)} className={inputCls} />
          <button type="submit" className={addBtnCls}><Plus size={15} /></button>
        </form>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có nhóm nào.</p>
        ) : (
          groups.map((g) => <RowItem key={g.chat_id} label={g.label} sub={String(g.chat_id)} onDelete={() => deleteGroup(g.chat_id)} />)
        )}
      </Section>

      <Section title="Kho" hint="3 kho quà tặng/lưu niệm.">
        <form onSubmit={addKho} className="flex gap-2 mb-3">
          <input placeholder="Tên kho (vd Kho Hà Nội)" value={tenKho} onChange={(e) => setTenKho(e.target.value)} className={inputCls} />
          <button type="submit" className={addBtnCls}><Plus size={15} /></button>
        </form>
        {kho.length === 0 ? <p className="text-sm text-gray-400">Chưa có kho nào.</p> : kho.map((k) => <RowItem key={k.id} label={k.ten_kho} onDelete={() => deleteKho(k.id)} />)}
      </Section>

      <Section title="Thủ kho" hint="Ai được thao tác kho nào qua bot Telegram. Lấy ID Telegram bằng cách nhờ họ nhắn thử vào nhóm kho — bot sẽ báo ID nếu chưa được khai báo.">
        <form onSubmit={addThuKho} className="flex flex-wrap gap-2 mb-3">
          <input placeholder="ID Telegram" value={tkTelegramId} onChange={(e) => setTkTelegramId(e.target.value)} className={`${inputCls} w-36`} />
          <input placeholder="Họ tên" value={tkHoTen} onChange={(e) => setTkHoTen(e.target.value)} className={`${inputCls} flex-1 min-w-[140px]`} />
          <select value={tkKhoId} onChange={(e) => setTkKhoId(e.target.value)} className={`${inputCls} w-40`}>
            <option value="">Kho phụ trách</option>
            {kho.map((k) => (
              <option key={k.id} value={k.id}>{k.ten_kho}</option>
            ))}
          </select>
          <button type="submit" className={addBtnCls}><Plus size={15} /></button>
        </form>
        {thuKho.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có thủ kho nào.</p>
        ) : (
          thuKho.map((t) => (
            <RowItem key={t.telegram_user_id} label={t.ho_ten} sub={`${khoTen(t.kho_id)} · ID ${t.telegram_user_id}`} onDelete={() => deleteThuKho(t.telegram_user_id)} />
          ))
        )}
      </Section>

      <Section title="Danh mục vật phẩm" hint="Bot tự thêm vật phẩm mới khi thủ kho nhắc tới lần đầu — mục này chỉ để sửa/dọn lại tên nếu cần.">
        <form onSubmit={addVatPham} className="flex gap-2 mb-3">
          <input placeholder="Tên vật phẩm" value={tenVatPham} onChange={(e) => setTenVatPham(e.target.value)} className={`${inputCls} flex-1`} />
          <input placeholder="Đơn vị (mặc định: cái)" value={donViVatPham} onChange={(e) => setDonViVatPham(e.target.value)} className={`${inputCls} w-40`} />
          <button type="submit" className={addBtnCls}><Plus size={15} /></button>
        </form>
        {vatPham.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có vật phẩm nào.</p>
        ) : (
          vatPham.map((v) => <RowItem key={v.id} label={v.ten} sub={v.don_vi} onDelete={() => deleteVatPham(v.id)} />)
        )}
      </Section>
    </div>
  )
}
