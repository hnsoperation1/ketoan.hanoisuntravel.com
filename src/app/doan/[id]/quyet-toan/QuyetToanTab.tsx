'use client'

// Tab "Quyết toán" của đoàn (đặc tả tai-lieu-tham-khao/spec-quyet-toan-tour.md §5.2). Dữ liệu CRM + qt_* đọc qua
// API ketoan (/api/quyet-toan/don/<opp>) — kế toán không vào CRM. Các mục chia bằng SubSidebar.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, ClipboardList, Receipt, TrendingUp, Building2, Wallet, HandCoins, Percent, History, Loader2, AlertTriangle,
} from 'lucide-react'
import { SubSidebar, type SubSidebarItem } from '@/components/SubSidebar'
import { apSoChot, tinhTuBundle, type QtBundle, type QtBundleResponse } from '@/lib/quyetToanBundle'
import { useQtCall, type QtCtx } from './shared'
import TongQuan from './TongQuan'
import DuChi from './DuChi'
import ChiPhi from './ChiPhi'
import DoanhThu from './DoanhThu'
import Ncc from './Ncc'
import ThuKhach from './ThuKhach'
import TamUng from './TamUng'
import ThueLoiNhuan from './ThueLoiNhuan'
import LichSu from './LichSu'

type Muc = 'tong-quan' | 'du-chi' | 'chi-phi' | 'doanh-thu' | 'ncc' | 'thu-khach' | 'tam-ung' | 'thue-ln' | 'lich-su'

export default function QuyetToanTab({ opportunityId, reloadSignal }: { opportunityId: string | null; reloadSignal: number }) {
  const [muc, setMuc] = useState<Muc>('tong-quan')
  const [data, setData] = useState<QtBundleResponse | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<{ msg: string; loi: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((msg: string, isLoi = false) => {
    setToastMsg({ msg, loi: isLoi })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), isLoi ? 4500 : 2200)
  }, [])

  const load = useCallback(async () => {
    if (!opportunityId) return
    try {
      const res = await fetch(`/api/quyet-toan/don/${opportunityId}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoi(j.error ?? 'Không tải được dữ liệu quyết toán')
      } else {
        setLoi(null)
        setData(j as QtBundleResponse)
      }
    } catch {
      setLoi('Không kết nối được máy chủ')
    } finally {
      setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu khi mount / khi trang bấm Làm mới (reloadSignal)
    void load()
  }, [load, reloadSignal])

  const call = useQtCall(opportunityId ?? '', load, toast)

  const b = data && !('migration_missing' in data && data.migration_missing) ? (data as QtBundle) : null
  const kq = useMemo(() => (b ? apSoChot(tinhTuBundle(b), b.chot, !!b.qt?.da_khoa) : null), [b])

  if (!opportunityId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Đoàn chưa nối với đơn CRM</div>
      </div>
    )
  }
  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
  }
  if (data && 'migration_missing' in data && data.migration_missing) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {data.message}
        </div>
      </div>
    )
  }
  if (loi || !b || !kq) {
    return <div className="p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{loi ?? 'Không tải được dữ liệu quyết toán'}</div></div>
  }

  const ten = (id: string | null | undefined) => (id ? b.names[id] ?? b.users.find((u) => u.id === id)?.full_name ?? '' : '')
  const ctx: QtCtx = { b, kq, khoa: !!b.qt?.da_khoa, call, toast, ten }

  const thieuChungTu = b.chi_phi.filter((c) => c.nguoi_chi === 'ncc' && !c.co_hd_ncc && !c.hoa_don_id).length
  const choXuLy = (b.qt?.chi_phi_trang_thai === 'cho_ke_toan' ? 1 : 0) + (b.qt?.chi_phi_xin_mo_lai ? 1 : 0) + (b.qt?.khach_xin_mo_lai ? 1 : 0)
  const items: SubSidebarItem[] = [
    { id: 'tong-quan', label: 'Tổng quan', Icon: LayoutDashboard, count: choXuLy || undefined, tone: 'red' },
    { id: 'du-chi', label: 'Dự chi', Icon: ClipboardList, count: b.du_chi[0] && !b.du_chi[0].ke_toan_nhan_at && !b.du_chi[0].ly_do_tra_lai ? 1 : undefined, tone: 'red' },
    { id: 'chi-phi', label: 'Chi phí thực tế', Icon: Receipt, count: thieuChungTu || undefined, tone: 'red' },
    { id: 'doanh-thu', label: 'Doanh thu & phát sinh', Icon: TrendingUp },
    { id: 'ncc', label: 'NCC', Icon: Building2, count: kq.congNoNcc.filter((r) => r.lechHoaDon).length || undefined, tone: 'red' },
    { id: 'thu-khach', label: 'Thu khách', Icon: Wallet },
    { id: 'tam-ung', label: 'Tạm ứng', Icon: HandCoins, count: b.tam_ung.filter((t) => t.trang_thai === 'de_nghi').length || undefined, tone: 'red' },
    { id: 'thue-ln', label: 'Thuế & lợi nhuận', Icon: Percent },
    { id: 'lich-su', label: 'Lịch sử', Icon: History, group: 'Khác' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <SubSidebar items={items} value={muc} onChange={(v) => setMuc(v as Muc)} storageKey="kt-quyet-toan-subsidebar" />
      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 p-4 md:p-5">
        {muc === 'tong-quan' && <TongQuan {...ctx} />}
        {muc === 'du-chi' && <DuChi {...ctx} />}
        {muc === 'chi-phi' && <ChiPhi {...ctx} />}
        {muc === 'doanh-thu' && <DoanhThu {...ctx} />}
        {muc === 'ncc' && <Ncc {...ctx} />}
        {muc === 'thu-khach' && <ThuKhach {...ctx} />}
        {muc === 'tam-ung' && <TamUng {...ctx} />}
        {muc === 'thue-ln' && <ThueLoiNhuan {...ctx} />}
        {muc === 'lich-su' && <LichSu {...ctx} />}
      </div>
      {toastMsg && (
        <div className={`fixed bottom-6 left-1/2 z-[400] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${toastMsg.loi ? 'bg-red-600' : 'bg-gray-900'}`}>
          {toastMsg.msg}
        </div>
      )}
    </div>
  )
}
