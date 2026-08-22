'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy } from 'lucide-react'

// Chọn vùng ô kiểu Excel (kéo chuột chọn hình chữ nhật hàng×cột) rồi Ctrl+C
// hoặc chuột phải → "Sao chép" để copy đúng vùng đó dạng bảng (dán được
// thẳng vào Excel) — thay cho bôi đen văn bản mặc định của trình duyệt
// (chạy theo thứ tự DOM nên lem sang ô/dòng khác, không theo đúng hình
// chữ nhật người dùng kéo).
//
// Dùng trong bất kỳ bảng nào: gọi hook 1 lần trong component bảng, gắn
// `wrapProps` vào div bọc ngoài <table> (cần scroll/focus được), gắn
// `cellProps(r, c)` + `cellClassName(r, c, base)` vào từng <td>, và render
// `{menu}` ở cuối JSX của bảng đó. `getCellText(r, c)` trả về text THẬT
// của ô đó để copy — có thể khác với nội dung hiển thị (vd ô có input, ô
// đã format tiền tệ...).
export function useCellSelection(getCellText: (r: number, c: number) => string) {
  const [selStart, setSelStart] = useState<{ r: number; c: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ r: number; c: number } | null>(null)
  const selecting = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const stop = () => { selecting.current = false }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const selBounds = selStart && selEnd ? {
    r0: Math.min(selStart.r, selEnd.r), r1: Math.max(selStart.r, selEnd.r),
    c0: Math.min(selStart.c, selEnd.c), c1: Math.max(selStart.c, selEnd.c),
  } : null
  const isSelected = (r: number, c: number) => !!selBounds && r >= selBounds.r0 && r <= selBounds.r1 && c >= selBounds.c0 && c <= selBounds.c1

  // Viền quanh CẢ vùng đang chọn (không phải viền từng ô riêng lẻ) —
  // giống marquee chọn vùng của Excel: chỉ vẽ cạnh ở đúng rìa ngoài của
  // hình chữ nhật đang chọn.
  function selectionEdgeClass(r: number, c: number): string {
    if (!selBounds || !isSelected(r, c)) return ''
    const cls: string[] = []
    if (r === selBounds.r0) cls.push('border-t-2 border-t-brand-500')
    if (r === selBounds.r1) cls.push('border-b-2 border-b-brand-500')
    if (c === selBounds.c0) cls.push('border-l-2 border-l-brand-500')
    if (c === selBounds.c1) cls.push('border-r-2 border-r-brand-500')
    return cls.join(' ')
  }

  function startSelect(e: React.MouseEvent, r: number, c: number) {
    if (e.button !== 0) return // chỉ chuột trái mới bắt đầu/thu vùng chọn mới — chuột phải phải giữ nguyên vùng đang có
    selecting.current = true
    setSelStart({ r, c })
    setSelEnd({ r, c })
    wrapRef.current?.focus()
  }
  function extendSelect(r: number, c: number) {
    if (selecting.current) setSelEnd({ r, c })
  }

  function copySelection() {
    if (!selBounds) return
    // Ô có xuống dòng thật bên trong (vd nhiều chặng bay dồn 1 ô) — nếu để
    // nguyên, Excel hiểu nhầm ký tự xuống dòng là bắt đầu 1 dòng bảng tính
    // mới, làm lệch hẳn các cột phía sau khi dán. Bọc trong dấu ngoặc kép
    // (đúng chuẩn escape CSV/TSV) để Excel giữ nguyên trong 1 ô.
    const esc = (v: string) => {
      const s = v ?? ''
      return /[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines: string[] = []
    for (let r = selBounds.r0; r <= selBounds.r1; r++) {
      const cells: string[] = []
      for (let c = selBounds.c0; c <= selBounds.c1; c++) cells.push(esc(getCellText(r, c)))
      lines.push(cells.join('\t'))
    }
    navigator.clipboard.writeText(lines.join('\r\n')).catch(() => {})
  }

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [ctxMenu])
  function handleContextMenu(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault()
    if (!isSelected(r, c)) { setSelStart({ r, c }); setSelEnd({ r, c }) }
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  // Di chuyển ô đang chọn bằng phím mũi tên (giống Excel/Google Sheets) —
  // không biết trước bảng có bao nhiêu hàng/cột (mỗi bảng gọi hook này tự
  // quyết định), nên dò biên bằng chính DOM: mỗi <td> đã có data-cell-r/c
  // (gắn qua cellProps), ô kế tiếp không tồn tại trong DOM = đã ra khỏi
  // bảng → giữ nguyên, không di chuyển. Lấy selEnd làm điểm xuất phát (ô
  // "đang đứng" sau khi kéo chọn vùng), rồi thu về còn đúng 1 ô.
  function moveSelection(dr: number, dc: number) {
    const base = selEnd ?? selStart
    if (!base) return
    const r = base.r + dr
    const c = base.c + dc
    if (r < 0 || c < 0) return
    const target = wrapRef.current?.querySelector<HTMLElement>(`[data-cell-r="${r}"][data-cell-c="${c}"]`)
    if (!target) return
    setSelStart({ r, c })
    setSelEnd({ r, c })
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function cellProps(r: number, c: number) {
    return {
      'data-cell-r': r,
      'data-cell-c': c,
      onMouseDown: (e: React.MouseEvent) => startSelect(e, r, c),
      onMouseEnter: () => extendSelect(r, c),
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, r, c),
    }
  }
  function cellClassName(r: number, c: number, base = ''): string {
    return `${base} ${isSelected(r, c) ? 'bg-brand-100' : ''} ${selectionEdgeClass(r, c)}`.trim()
  }

  const wrapProps = {
    ref: wrapRef,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { copySelection(); return }
      // Chỉ xử lý mũi tên khi phím bấm ngay trên chính div bọc bảng (đã có
      // ô được click qua startSelect → wrapRef.focus()) — KHÔNG xử lý khi
      // đang gõ trong input/textarea lồng bên trong 1 ô (vd EditableCell),
      // nếu không sẽ cướp mất mũi tên dùng để di chuyển con trỏ chữ.
      if (e.target !== e.currentTarget) return
      if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1, 0) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1, 0) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(0, -1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(0, 1) }
    },
  }

  const menu = ctxMenu && mounted ? createPortal(
    <div className="fixed z-[200] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[140px]"
      style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
      <button onClick={() => { copySelection(); setCtxMenu(null) }}
        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2">
        <Copy size={13} /> Sao chép
      </button>
    </div>,
    document.body
  ) : null

  return { cellProps, cellClassName, wrapProps, menu, isSelected }
}
