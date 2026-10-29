'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { ModalOverlay } from '@/components/ModalOverlay'
import { formatTien } from '@/lib/format'
import { btnGhost } from './shared'

export type SaoKeChon = { sao_ke_id: string; ngay: string | null; so_tien: number; tai_khoan: string; dien_giai: string | null; don_vi: string | null }

type Row = {
  id: string; tai_khoan: string; ngay: string | null; ngay_iso: string | null; ma: string | null; don_vi: string | null
  dien_giai: string | null; thu: number | null; chi: number | null; ten_du_an: string | null; da_dung: boolean
}

/** Chọn 1 dòng sao kê (thu > 0 cho thu khách, chi > 0 cho chi NCC) để điền ngày / số tiền / tài khoản. */
export function SaoKePicker({ loai, goiY, onPick, onClose }: { loai: 'thu' | 'chi'; goiY?: string; onPick: (r: SaoKeChon) => void; onClose: () => void }) {
  const [q, setQ] = useState(goiY ?? '')
  const [tim, setTim] = useState(goiY ?? '')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setTim(q.trim()); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quyet-toan/sao-ke?loai=${loai}&page=${page}&q=${encodeURIComponent(tim)}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setLoi(j.error ?? 'Không tải được sao kê'); setRows([]) }
      else { setLoi(null); setRows(j.rows ?? []); setTotal(j.total ?? 0) }
    } catch {
      setLoi('Không kết nối được máy chủ')
    } finally {
      setLoading(false)
    }
  }, [loai, page, tim])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi đổi trang / từ khoá
    void load()
  }, [load])

  const soTrang = Math.max(1, Math.ceil(total / 50))

  return (
    <ModalOverlay className="z-[200] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="font-bold text-gray-900">Chọn từ sao kê · {loai === 'thu' ? 'tiền vào' : 'tiền ra'}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-5 pt-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm diễn giải, đơn vị, mã"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Xoá tìm kiếm" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
          ) : loi ? (
            <p className="px-3 py-6 text-center text-sm text-red-600">{loi}</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">Không có dòng sao kê phù hợp.</p>
          ) : rows.map((r) => {
            const tien = Number(loai === 'thu' ? r.thu : r.chi) || 0
            return (
              <button key={r.id} type="button"
                onClick={() => { onPick({ sao_ke_id: r.id, ngay: r.ngay_iso, so_tien: tien, tai_khoan: r.tai_khoan, dien_giai: r.dien_giai, don_vi: r.don_vi }); onClose() }}
                className={clsx('flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50', r.da_dung && 'opacity-60')}>
                <div className="w-24 shrink-0 text-xs text-gray-500">{r.ngay}<div className="text-[11px]">{r.tai_khoan}</div></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-gray-800">{r.dien_giai || '—'}</p>
                  <p className="truncate text-xs text-gray-400">{[r.don_vi, r.ma, r.ten_du_an].filter(Boolean).join(' · ')}{r.da_dung ? ' · đã gắn khoản khác' : ''}</p>
                </div>
                <div className="shrink-0 font-semibold tabular-nums text-gray-900">{formatTien(tien)}</div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
          <span>{total.toLocaleString('vi-VN')} dòng · trang {page + 1}/{soTrang}</span>
          <div className="flex gap-2">
            <button type="button" className={btnGhost} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Trước</button>
            <button type="button" className={btnGhost} disabled={page + 1 >= soTrang} onClick={() => setPage((p) => p + 1)}>Sau</button>
            <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
