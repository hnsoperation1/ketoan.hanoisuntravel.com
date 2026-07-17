'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/auth'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (loading) return
    if (!user && !isLoginPage) router.replace('/login')
    if (user && isLoginPage) router.replace('/')
  }, [user, loading, isLoginPage, router])

  if (loading || (!user && !isLoginPage)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="font-black text-xl tracking-wide">
          <span className="text-accent-500">HNS</span>
          <span className="text-brand-600"> Hồ sơ HDV</span>
        </div>
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <Link href="/" className="font-black text-lg tracking-wide">
          <span className="text-accent-500">HNS</span>
          <span className="text-brand-600"> Hồ sơ HDV</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
