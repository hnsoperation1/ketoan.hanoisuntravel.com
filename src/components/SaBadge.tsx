import clsx from 'clsx'

// Huy hiệu vàng "SA" đánh dấu thành phần CHỈ Super Admin dùng được (đặt ngay sau nhãn).
export function SaBadge({ className }: { className?: string }) {
  return (
    <span title="Chỉ Super Admin" aria-label="Chỉ Super Admin"
      className={clsx('inline-flex flex-shrink-0 items-center rounded bg-amber-100 px-1 py-px align-middle text-[9px] font-bold leading-none tracking-wide text-amber-700 ring-1 ring-inset ring-amber-300', className)}>
      SA
    </span>
  )
}
