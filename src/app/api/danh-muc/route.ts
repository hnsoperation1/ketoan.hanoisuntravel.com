import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { DanhMucItem } from '@/lib/danhMuc'

// Chỉ ĐỌC danh mục chung (RLS danh_muc: mọi tài khoản đăng nhập được đọc) — sửa ở ihns.vn/quan-tri/danh-muc.
// Chỉ cho các loại app này dùng.
const LOAI_DUOC_DOC = new Set(['ngan_hang', 'nhom_khach_ve'])

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const loai = req.nextUrl.searchParams.get('loai') ?? ''
  if (!LOAI_DUOC_DOC.has(loai)) return NextResponse.json({ error: 'Loại danh mục không hợp lệ' }, { status: 400 })

  const supabase = await createClient()
  try {
    const items = await fetchAllRows<DanhMucItem>((from, to) =>
      supabase.from('danh_muc').select('id, ma, ten, thu_tu, dang_dung, meta').eq('loai', loai)
        .order('thu_tu', { ascending: true }).order('ten', { ascending: true }).order('id', { ascending: true })
        .range(from, to),
    )
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi đọc danh mục' }, { status: 500 })
  }
}
