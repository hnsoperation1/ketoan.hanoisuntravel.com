'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth'
import { TopbarProvider } from '@/contexts/topbar'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user && !isLoginPage) router.replace('/login')
    if (user && isLoginPage) router.replace('/')
  }, [user, loading, isLoginPage, router])

  if (loading || (!user && !isLoginPage)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="font-black text-2xl tracking-wide">
            <span style={{ color: '#ef5e2f' }}>HNS</span>
            <span style={{ color: '#2a9ac4' }}> Kế toán</span>
          </div>
          <p className="text-sm text-gray-400">Quyết toán tour</p>
        </div>
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>

  return (
    <TopbarProvider>
      <div className="flex h-screen overflow-hidden">
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onMobileSidebarToggle={() => setMobileOpen((o) => !o)} />
          <main className="flex-1 overflow-y-auto relative">{children}</main>
        </div>
      </div>
    </TopbarProvider>
  )
}
