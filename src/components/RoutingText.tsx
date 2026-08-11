import { parseRouting } from '@/lib/routing'

// Hiện chuỗi routing vé (vd "HANVNSGNVNHAN") với mã hãng (VN/VJ/MH...) tô
// nhạt hơn mã sân bay, cho dễ đọc — dùng chung ở mọi màn có cột Hành trình.
export function RoutingText({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <>—</>
  return (
    <span className={className}>
      {parseRouting(value).map((p, i) => (
        <span key={i} className={p.kind === 'airline' ? 'text-gray-400' : p.kind === 'sep' ? 'text-gray-400 px-0.5' : undefined}>
          {p.text}
        </span>
      ))}
    </span>
  )
}
