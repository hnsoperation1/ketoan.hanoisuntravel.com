'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { ModalOverlay } from '@/components/ModalOverlay'
import { formatDateVN } from '@/lib/format'
import type { Doan } from '@/types'

// Ô thông tin so sánh khi gộp — khớp TRUONG_GOP ở api/doan/[id]/gop/route.ts
const TRUONG: { key: keyof Doan; label: string }[] = [
  { key: 'ten_doan', label: 'Tên đoàn' },
  { key: 'hanh_trinh', label: 'Tuyến du lịch' },
  { key: 'ngay_di', label: 'Ngày đi' },
  { key: 'ngay_ve', label: 'Ngày về' },
  { key: 'sl_khach', label: 'Số khách' },
  { key: 'loai_doan', label: 'Loại' },
  { key: 'ten_chuong_trinh', label: 'Tên chương trình' },
  { key: 'thoi_gian_chuong_trinh', label: 'Thời gian chương trình' },
  { key: 'dia_diem_chuong_trinh', label: 'Địa điểm chương trình' },
  { key: 'diem_don_tra', label: 'Điểm đón trả' },
  { key: 'dieu_hanh_phu_trach', label: 'Điều hành phụ trách' },
  { key: 'dieu_hanh_dien_thoai', label: 'SĐT điều hành' },
]

type DoanCrm = Partial<Doan> & { id: string; ten_doan: string; ngay_di: string; so_ho_so: number }

function hienGiaTri(key: keyof Doan, v: unknown): string {
  if (v == null || v === '') return ''
  if (key === 'ngay_di' || key === 'ngay_ve') return formatDateVN(String(v))
  if (key === 'loai_doan') return v === 'su_kien' ? 'Sự kiện' : 'Tour'
  return String(v)
}

// Gộp đoàn tạo tay (doan) vào 1 đoàn từ CRM: chọn đoàn CRM → chọn giữ bản nào cho từng ô khác nhau → gộp.
export function GopDoanModal({ doan, soHoSo, onClose, onDone }: {
  doan: Doan
  soHoSo: number
  onClose: () => void
  onDone: (vaoDoanId: string) => void
}) {
  const [ds, setDs] = useState<DoanCrm[] | null>(null)
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<DoanCrm | null>(null)
  const [giuTay, setGiuTay] = useState<Set<string>>(new Set())
  const [dangGop, setDangGop] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/doan/${doan.id}/gop`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Không tải được danh sách đoàn CRM')
        setDs(j.doan ?? [])
      })
      .catch((e) => { setLoi(e instanceof Error ? e.message : String(e)); setDs([]) })
  }, [doan.id])

  const loc = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (ds ?? []).filter((d) => !s || `${d.ten_doan} ${d.hanh_trinh ?? ''}`.toLowerCase().includes(s))
  }, [ds, q])

  // Ô khác nhau giữa 2 đoàn (bỏ ô bản tạo tay để trống — luôn giữ bản CRM)
  const khac = useMemo(
    () => (chon ? TRUONG.filter((t) => hienGiaTri(t.key, doan[t.key]) && hienGiaTri(t.key, doan[t.key]) !== hienGiaTri(t.key, chon[t.key])) : []),
    [chon, doan],
  )

  function chonDoan(d: DoanCrm) {
    setChon(d)
    setLoi(null)
    // Mặc định giữ thông tin kế toán đã nhập tay
    setGiuTay(new Set(TRUONG.filter((t) => hienGiaTri(t.key, doan[t.key]) && hienGiaTri(t.key, doan[t.key]) !== hienGiaTri(t.key, d[t.key])).map((t) => t.key)))
  }

  async function gop() {
    if (!chon || dangGop) return
    setDangGop(true)
    setLoi(null)
    try {
      const r = await fetch(`/api/doan/${doan.id}/gop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vao_doan_id: chon.id, giu_tay: [...giuTay] }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Gộp thất bại')
      onDone(chon.id)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e))
      setDangGop(false)
    }
  }

  return (
    <ModalOverlay className="flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Gộp vào đoàn từ CRM</h3>
            <p className="text-xs text-gray-400 truncate">{doan.ten_doan} · {soHoSo} nhân sự</p>
          </div>
          <button onClick={onClose} disabled={dangGop} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 space-y-3">
          {!chon ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm đoàn CRM..."
                  className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {q && (
                  <button onClick={() => setQ('')} title="Bỏ tìm kiếm" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>
                )}
              </div>
              {ds == null ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
              ) : loc.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Không có đoàn từ CRM nào.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {loc.map((d) => (
                    <button key={d.id} onClick={() => chonDoan(d)} className="w-full text-left px-3.5 py-2.5 hover:bg-brand-50/60 transition-colors">
                      <p className="text-sm font-semibold text-gray-800">{d.ten_doan}</p>
                      <p className="text-xs text-gray-400">
                        {[d.hanh_trinh, `${formatDateVN(d.ngay_di)}${d.ngay_ve ? ' – ' + formatDateVN(d.ngay_ve) : ''}`, d.sl_khach ? `${d.sl_khach} khách` : null, `${d.so_ho_so} nhân sự`].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-800 truncate">{chon.ten_doan}</p>
                  <p className="text-xs text-brand-700/70">Đoàn từ CRM · {chon.so_ho_so} nhân sự</p>
                </div>
                <button onClick={() => setChon(null)} disabled={dangGop} className="text-xs font-semibold text-brand-600 hover:text-brand-800 shrink-0">Chọn đoàn khác</button>
              </div>
              {khac.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-200">
                      <th className="text-left py-2 font-semibold w-36">Thông tin</th>
                      <th className="text-left py-2 font-semibold">Đoàn tạo tay</th>
                      <th className="text-left py-2 font-semibold">Đoàn CRM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {khac.map((t) => {
                      const tay = giuTay.has(t.key)
                      const chonBen = (laTay: boolean) => setGiuTay((s) => {
                        const n = new Set(s)
                        if (laTay) n.add(t.key); else n.delete(t.key)
                        return n
                      })
                      const o = (laTay: boolean, v: string) => (
                        <button type="button" onClick={() => chonBen(laTay)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${tay === laTay ? 'border-brand-500 bg-brand-50 text-gray-900' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                          {v || '—'}
                        </button>
                      )
                      return (
                        <tr key={t.key}>
                          <td className="py-1.5 pr-2 text-xs text-gray-500">{t.label}</td>
                          <td className="py-1.5 pr-2">{o(true, hienGiaTri(t.key, doan[t.key]))}</td>
                          <td className="py-1.5">{o(false, hienGiaTri(t.key, chon[t.key]))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-gray-500">
                {soHoSo} nhân sự và file hợp đồng của đoàn tạo tay sẽ chuyển sang đoàn CRM, đoàn tạo tay bị xoá.
              </p>
            </>
          )}
          {loi && <p className="text-sm text-red-500">{loi}</p>}
        </div>

        <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 flex justify-center gap-3">
          <button onClick={gop} disabled={!chon || dangGop}
            className="flex-1 md:flex-none md:px-10 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 transition-colors">
            {dangGop && <Loader2 size={14} className="animate-spin" />}
            Gộp
          </button>
          <button onClick={onClose} disabled={dangGop} className="px-6 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Huỷ</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
