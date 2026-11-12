'use client'

import { useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'
import { SidebarOrderEditor } from '@/components/SidebarOrderEditor'
import { buildKetoanNav } from '@/lib/ketoanNav'
import { useNavOrder } from '@/lib/navOrder'

// Tuỳ chỉnh sidebar Kế toán (nút bánh răng cạnh logo) — mọi tài khoản đều vào được (không thuộc màn phân quyền nào).
export default function TuyChinhSidebarPage() {
  const { user } = useAuth()
  const { setBreadcrumb } = useTopbar()
  const { order, save } = useNavOrder(user?.id)
  const sections = useMemo(() => buildKetoanNav(user), [user])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Tuỳ chỉnh sidebar</span>)
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  return <SidebarOrderEditor sections={sections} order={order} save={save} />
}
