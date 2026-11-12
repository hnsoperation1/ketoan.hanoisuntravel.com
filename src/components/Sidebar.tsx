'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/auth'
import { UserAvatar } from '@/components/UserAvatar'
import { SaBadge } from '@/components/SaBadge'
import { useSidebarTheme, type SidebarTheme } from '@/lib/sidebarTheme'
import { buildKetoanNav } from '@/lib/ketoanNav'
import { applyNavOrder, useNavOrder, visibleSections } from '@/lib/navOrder'

type Props = { collapsed: boolean; onToggle: () => void; mobileOpen?: boolean; onMobileClose?: () => void }

type NavLinkProps = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  pathname: string
  collapsed: boolean
  onClick?: () => void
  /** Mục chỉ Super Admin thấy → gắn huy hiệu "SA" sau nhãn (ẩn theo nhãn khi thu sidebar) */
  sa?: boolean
  /** Link sang app khác (vd ihns.vn) → mở tab mới */
  external?: boolean
  t: SidebarTheme
}

// Tiêu đề nhóm nhưng CŨNG LÀ link (vd "Kế toán vé máy bay" trỏ vào
// /ve-may-bay) — khi đang đứng đúng trang đó thì tô nền xanh theme, dạng
// thanh full-bleed sát mép giống hệt NavLink thường (không bo góc), chỉ
// khác màu xanh vì đây là "trang chủ nhóm" chứ không phải 1 mục con.
function SectionLink({ href, label, pathname, onClick, t }: { href: string; label: string; pathname: string; onClick?: () => void; t: SidebarTheme }) {
  const active = pathname === href
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        'block text-[11px] md:text-[10px] font-bold uppercase tracking-widest py-1.5 mb-2 md:mb-1.5 transition-colors',
        'px-5 -mx-4 md:px-6 md:-mx-3',
        active ? t.hubActive : clsx(t.groupLabel, 'hover:opacity-70'),
      )}
    >
      {label}
    </Link>
  )
}

function NavLink({ href, label, icon: Icon, exact, pathname, collapsed, onClick, sa, external, t }: NavLinkProps) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={clsx(
        'flex items-center transition-all',
        'gap-4 px-5 py-3 -mx-4 text-base md:text-sm',
        'md:gap-3 md:px-3 md:py-1.5',
        collapsed ? 'md:justify-center md:px-0 md:mx-0' : 'md:-mx-3 md:px-6',
        active ? clsx(t.active, 'font-semibold') : clsx(t.row, 'font-medium'),
      )}
    >
      <Icon className="flex-shrink-0 w-[22px] h-[22px] md:w-[18px] md:h-[18px]" strokeWidth={active ? 2.5 : 2} />
      <span className="md:hidden">
        {label}
        {sa && <SaBadge className="ml-1.5" />}
      </span>
      {!collapsed && (
        <span className="hidden md:block">
          {label}
          {sa && <SaBadge className="ml-1.5" />}
        </span>
      )}
    </Link>
  )
}

// sa = cả nhóm chỉ Super Admin → huy hiệu "SA" sau tiêu đề nhóm
function SectionTitle({ label, sa, t }: { label: string; sa?: boolean; t: SidebarTheme }) {
  return (
    <p className={clsx('text-[11px] md:text-[10px] font-bold uppercase tracking-widest px-1 mb-2 md:mb-1.5 md:px-3', t.groupLabel)}>
      {label}
      {sa && <SaBadge className="ml-1.5" />}
    </p>
  )
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  // Theme sidebar (mặc định Tối, chung mọi app iHNS — giá trị đầu từ /api/auth/me) + thứ tự menu riêng Kế toán —
  // chọn ở trang Tuỳ chỉnh sidebar của app (/tuy-chinh-sidebar, menu dựng ở lib/ketoanNav.ts)
  const { theme: t } = useSidebarTheme(user?.sidebar_theme)
  const { order } = useNavOrder(user?.id)
  const sections = useMemo(() => applyNavOrder(visibleSections(buildKetoanNav(user)), order), [user, order])

  return (
    <aside
      className={clsx(
        'flex-shrink-0 flex flex-col h-full transition-all duration-200 ease-in-out',
        'md:relative md:z-auto md:translate-x-0',
        collapsed ? 'md:w-14' : 'md:w-52',
        'fixed inset-0 z-50 w-full',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        t.aside,
      )}
    >
      <div className={clsx('h-16 md:h-20 flex-shrink-0 flex items-center px-4 md:px-1.5 gap-3 border-b', t.headerBorder)}>
        {/* Bánh răng Tuỳ chỉnh sidebar — mọi tài khoản; trang riêng của Kế toán (/tuy-chinh-sidebar) */}
        <Link href="/tuy-chinh-sidebar" onClick={onMobileClose} title="Tuỳ chỉnh sidebar" aria-label="Tuỳ chỉnh sidebar"
          className={clsx('flex items-center justify-center w-7 h-7 rounded-lg transition-colors flex-shrink-0', collapsed && 'md:hidden', t.headerBtn, pathname === '/tuy-chinh-sidebar' && t.headerBtnOn)}>
          <Settings size={16} />
        </Link>
        <Link href="/" className={clsx('flex items-center', collapsed ? 'md:hidden' : 'flex-1')}>
          <Image
            src={t.logo}
            alt="HNS"
            width={1009}
            height={409}
            priority
            className="h-10 md:h-full w-auto md:max-h-20 md:py-2"
          />
        </Link>

        <button
          onClick={onToggle}
          title={collapsed ? 'Mở sidebar' : 'Thu sidebar'}
          className={clsx('hidden md:flex items-center justify-center w-7 h-7 rounded-lg transition-colors flex-shrink-0', t.headerBtn)}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <button
          onClick={onMobileClose}
          className={clsx('md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-colors flex-shrink-0 ml-auto', t.headerBtn)}
        >
          <X size={22} />
        </button>
      </div>

      <nav className={clsx('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-1.5' : 'md:px-3 px-4')}>
        {sections.map((section) => {
          const links = section.items.map((item) => (
            <NavLink
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              exact={item.exact}
              pathname={pathname}
              collapsed={collapsed}
              onClick={onMobileClose}
              sa={section.sa || item.sa}
              external={item.external}
              t={t}
            />
          ))
          if (!section.title) return <div key={section.id}>{links}</div>
          // Nhóm chỉ còn tiêu đề-link (hub) mà sidebar đang thu → không còn gì để hiện
          if (section.items.length === 0 && collapsed) return null
          return (
            <div key={section.id} className={clsx('pt-4 mt-2 md:pt-3 border-t', t.divider)}>
              {!collapsed &&
                (section.hub?.show ? (
                  <SectionLink href={section.hub.href} label={section.title} pathname={pathname} onClick={onMobileClose} t={t} />
                ) : (
                  <SectionTitle label={section.title} sa={section.sa} t={t} />
                ))}
              {links}
            </div>
          )
        })}
      </nav>

      <div className={clsx('py-4 md:py-4 border-t', t.divider, collapsed ? 'px-1.5' : 'px-4 md:px-4')}>
        {user && (
          <div className={clsx('flex items-center gap-3 mb-3', collapsed ? 'md:justify-center' : 'px-1')}>
            <UserAvatar email={user.email} name={user.full_name} avatarUrl={user.avatar_url} className="w-10 h-10 md:w-8 md:h-8 text-sm md:text-xs" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className={clsx('text-sm md:text-xs font-semibold truncate', t.userName)}>
                  {user.full_name}
                </div>
                <div className={clsx('text-xs md:text-[11px] truncate', t.muted)}>
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
            'w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-base md:text-sm transition-colors',
            t.footerBtn,
            collapsed && 'md:justify-center md:px-0',
          )}
        >
          <LogOut size={18} className="md:w-[14px] md:h-[14px]" />
          {!collapsed && 'Đăng xuất'}
        </button>
      </div>
    </aside>
  )
}
