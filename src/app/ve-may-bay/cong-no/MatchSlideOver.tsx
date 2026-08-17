'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { filterKhachOptions, type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import type { DebtRow } from './page'

type Candidate = {
  id: string
  ticket_no: string | null
  ma_khach: string | null
  ten_khach_hang: string | null
  full_name: string | null
  routing: string | null
  created_at: string
  ve_tkt: { tkt_code: string | null; ten_nhan_vien: string | null } | null
  ve_parse_logs: { raw_message: string | null } | null
}

type KhachInfo = Record<string, { ten_khach: string | null; active: boolean }>

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

// Slide-over bên phải, mở khi bấm badge trạng thái khớp mã khách ở màn Công
// nợ NCC — hiện các booking/tin nhắn Telegram nhóm tkt khớp ĐÚNG ticket_no
// của dòng công nợ đang xem, để kế toán tự chọn mã khách đúng khi hệ thống
// không tự tin khớp được (hoặc muốn xem lại/chọn lại dòng đã khớp). Khung
// animation/portal copy từ KhachDetailSlideOver (cong-no-khach-hang/page.tsx)
// — pattern slide-over duy nhất hiện có trong app. Đặt file riêng (không
// inline như bản gốc) vì cong-no/page.tsx đã rất dài, thêm state/JSX ở đây
// sẽ đẩy file đó quá dài không cần thiết.
export function MatchSlideOver({ row, khSuggestions, onSaved, onClose }: {
  row: DebtRow
  khSuggestions: KhachOpt[]
  onSaved: (id: string, maKhach: string, matchedBookingId: string | null) => void
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [khachInfo, setKhachInfo] = useState<KhachInfo>({})
  const [manualQuery, setManualQuery] = useState('')

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCandidates() {
      setLoading(true)
      setLoadError(false)
      try {
        const res = await fetch(`/api/ve-may-bay/cong-no/${row.id}/candidates`)
        if (!res.ok) throw new Error('load failed')
        const { data } = await res.json()
        if (cancelled) return
        setCandidates(Array.isArray(data?.candidates) ? data.candidates : [])
        setKhachInfo(data?.khachInfo ?? {})
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandidates()
    return () => { cancelled = true }
  }, [row.id])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  function chooseCandidate(c: Candidate) {
    if (!c.ma_khach) return
    onSaved(row.id, c.ma_khach, c.id)
    close()
  }

  function chooseManual(maKhach: string) {
    onSaved(row.id, maKhach, null)
    close()
  }

  const manualFiltered = filterKhachOptions(khSuggestions, manualQuery)

  return createPortal(
    <>
      <div className={`fixed inset-0 bg-black/30 z-150 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div className={`fixed inset-y-0 right-0 z-160 w-full max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Khớp mã khách theo mã vé</p>
            <p className="font-bold text-gray-900 text-lg truncate">{row.ticket_no ?? 'Không có mã vé'}</p>
            <p className="text-xs text-gray-400 truncate">{row.pax_name ?? '—'} · {row.routing ?? '—'}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <MatchStatusBadge status={row.match_status ?? 'unmatched'} onClick={() => {}} />
            <button onClick={close} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tin nhắn/booking Telegram khớp mã vé</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Đang tải...
              </div>
            ) : loadError ? (
              <p className="text-sm text-red-500 py-4">Không tải được dữ liệu, thử đóng và mở lại.</p>
            ) : !row.ticket_no ? (
              <p className="text-sm text-gray-400 py-4">Dòng này không có mã vé để tra cứu.</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Không tìm thấy tin nhắn Telegram nào khớp mã vé này.</p>
            ) : (
              <div className="space-y-2">
                {candidates.map(c => {
                  const info = c.ma_khach ? khachInfo[c.ma_khach] : undefined
                  const invalid = c.ma_khach && !info
                  const inactive = info && !info.active
                  return (
                    <div key={c.id} className="border border-gray-200 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{c.full_name || c.ten_khach_hang || 'Không rõ tên khách'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(c.created_at)} · TKT {c.ve_tkt?.tkt_code ?? '—'} ({c.ve_tkt?.ten_nhan_vien ?? '—'})</div>
                          <div className="text-sm mt-1.5">
                            Mã khách: <span className="font-semibold text-gray-800">{c.ma_khach ?? '—'}</span>
                            {info?.ten_khach && <span className="text-gray-400"> · {info.ten_khach}</span>}
                            {(invalid || inactive) && (
                              <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                {invalid ? 'Không có trong danh mục' : 'Đã ngừng hoạt động'}
                              </span>
                            )}
                          </div>
                          {c.ve_parse_logs?.raw_message && (
                            <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap line-clamp-4 bg-gray-50 rounded-lg p-2">
                              {c.ve_parse_logs.raw_message}
                            </p>
                          )}
                        </div>
                        <button type="button" onClick={() => chooseCandidate(c)} disabled={!c.ma_khach}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          Chọn mã KH này
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Hoặc tự tìm trong danh mục khách hàng</h3>
            <input autoFocus={candidates.length === 0} value={manualQuery} onChange={e => setManualQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualQuery.trim()) chooseManual(manualQuery.trim()) }}
              placeholder="Tìm mã khách hoặc tên khách..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 mb-2" />
            <div className="border border-gray-100 rounded-xl max-h-56 overflow-y-auto divide-y divide-gray-50">
              {manualFiltered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Không tìm thấy trong danh mục.
                  {manualQuery.trim() && (
                    <button onClick={() => chooseManual(manualQuery.trim())}
                      className="block mx-auto mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Dùng nguyên văn &quot;{manualQuery.trim()}&quot;
                    </button>
                  )}
                </div>
              ) : (
                manualFiltered.slice(0, 50).map(o => (
                  <button key={o.ma_khach} type="button" onClick={() => chooseManual(o.ma_khach)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-semibold text-gray-800">{o.ma_khach}</span>
                    {o.ten_khach && <span className="text-xs text-gray-400 ml-2">{o.ten_khach}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
