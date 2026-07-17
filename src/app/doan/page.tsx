'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, X, MapPin, Users, CalendarDays } from 'lucide-react'
import type { Doan } from '@/types'
import { formatDateVN } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'

const EMPTY_FORM = { ten_doan: '', hanh_trinh: '', ngay_di: '', ngay_ve: '', sl_khach: '' }

export default function QuyetToanTourPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [doanList, setDoanList] = useState<Doan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/doan')
    if (res.ok) {
      const { doan } = await res.json()
      setDoanList(doan)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách đoàn khi mount, pattern chuẩn cho fetch-on-mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Quyết toán tour</span>)
    setOnRefresh(load)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/doan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ten_doan: form.ten_doan.trim(),
        hanh_trinh: form.hanh_trinh.trim() || null,
        ngay_di: form.ngay_di,
        ngay_ve: form.ngay_ve || null,
        sl_khach: form.sl_khach ? Number(form.sl_khach) : null,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Có lỗi xảy ra')
      return
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Danh sách đoàn tour</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} /> Thêm đoàn
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-300" size={28} />
        </div>
      ) : doanList.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          Chưa có đoàn nào. Nhấn &quot;Thêm đoàn&quot; để bắt đầu.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {doanList.map((d) => (
            <Link
              key={d.id}
              href={`/doan/${d.id}`}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-brand-300 transition-colors"
            >
              <div className="font-semibold text-gray-900 mb-2">{d.ten_doan}</div>
              <div className="space-y-1 text-xs text-gray-500">
                {d.hanh_trinh && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} /> {d.hanh_trinh}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={12} /> {formatDateVN(d.ngay_di)}
                  {d.ngay_ve ? ` – ${formatDateVN(d.ngay_ve)}` : ''}
                </div>
                {d.sl_khach != null && (
                  <div className="flex items-center gap-1.5">
                    <Users size={12} /> {d.sl_khach} khách
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Thêm đoàn mới</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <Field label="Tên đoàn" required>
                  <input
                    type="text"
                    required
                    placeholder="VD: Công ty Trung Kiên - Sầm Sơn"
                    value={form.ten_doan}
                    onChange={(e) => setForm((f) => ({ ...f, ten_doan: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Hành trình">
                  <input
                    type="text"
                    placeholder="VD: Hà Nội - Sầm Sơn - Hà Nội"
                    value={form.hanh_trinh}
                    onChange={(e) => setForm((f) => ({ ...f, hanh_trinh: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ngày đi" required>
                    <input
                      type="date"
                      required
                      value={form.ngay_di}
                      onChange={(e) => setForm((f) => ({ ...f, ngay_di: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Ngày về">
                    <input
                      type="date"
                      value={form.ngay_ve}
                      onChange={(e) => setForm((f) => ({ ...f, ngay_ve: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Số khách dự kiến">
                  <input
                    type="number"
                    min={0}
                    value={form.sl_khach}
                    onChange={(e) => setForm((f) => ({ ...f, sl_khach: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Thêm đoàn
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Huỷ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}
