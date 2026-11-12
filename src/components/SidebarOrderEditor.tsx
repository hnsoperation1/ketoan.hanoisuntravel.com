'use client'

import { useMemo } from 'react'
import { GripVertical, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { SaBadge } from '@/components/SaBadge'
import { SortableList } from '@/components/SortableList'
import { SidebarThemePicker } from '@/components/SidebarThemePicker'
import { applyNavOrder, EMPTY_NAV_ORDER, visibleSections, type NavEntry, type NavOrder, type NavSection } from '@/lib/navOrder'

// Tuỳ chỉnh sidebar của app này (nút bánh răng cạnh logo) — giống trang cùng tên ở ihns.vn: chọn theme Sáng/Tối (chung
// mọi app iHNS) + kéo thả thứ tự nhóm và thứ tự mục trong từng nhóm (riêng app này, riêng từng người, lưu ngay khi thả).
// Nhóm đầu (Tổng quan) luôn đầu, nhóm Cài đặt (chỉ Super Admin) luôn cuối — không kéo được.

const rowCls = 'flex items-center gap-2.5 rounded-xl bg-white px-2 py-1.5 text-sm text-[#003d5c]'
const gripCls = 'flex h-7 w-6 flex-shrink-0 cursor-grab items-center justify-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-gray-500'

export function SidebarOrderEditor({ sections, order, save }: { sections: NavSection[]; order: NavOrder; save: (o: NavOrder) => void }) {
  const shown = useMemo(() => applyNavOrder(visibleSections(sections), order), [sections, order])
  const top = shown.filter((s) => s.pin === 'top')
  const mid = shown.filter((s) => !s.pin)
  const bottom = shown.filter((s) => s.pin === 'bottom')

  const itemRow = (item: NavEntry, sa?: boolean, grip?: React.ReactNode) => (
    <div className={clsx(rowCls, !grip && 'pl-[38px]')}>
      {grip}
      <item.icon size={16} className="flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {sa && <SaBadge />}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900">Tuỳ chỉnh sidebar</h1>
        <button type="button" onClick={() => save(EMPTY_NAV_ORDER)}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <RotateCcw size={13} /> Khôi phục mặc định
        </button>
      </div>

      <SidebarThemePicker />

      {top.flatMap((s) => s.items).map((item) => (
        <div key={item.id} className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white py-2 pl-[40px] pr-2 text-sm font-semibold text-[#003d5c] shadow-sm">
          <item.icon size={16} className="flex-shrink-0" />
          {item.label}
        </div>
      ))}

      <SortableList items={mid} getKey={(s) => s.id} onReorder={(keys) => save({ ...order, groups: keys })} className="space-y-2"
        render={(s, handle, dragging) => (
          <div className={clsx('rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow', dragging && 'shadow-lg ring-2 ring-[#ef5e2f]')}>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <span {...handle} className={gripCls} aria-label={`Kéo để đổi vị trí nhóm ${s.title ?? ''}`}><GripVertical size={16} /></span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest text-[#0069a0]">{s.title}</span>
              {s.sa && <SaBadge />}
            </div>
            {s.items.length > 0 && <div className="border-t border-gray-100 px-2 pb-2 pt-1.5">
              {s.items.length > 1 ? (
                <SortableList items={s.items} getKey={(i) => i.id} onReorder={(keys) => save({ ...order, items: { ...order.items, [s.id]: keys } })}
                  render={(item, h, drag) => (
                    <div className={clsx('rounded-xl', drag && 'shadow-md ring-2 ring-[#ef5e2f]')}>
                      {itemRow(item, s.sa || item.sa, <span {...h} className={gripCls} aria-label={`Kéo để đổi vị trí ${item.label}`}><GripVertical size={15} /></span>)}
                    </div>
                  )} />
              ) : (
                s.items.map((item) => <div key={item.id}>{itemRow(item, s.sa || item.sa)}</div>)
              )}
            </div>}
          </div>
        )} />

      {bottom.map((s) => (
        <div key={s.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 py-2 pl-[40px] pr-2">
            <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest text-[#0069a0]">{s.title}</span>
            {s.sa && <SaBadge />}
          </div>
          <div className="border-t border-gray-100 px-2 pb-2 pt-1.5">
            {s.items.map((item) => <div key={item.id}>{itemRow(item, s.sa || item.sa)}</div>)}
          </div>
        </div>
      ))}
    </div>
  )
}
