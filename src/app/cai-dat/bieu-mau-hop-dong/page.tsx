'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import type { HopDongTemplate } from '@/types'
import { formatDateVN } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'
import { useAuth } from '@/contexts/auth'

const PLACEHOLDER_GROUPS: { title: string; fields: { tag: string; label: string }[] }[] = [
  {
    title: 'Người (nhân sự)',
    fields: [
      { tag: 'ho_ten', label: 'Họ tên' },
      { tag: 'dia_chi', label: 'Địa chỉ' },
      { tag: 'so_cccd', label: 'Số CCCD' },
      { tag: 'ngay_sinh', label: 'Ngày sinh' },
      { tag: 'ngay_cap', label: 'Ngày cấp CCCD' },
      { tag: 'noi_cap', label: 'Nơi cấp CCCD' },
      { tag: 'ma_so_thue_tncn', label: 'Mã số thuế TNCN' },
      { tag: 'sdt', label: 'Số điện thoại' },
      { tag: 'email', label: 'Email' },
      { tag: 'so_the_hdv', label: 'Số thẻ HDV' },
      { tag: 'loai_the_hdv', label: 'Loại thẻ HDV' },
      { tag: 'han_the_hdv', label: 'Hạn thẻ HDV' },
      { tag: 'stk', label: 'Số tài khoản' },
      { tag: 'ten_ngan_hang', label: 'Tên ngân hàng' },
    ],
  },
  {
    title: 'Đoàn',
    fields: [
      { tag: 'ten_doan', label: 'Tên đoàn' },
      { tag: 'hanh_trinh', label: 'Tuyến du lịch' },
      { tag: 'ngay_di', label: 'Ngày đi' },
      { tag: 'ngay_ve', label: 'Ngày về' },
      { tag: 'sl_khach', label: 'Số khách dự kiến' },
    ],
  },
  {
    title: 'Hợp đồng',
    fields: [
      { tag: 'so_hop_dong', label: 'Số hợp đồng' },
      { tag: 'ngay_dich_vu', label: 'Từ ngày' },
      { tag: 'ngay_ket_thuc', label: 'Đến ngày' },
      { tag: 'so_ngay_cong_tac', label: 'Số ngày công tác' },
      { tag: 'don_gia_ngay', label: 'Đơn giá/ngày' },
      { tag: 'so_tien_chi_tra', label: 'Tổng giá trị hợp đồng' },
      { tag: 'thue_nop', label: 'Thuế TNCN' },
      { tag: 'chi_tra', label: 'Thu nhập thực nhận' },
    ],
  },
]

export default function BieuMauHopDongPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [templates, setTemplates] = useState<HopDongTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const notAllowed = !authLoading && !!user && !user.is_super_admin

  useEffect(() => {
    if (notAllowed) router.replace('/')
  }, [notAllowed, router])

  const load = useCallback(async () => {
    const res = await fetch('/api/hop-dong-templates')
    if (res.ok) {
      const { templates } = await res.json()
      setTemplates(templates)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi mount, pattern chuẩn cho fetch-on-mount
    if (!notAllowed) void load()
  }, [load, notAllowed])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Biểu mẫu hợp đồng</span>)
    setOnRefresh(load)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, load])

  async function handleDelete(id: string) {
    await fetch(`/api/hop-dong-templates/${id}`, { method: 'DELETE' })
    load()
  }

  if (notAllowed) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Biểu mẫu hợp đồng</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} /> Thêm biểu mẫu
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">
            Chưa có biểu mẫu nào. Nhấn &quot;Thêm biểu mẫu&quot; để tải lên file .docx đầu tiên.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Tên biểu mẫu', 'Loại', 'File', 'Ngày tạo', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.ten}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.loai ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.loai}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={t.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                      >
                        <FileText size={13} /> {t.file_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateVN(t.created_at.slice(0, 10))}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Các trường có thể dùng trong biểu mẫu</p>
          <p className="text-xs text-gray-400 mb-4">
            Gõ đúng dạng <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{ten_truong}}'}</code> vào file Word — hệ thống sẽ
            tự thay bằng dữ liệu thật khi xuất hợp đồng.
          </p>
          <div className="space-y-5">
            {PLACEHOLDER_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{g.title}</p>
                <div className="space-y-1.5">
                  {g.fields.map((f) => (
                    <div key={f.tag} className="flex items-baseline justify-between gap-2">
                      <code className="text-xs font-mono text-brand-600">{`{{${f.tag}}}`}</code>
                      <span className="text-[11px] text-gray-400 text-right">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <UploadTemplateModal
          onClose={() => setShowForm(false)}
          onUploaded={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function UploadTemplateModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [ten, setTen] = useState('')
  const [loai, setLoai] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !file) return
    setSubmitting(true)
    setError('')
    const formData = new FormData()
    formData.append('ten', ten.trim())
    formData.append('loai', loai.trim())
    formData.append('file', file)
    const res = await fetch('/api/hop-dong-templates', { method: 'POST', body: formData })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Có lỗi xảy ra')
      return
    }
    onUploaded()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Thêm biểu mẫu</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Tên biểu mẫu <span className="text-red-400">*</span>
              </label>
              <input
                required
                placeholder="VD: HĐ HDV nội địa"
                value={ten}
                onChange={(e) => setTen(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Loại (tuỳ chọn)</label>
              <input
                placeholder="VD: HDV, MC, NS"
                value={loai}
                onChange={(e) => setLoai(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                File .docx <span className="text-red-400">*</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
                <Upload size={15} />
                {file ? file.name : 'Chọn file...'}
                <input
                  type="file"
                  accept=".docx"
                  required
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Tải lên
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
