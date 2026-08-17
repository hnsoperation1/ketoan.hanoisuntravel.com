// Trạng thái khớp mã khách theo mã vé (xem
// migration_ve_debt_records_match_ma_khach.sql): 'matched' = hệ thống tự
// khớp chắc chắn (xanh lá), 'manual' = kế toán tự chọn tay (xanh dương —
// KHÔNG lẫn với xanh lá vì không phải máy xác minh), 'unmatched' = chưa xác
// định (đỏ). Tách riêng file này (thay vì để trong cong-no/page.tsx) để
// MatchSlideOver.tsx dùng chung được mà không tạo circular import với chính
// page.tsx (page.tsx cũng import MatchSlideOver để render).
export type MatchStatus = 'matched' | 'unmatched' | 'manual'

export const MATCH_BADGE: Record<MatchStatus, { text: string; pillCls: string; dotCls: string }> = {
  matched: { text: 'Đã khớp', pillCls: 'bg-emerald-50 text-emerald-700', dotCls: 'bg-emerald-500' },
  manual: { text: 'Đã chọn tay', pillCls: 'bg-blue-50 text-blue-600', dotCls: 'bg-blue-400' },
  unmatched: { text: 'Chưa khớp', pillCls: 'bg-red-50 text-red-600', dotCls: 'bg-red-500' },
}

// Bấm vào ở CẢ 3 trạng thái để mở slide-over xem/chọn lại, không chỉ riêng đỏ.
export function MatchStatusBadge({ status, dense, onClick }: { status: MatchStatus; dense?: boolean; onClick: () => void }) {
  const cfg = MATCH_BADGE[status]
  if (dense) {
    return (
      <button type="button" title={cfg.text} onClick={onClick}
        className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${cfg.dotCls} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all`} />
    )
  }
  return (
    <button type="button" onClick={onClick}
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.pillCls} hover:brightness-95 transition-all`}>
      {cfg.text}
    </button>
  )
}
