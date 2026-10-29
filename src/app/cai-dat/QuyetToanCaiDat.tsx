'use client'

// Cài đặt Quyết toán (chỉ Super Admin): tỷ lệ hoa hồng mặc định, hoa hồng khi LN âm, người được Khoá sổ / Mở khoá.
// Lưu ở qt_cau_hinh qua /api/quyet-toan/cau-hinh.

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SaBadge } from '@/components/SaBadge'
import { SelectMenu } from '@/components/SelectMenu'
import { UserMultiPicker, type PickerUser } from '@/components/UserPicker'
import { HH_TY_LE_MAC_DINH, type HhKhiLnAm, type HhTyLe } from '@/lib/quyetToan'
import type { QtCauHinh } from '@/lib/quyetToanBundle'

const VAI_TRO: { k: keyof HhTyLe; label: string }[] = [
  { k: 'cskh', label: 'CF CSKH' },
  { k: 'sale_chinh', label: 'Sale chính' },
  { k: 'sale_phu', label: 'Sale phụ' },
  { k: 'dieu_hanh', label: 'Điều hành' },
  { k: 'ke_toan', label: 'Kế toán' },
]

export function QuyetToanCaiDat() {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; loi: boolean } | null>(null)
  const [migration, setMigration] = useState<string | null>(null)
  const [users, setUsers] = useState<PickerUser[]>([])
  const [tyLe, setTyLe] = useState<Record<keyof HhTyLe, string>>(() => Object.fromEntries(Object.entries(HH_TY_LE_MAC_DINH).map(([k, v]) => [k, String(v)])) as Record<keyof HhTyLe, string>)
  const [khiAm, setKhiAm] = useState<HhKhiLnAm>('giu_am')
  const [nguoi, setNguoi] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const apDung = (c: QtCauHinh) => {
    setTyLe(Object.fromEntries(Object.entries(c.hh_ty_le).map(([k, v]) => [k, String(v)])) as Record<keyof HhTyLe, string>)
    setKhiAm(c.hh_khi_ln_am)
    setNguoi(c.nguoi_khoa_so)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/quyet-toan/cau-hinh')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ text: j.error ?? 'Không tải được cài đặt', loi: true })
      else if (j.migration_missing) setMigration(j.message)
      else { apDung(j.cau_hinh); setUsers(j.users ?? []) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function luu(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/quyet-toan/cau-hinh', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ text: j.error ?? 'Lưu không được', loi: true })
      else { apDung(j.cau_hinh); setMsg({ text: 'Đã lưu', loi: false }) }
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">Quyết toán<SaBadge className="ml-1.5" /></p>
      {loading ? <Loader2 className="animate-spin text-gray-300" size={20} /> : migration ? (
        <p className="text-sm text-amber-700">{migration}</p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Tỷ lệ hoa hồng mặc định (%)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VAI_TRO.map((v) => (
                <label key={v.k} className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-gray-500">{v.label}</span>
                  <input inputMode="decimal" value={tyLe[v.k]} onChange={(e) => setTyLe((x) => ({ ...x, [v.k]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-brand-100" />
                </label>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => luu({ hh_ty_le: Object.fromEntries(Object.entries(tyLe).map(([k, v]) => [k, Number(String(v).replace(',', '.'))])) })}
              className="mt-2 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Lưu tỷ lệ</button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Hoa hồng khi lợi nhuận âm</p>
            <SelectMenu size="sm" className="max-w-xs" value={khiAm} disabled={busy}
              options={[{ value: 'giu_am', label: 'Giữ số âm' }, { value: 've_0', label: 'Về 0' }]}
              onChange={(v) => luu({ hh_khi_ln_am: v })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Người được khoá sổ / mở khoá</p>
            <UserMultiPicker users={users} values={nguoi} disabled={busy} placeholder="Chọn người" title="Người được khoá sổ"
              onChange={(ids) => luu({ nguoi_khoa_so: ids })} />
          </div>
        </>
      )}
      {msg && <p className={`text-xs font-semibold ${msg.loi ? 'text-red-600' : 'text-emerald-600'}`}>{msg.text}</p>}
    </div>
  )
}
