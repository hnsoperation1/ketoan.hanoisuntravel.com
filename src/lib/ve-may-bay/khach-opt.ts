export type KhachOpt = { ma_khach: string; ten_khach: string | null }

// Tách ra dùng chung giữa MaKhachCell (page.tsx) và MatchSlideOver — tránh
// viết lại 2 lần cùng 1 logic lọc "gõ mã hoặc tên khách để tìm".
export function filterKhachOptions(options: KhachOpt[], query: string): KhachOpt[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter(o => o.ma_khach.toLowerCase().includes(q) || (o.ten_khach ?? '').toLowerCase().includes(q))
}
