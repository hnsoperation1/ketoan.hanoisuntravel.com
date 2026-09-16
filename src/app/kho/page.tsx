'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Settings } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { formatDateTimeVN } from '@/lib/format'

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
interface TonKhoRow {
  kho_id: string
  vat_pham_id: string
  so_luong: number
}
interface ChiTiet {
  id: string
  so_luong: number
  so_luong_thuc_nhan: number | null
  vat_pham: { ten: string; don_vi: string }
}
interface Phieu {
  id: string
  phieu_no: number
  loai: 'nhap' | 'xuat' | 'chuyen'
  kho_id: string
  kho_dich_id: string | null
  nguoi_tao_ten: string
  nguoi_nhan_ten: string | null
  doan_ten: string | null
  ghi_chu: string | null
  status: 'soan' | 'cho_nhan' | 'hoan_tat' | 'hoan_tat_lech' | 'huy'
  created_at: string
  chi_tiet: ChiTiet[]
}

const LOAI_LABEL: Record<Phieu['loai'], string> = { nhap: '📥 Nhập', xuat: '📤 Xuất', chuyen: '🔄 Chuyển' }
const STATUS_BADGE: Record<Phieu['status'], { label: string; cls: string }> = {
  soan: { label: 'Đang soạn', cls: 'bg-gray-100 text-gray-500' },
  cho_nhan: { label: 'Chờ nhận', cls: 'bg-amber-50 text-amber-600' },
  hoan_tat: { label: 'Hoàn tất', cls: 'bg-emerald-50 text-emerald-600' },
  hoan_tat_lech: { label: 'Hoàn tất (lệch)', cls: 'bg-orange-50 text-orange-600' },
  huy: { label: 'Đã huỷ', cls: 'bg-red-50 text-red-500' },
}

export default function KhoPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [kho, setKho] = useState<Kho[]>([])
  const [vatPham, setVatPham] = useState<VatPham[]>([])
  const [tonKho, setTonKho] = useState<TonKhoRow[]>([])
  const [phieu, setPhieu] = useState<Phieu[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [resTonKho, resPhieu] = await Promise.all([fetch('/api/kho'), fetch('/api/kho/phieu')])
    if (resTonKho.ok) {
      const data = await resTonKho.json()
      setKho(data.kho)
      setVatPham(data.vatPham)
      setTonKho(data.tonKho)
    }
    if (resPhieu.ok) {
      const data = await resPhieu.json()
      setPhieu(data.phieu)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi mount, pattern chuẩn cho fetch-on-mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Kho quà tặng</span>)
    setOnRefresh(load)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, load])

  function soLuong(vatPhamId: string, khoId: string) {
    return tonKho.find((t) => t.vat_pham_id === vatPhamId && t.kho_id === khoId)?.so_luong ?? 0
  }

  const khoTen = (id: string) => kho.find((k) => k.id === id)?.ten_kho ?? '—'

  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="animate-spin text-gray-300" size={28} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kho quà tặng</h1>
        <Link
          href="/kho/cai-dat"
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Settings size={15} /> Cài đặt
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <p className="px-5 pt-4 text-sm font-semibold text-gray-800">Tồn kho</p>
        {kho.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Chưa khai báo kho nào — vào Cài đặt để thêm.</div>
        ) : vatPham.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Chưa có vật phẩm nào — bot sẽ tự thêm khi thủ kho tạo phiếu.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vật phẩm</th>
                  {kho.map((k) => (
                    <th key={k.id} className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {k.ten_kho}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vatPham.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-gray-800">
                      {v.ten} <span className="text-gray-400 text-xs">({v.don_vi})</span>
                    </td>
                    {kho.map((k) => (
                      <td key={k.id} className="px-5 py-2.5 text-right tabular-nums text-gray-700">
                        {soLuong(v.id, k.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <p className="px-5 pt-4 pb-3 text-sm font-semibold text-gray-800">Phiếu gần đây</p>
        {phieu.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Chưa có phiếu nào.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {phieu.map((p) => {
              const badge = STATUS_BADGE[p.status]
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{LOAI_LABEL[p.loai]} #{p.phieu_no}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.loai === 'chuyen' ? `${khoTen(p.kho_id)} → ${khoTen(p.kho_dich_id ?? '')}` : khoTen(p.kho_id)}
                      {p.doan_ten ? ` · Đoàn: ${p.doan_ten}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {p.chi_tiet.map((ct) => `${ct.vat_pham.ten} (${ct.so_luong} ${ct.vat_pham.don_vi})`).join(', ')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {p.nguoi_tao_ten} tạo · {formatDateTimeVN(p.created_at)}
                      {p.nguoi_nhan_ten ? ` · ${p.nguoi_nhan_ten} nhận` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
