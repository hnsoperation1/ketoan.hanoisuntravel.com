'use client'

// Quyết toán của 1 đơn CRM CHƯA có đoàn bên kế toán (vd đơn chưa nhập ngày tour nên chưa tạo được đoàn).
// Dùng lại nguyên tab Quyết toán của trang đoàn.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTopbar } from '@/contexts/topbar'
import QuyetToanTab from '@/app/doan/[id]/quyet-toan/QuyetToanTab'

export default function QuyetToanTheoDonPage() {
  const { oppId } = useParams<{ oppId: string }>()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setBreadcrumb(
      <span className="text-sm font-semibold text-gray-700 flex items-center">
        <Link href="/quyet-toan" className="text-gray-400 hover:text-brand-600 transition-colors">Quyết toán</Link>
        <span className="text-gray-300 mx-1">/</span> Đơn chưa có đoàn
      </span>,
    )
    setOnRefresh(() => setReload((k) => k + 1))
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <QuyetToanTab opportunityId={oppId} reloadSignal={reload} />
    </div>
  )
}
