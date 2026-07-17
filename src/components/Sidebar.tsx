'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileSpreadsheet, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/auth'
import { UserAvatar } from '@/components/UserAvatar'

type Props = { collapsed: boolean; onToggle: () => void; mobileOpen?: boolean; onMobileClose?: () => void }

type NavLinkProps = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  pathname: string
  collapsed: boolean
  onClick?: () => void
}

function NavLink({ href, label, icon: Icon, exact, pathname, collapsed, onClick }: NavLinkProps) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={clsx(
        'flex items-center transition-all',
        'gap-4 px-5 py-3 -mx-4 text-base md:text-sm',
        'md:gap-3 md:px-3 md:py-1.5',
        collapsed ? 'md:justify-center md:px-0 md:mx-0' : 'md:-mx-3 md:px-6',
        active ? 'font-semibold' : 'font-medium hover:bg-white/50',
      )}
      style={active ? { background: '#ef5e2f', color: 'white' } : { color: '#003d5c' }}
    >
      <Icon className="flex-shrink-0 w-[22px] h-[22px] md:w-[18px] md:h-[18px]" strokeWidth={active ? 2.5 : 2} />
      <span className="md:hidden">{label}</span>
      {!collapsed && <span className="hidden md:block">{label}</span>}
    </Link>
  )
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside
      className={clsx(
        'flex-shrink-0 flex flex-col h-full transition-all duration-200 ease-in-out',
        'md:relative md:z-auto md:translate-x-0',
        collapsed ? 'md:w-14' : 'md:w-52',
        'fixed inset-0 z-50 w-full',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{ background: '#f0f9ff' }}
    >
      <div
        className="h-16 md:h-20 flex-shrink-0 flex items-center px-4 md:px-1.5 gap-3"
        style={{ background: '#f0f9ff', borderBottom: '1px solid rgba(0,61,92,0.08)' }}
      >
        <Link href="/" className={clsx('flex items-center', collapsed ? 'md:hidden' : 'flex-1')}>
          <img src="/hanoisuntravel_logo_transparent.png" alt="HNS" className="h-10 md:h-full w-auto md:max-h-20 md:py-2" />
        </Link>

        <button
          onClick={onToggle}
          title={collapsed ? 'Mở sidebar' : 'Thu sidebar'}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
          style={{ color: '#003d5c' }}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <button
          onClick={onMobileClose}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl hover:bg-black/5 transition-colors flex-shrink-0 ml-auto"
          style={{ color: '#003d5c' }}
        >
          <X size={22} />
        </button>
      </div>

      <nav className={clsx('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-1.5' : 'md:px-3 px-4')}>
        <NavLink
          href="/"
          label="Tổng quan"
          icon={LayoutDashboard}
          exact
          pathname={pathname}
          collapsed={collapsed}
          onClick={onMobileClose}
        />

        <div className="pt-4 mt-2 md:pt-3" style={{ borderTop: '1px solid rgba(0,61,92,0.12)' }}>
          {!collapsed && (
            <p
              className="text-[11px] md:text-[10px] font-bold uppercase tracking-widest px-1 mb-2 md:mb-1.5 md:px-3"
              style={{ color: '#0069a0' }}
            >
              Kế toán
            </p>
          )}
          <NavLink
            href="/doan"
            label="Quyết toán tour"
            icon={FileSpreadsheet}
            pathname={pathname}
            collapsed={collapsed}
            onClick={onMobileClose}
          />
        </div>
      </nav>

      <div className={clsx('py-4 md:py-4', collapsed ? 'px-1.5' : 'px-4 md:px-4')} style={{ borderTop: '1px solid rgba(0,61,92,0.12)' }}>
        {user && (
          <div className={clsx('flex items-center gap-3 mb-3', collapsed ? 'md:justify-center' : 'px-1')}>
            <UserAvatar email={user.email} className="w-10 h-10 md:w-8 md:h-8 text-sm md:text-xs" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm md:text-xs font-semibold truncate" style={{ color: '#003d5c' }}>
                  {user.email}
                </div>
                <div className="text-xs md:text-[11px] truncate" style={{ color: '#0069a0' }}>
                  Kế toán
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={logout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-base md:text-sm transition-colors hover:bg-[#0094cc]/10',
            collapsed && 'md:justify-center md:px-0',
          )}
          style={{ color: '#003d5c' }}
        >
          <LogOut size={18} className="md:w-[14px] md:h-[14px]" />
          {!collapsed && 'Đăng xuất'}
        </button>
      </div>
    </aside>
  )
}
