'use client'

import { useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardPaste } from 'lucide-react'

// Menu chuột phải "Dán ảnh" cho mọi vùng nhận ảnh (anh yêu cầu 2026-10-31: chỗ nào dán ảnh bằng Ctrl+V được thì chuột phải → Dán
// cũng phải được; bản giống ihns.vn/src/components/MenuDanAnh.tsx, chỉ khác báo lỗi qua onLoi vì ketoan không có toast).
// Đọc clipboard bằng Clipboard API — lần đầu trình duyệt hỏi quyền; bị chặn thì nhắc dùng Ctrl+V.
// Ô nhập chữ bên trong vùng giữ menu chuột phải của trình duyệt (Dán ở đó đi qua sự kiện paste như Ctrl+V).
//   const danAnh = useMenuDanAnh(setError)
//   <div onContextMenu={(e) => danAnh.mo(e, addFiles)}>…</div>   {danAnh.menu}
export function useMenuDanAnh(onLoi: (msg: string) => void): { mo: (e: MouseEvent, onFiles: (files: File[]) => void) => void; menu: ReactNode } {
  const [o, setO] = useState<{ x: number; y: number; onFiles: (files: File[]) => void } | null>(null)

  const mo = (e: MouseEvent, onFiles: (files: File[]) => void) => {
    if ((e.target as HTMLElement).closest('input[type="text"], textarea, [contenteditable="true"]')) return
    e.preventDefault()
    setO({ x: Math.min(e.clientX, window.innerWidth - 168), y: Math.min(e.clientY, window.innerHeight - 52), onFiles })
  }

  async function dan() {
    if (!o) return
    setO(null)
    try {
      const ds: File[] = []
      for (const it of await navigator.clipboard.read()) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (type) ds.push(new File([await it.getType(type)], `dan-anh.${type.split('/')[1]}`, { type }))
      }
      if (ds.length) o.onFiles(ds)
      else onLoi('Clipboard không có ảnh')
    } catch {
      onLoi('Trình duyệt chặn đọc clipboard — dùng Ctrl+V để dán')
    }
  }

  const menu = o && createPortal(
    <div className="fixed inset-0 z-[200]" onClick={() => setO(null)} onContextMenu={(e) => { e.preventDefault(); setO(null) }}>
      <div style={{ left: o.x, top: o.y }} onClick={(e) => e.stopPropagation()} className="fixed w-40 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
        <button type="button" onClick={() => void dan()} autoFocus onKeyDown={(e) => { if (e.key === 'Escape') setO(null) }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none">
          <ClipboardPaste size={15} className="text-gray-400" />Dán ảnh
        </button>
      </div>
    </div>,
    document.body,
  )
  return { mo, menu }
}
