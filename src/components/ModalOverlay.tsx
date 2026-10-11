'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

// Lớp nền mờ của modal (quy tắc chung toàn ERP, 2026-10-12):
// - gắn thẳng vào <body> (portal) để luôn phủ TOÀN MÀN HÌNH, không bị vùng cuộn / khung nội dung cắt hay lệch;
// - KHÔNG đóng khi bấm ra ngoài — modal chỉ đóng bằng nút bên trong (Huỷ, X, nút hoàn tất) để khỏi mất dữ liệu đang nhập.
// `className` thay phần bố cục + màu nền (mặc định: căn giữa, nền đen 30% mờ); luôn giữ `fixed inset-0 z-50`.
// Riêng lớp z-*: nếu `className` có sẵn z-* (modal phải nổi trên khung "Phóng to" z-[100], slide-over z-150,
// modal khác…) thì lớp đó THAY cho z-50 — để 2 lớp z cùng lúc thì Tailwind không đảm bảo lớp nào thắng.
export function ModalOverlay({ children, className }: { children: React.ReactNode; className?: string }) {
  // Chỉ portal khi đã ở trình duyệt (server không có document.body). Dùng useSyncExternalStore thay cho
  // cặp useState + useEffect(setMounted) (bị lint react-hooks/set-state-in-effect chặn): server/hydrate
  // trả false, còn modal mở sau khi trang đã chạy thì ra true ngay lần render đầu — portal gắn cùng lượt
  // commit nên hiệu ứng trượt/mờ dần (requestAnimationFrame) của từng modal vẫn chạy như cũ.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  if (!isClient) return null
  const hasZ = /(^|\s)z-/.test(className ?? '')
  return createPortal(
    <div className={clsx('fixed inset-0', !hasZ && 'z-50', className ?? 'flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm')}>{children}</div>,
    document.body,
  )
}

function subscribeNoop() {
  return () => {}
}
