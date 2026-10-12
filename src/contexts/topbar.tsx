'use client'

import { createContext, useContext, useState, useCallback, Fragment, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface TopbarCtx {
  breadcrumb: ReactNode
  setBreadcrumb: (node: ReactNode) => void
  onRefresh: (() => void) | null
  setOnRefresh: (fn: (() => void) | null) => void
  // "Làm mới" dùng chung (nút Làm mới ở topbar, logo…): CHỈ tải lại vùng nội dung, không tải lại cả
  // trang — quy tắc chung 2026-10-12. Không dùng window.location.reload() cho việc làm mới.
  refresh: () => void
  reloadKey: number
}

const Ctx = createContext<TopbarCtx | null>(null)

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<ReactNode>(null)
  const [onRefresh, setOnRefreshState] = useState<(() => void) | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const setOnRefresh = useCallback((fn: (() => void) | null) => {
    setOnRefreshState(() => fn)
  }, [])
  const router = useRouter()
  // Trang có hàm tải lại riêng (setOnRefresh) → gọi nó, giữ nguyên bộ lọc đang chọn. Trang khác (kể cả
  // màn mới chưa đăng ký gì) → lấy lại dữ liệu phía server (router.refresh) + dựng lại trang trong vùng
  // nội dung (ContentReload đổi key) → useEffect tải dữ liệu chạy lại.
  const refresh = useCallback(() => {
    if (onRefresh) onRefresh()
    else { router.refresh(); setReloadKey((k) => k + 1) }
  }, [onRefresh, router])

  return (
    <Ctx.Provider value={{ breadcrumb, setBreadcrumb, onRefresh, setOnRefresh, refresh, reloadKey }}>{children}</Ctx.Provider>
  )
}

export function useTopbar() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTopbar phải dùng trong TopbarProvider')
  return ctx
}

// Bọc vùng nội dung (trong khung chung): refresh() đổi key → dựng lại trang bên trong (tải lại dữ liệu),
// sidebar/topbar giữ nguyên — nút Làm mới không tải lại cả trang (quy tắc chung 2026-10-12)
export function ContentReload({ children }: { children: ReactNode }) {
  const { reloadKey } = useTopbar()
  return <Fragment key={reloadKey}>{children}</Fragment>
}
