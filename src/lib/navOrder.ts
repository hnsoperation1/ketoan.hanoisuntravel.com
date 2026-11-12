'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

// ─── THỨ TỰ MENU SIDEBAR RIÊNG TỪNG NGƯỜI (2026-11-12) ─── trang Tuỳ chỉnh sidebar của CHÍNH app này (nút bánh răng cạnh
// logo): kéo thả thứ tự nhóm + thứ tự mục trong nhóm, lưu ngay khi thả vào user_preferences key NAV_KEY. Mỗi app 1 key
// riêng (ihns.vn: ihns_nav_order, CRM: crm_nav_order, Kế toán: ketoan_nav_order, Vận hành: operation_nav_order); theme
// Sáng/Tối vẫn dùng chung key ihns_sidebar_theme (lib/sidebarTheme.ts). Nhóm pin 'top' (Tổng quan) luôn đầu, pin
// 'bottom' (Cài đặt — chỉ Super Admin) luôn cuối, không kéo được.
export const NAV_KEY = 'ketoan_nav_order'
const NAV_LOCAL = 'ketoan-nav-order'

export type NavEntry = {
  id: string
  href: string
  label: string
  icon: React.ElementType
  show: boolean
  exact?: boolean
  external?: boolean
  sa?: boolean // mục chỉ Super Admin thấy (huy hiệu SA sau nhãn)
}
// hub: tiêu đề nhóm cũng là link (vd "Kế toán vé máy bay" → /ve-may-bay) — nhóm vẫn hiện khi chỉ còn hub
export type NavSection = { id: string; title: string | null; items: NavEntry[]; sa?: boolean; pin?: 'top' | 'bottom'; hub?: { href: string; show: boolean } }
export type NavOrder = { groups: string[]; items: Record<string, string[]> }

export const EMPTY_NAV_ORDER: NavOrder = { groups: [], items: {} }

// Mục có trong danh sách đã lưu theo đúng thứ tự đã lưu; mục chưa có (mới thêm / trước đó bị ẩn) xếp sau, giữ thứ tự gốc
function sortBySaved<T>(list: T[], key: (x: T) => string, saved?: string[]): T[] {
  if (!saved?.length) return list
  const idx = new Map(saved.map((k, i) => [k, i]))
  return list
    .map((x, i) => ({ x, i, s: idx.get(key(x)) }))
    .sort((a, b) => (a.s !== undefined && b.s !== undefined ? a.s - b.s : a.s !== undefined ? -1 : b.s !== undefined ? 1 : a.i - b.i))
    .map((o) => o.x)
}

// Chỉ giữ mục người này được thấy; nhóm không còn mục nào thì bỏ
export function visibleSections(sections: NavSection[]): NavSection[] {
  return sections.map((s) => ({ ...s, items: s.items.filter((i) => i.show) })).filter((s) => s.items.length > 0 || !!s.hub?.show)
}

export function applyNavOrder(sections: NavSection[], order: NavOrder): NavSection[] {
  const top = sections.filter((s) => s.pin === 'top')
  const bottom = sections.filter((s) => s.pin === 'bottom')
  const mid = sortBySaved(sections.filter((s) => !s.pin), (s) => s.id, order.groups)
  return [...top, ...mid, ...bottom].map((s) => ({ ...s, items: s.pin ? s.items : sortBySaved(s.items, (i) => i.id, order.items[s.id]) }))
}

let navOrder: NavOrder | null = null
let loadedFor: string | null = null
const listeners = new Set<() => void>()

function setNavOrder(o: NavOrder) {
  navOrder = o
  try { localStorage.setItem(NAV_LOCAL, JSON.stringify(o)) } catch { /* bỏ qua */ }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useNavOrder(userId: string | null | undefined) {
  const order = useSyncExternalStore(subscribe, () => navOrder ?? EMPTY_NAV_ORDER, () => EMPTY_NAV_ORDER)

  useEffect(() => {
    if (navOrder === null) {
      let saved: NavOrder = EMPTY_NAV_ORDER
      try { saved = { ...EMPTY_NAV_ORDER, ...JSON.parse(localStorage.getItem(NAV_LOCAL) ?? '{}') } } catch { /* bỏ qua */ }
      navOrder = saved
      listeners.forEach((l) => l())
    }
    if (!userId || loadedFor === userId) return
    loadedFor = userId
    fetch(`/api/user-preferences?key=${NAV_KEY}`).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.value) setNavOrder({ ...EMPTY_NAV_ORDER, ...(j.value as NavOrder) }) })
      .catch(() => { /* giữ bản trong máy */ })
  }, [userId])

  const save = useCallback((o: NavOrder) => {
    setNavOrder(o)
    if (userId) void fetch('/api/user-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: NAV_KEY, value: o }) }).catch(() => {})
  }, [userId])

  return { order, save }
}
