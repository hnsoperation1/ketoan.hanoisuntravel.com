// Phân trang lấy HẾT dữ liệu thay vì tin vào 1 lệnh .limit(N) duy nhất —
// Supabase/PostgREST có trần số dòng mặc định mỗi request (thường 1000,
// tuỳ cấu hình project) ĐỘC LẬP với .limit() code yêu cầu, và khi bảng
// vượt trần đó, dòng nào bị giữ lại/bị bỏ là KHÔNG đảm bảo nếu câu query
// không có .order() theo cột ổn định — từng khiến dữ liệu có thật (mới
// nhất) biến mất khỏi kết quả dù code ghi .limit(10000)/.limit(20000) hẳn
// hoi. Dùng .range() lặp theo lô để chắc chắn lấy đủ, bất kể tổng số dòng
// bao nhiêu.
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}
