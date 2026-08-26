'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react'

// Hộp thoại xác nhận/thông báo dùng chung — thay cho window.confirm/alert
// mặc định của trình duyệt (hiện ra ở mép trên màn hình, chữ "ketoan.
// hanoisuntravel.com says", không theo giao diện app, không xuống dòng đẹp).
//
// API dạng Promise để THAY THẲNG vào chỗ đang gọi window.confirm mà không
// phải bẻ lại luồng async:
//     if (!await confirm({ title: '...' })) return
// Nơi gọi chỉ cần render thêm {dialog} 1 lần trong JSX của mình.

type Tone = 'default' | 'danger' | 'success'

export type DialogSpec = {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: Tone
  // Chỉ 1 nút "Đóng", không có nút Huỷ — dùng cho thông báo kết quả (thay
  // window.alert). Đặt qua hàm alert() bên dưới, nơi gọi không cần truyền.
  alertOnly?: boolean
}

const TONE_STYLE: Record<Tone, { icon: typeof Info; iconClass: string; confirmClass: string }> = {
  default: {
    icon: Info,
    iconClass: 'text-brand-500 bg-brand-50',
    confirmClass: 'bg-brand-600 hover:bg-brand-700 text-white',
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-red-500 bg-red-50',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500 bg-emerald-50',
    confirmClass: 'bg-brand-600 hover:bg-brand-700 text-white',
  },
}

export function useConfirmDialog() {
  const [spec, setSpec] = useState<DialogSpec | null>(null)
  // Giữ hàm resolve của Promise đang chờ — bấm nút nào thì gọi lại đúng nó.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const open = useCallback((s: DialogSpec) => new Promise<boolean>(resolve => {
    resolveRef.current = resolve
    setSpec(s)
  }), [])

  const close = useCallback((ok: boolean) => {
    setSpec(null)
    resolveRef.current?.(ok)
    resolveRef.current = null
  }, [])

  const confirm = useCallback((s: DialogSpec) => open(s), [open])
  const alert = useCallback(async (s: DialogSpec) => { await open({ ...s, alertOnly: true }) }, [open])

  const dialog = spec ? <ConfirmDialog spec={spec} onClose={close} /> : null

  return { confirm, alert, dialog }
}

function ConfirmDialog({ spec, onClose }: { spec: DialogSpec; onClose: (ok: boolean) => void }) {
  const [visible, setVisible] = useState(false)
  // Chặn bấm 2 lần vào nút xác nhận khi việc phía sau chạy lâu — nơi gọi tự
  // await Promise nên hộp thoại đóng ngay, cờ này chỉ phòng double-click.
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const { icon: Icon, iconClass, confirmClass } = TONE_STYLE[spec.tone ?? 'default']

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  // Esc = huỷ, Enter = xác nhận — thói quen dùng hộp thoại gốc của trình
  // duyệt, giữ nguyên để kế toán không phải đổi cách thao tác.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(false) }
      if (e.key === 'Enter') { e.preventDefault(); setBusy(true); onClose(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={() => onClose(false)}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-150 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-5">
          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconClass}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-bold text-gray-900">{spec.title}</h3>
            {spec.message && (
              <div className="mt-1.5 text-xs text-gray-500 leading-relaxed">{spec.message}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
          {!spec.alertOnly && (
            <button type="button" onClick={() => onClose(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors">
              {spec.cancelLabel ?? 'Huỷ'}
            </button>
          )}
          <button ref={confirmRef} type="button" disabled={busy}
            onClick={() => { setBusy(true); onClose(true) }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            {spec.confirmLabel ?? (spec.alertOnly ? 'Đóng' : 'Xác nhận')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
