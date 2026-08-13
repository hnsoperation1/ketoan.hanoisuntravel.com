import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// POST { name, phone?, note? } — tạo 1 liên hệ CRM mới (bảng contacts, cùng
// Supabase project) để gán làm "Người phụ trách" cho 1 mã khách VMB.
// Trước khi tạo, dò trùng theo SĐT (so khớp sau khi trim) — nếu đã có sẵn
// liên hệ dùng đúng SĐT đó thì KHÔNG tạo thêm bản ghi mới (note gõ vào lần
// này SẼ BỊ BỎ QUA, không ghi đè lên liên hệ có sẵn), trả về luôn liên hệ
// có sẵn kèm duplicate:true để UI báo cho kế toán biết.
export async function POST(req: NextRequest) {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { name, phone, note } = await req.json().catch(() => ({}))
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Thiếu họ tên' }, { status: 400 })
  }
  const phoneTrimmed = phone ? String(phone).trim() : ''

  const admin = createAdminClient()

  if (phoneTrimmed) {
    const { data: existing } = await admin
      .from('contacts')
      .select('id, name, phone, email, company, tax_code, source, note')
      .eq('phone', phoneTrimmed)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ contact: existing, duplicate: true })
    }
  }

  const { data: created, error } = await admin
    .from('contacts')
    .insert({
      name: String(name).trim(),
      phone: phoneTrimmed || null,
      note: note ? String(note).trim() : null,
      source: 'sale',
      created_by: user.id,
    })
    .select('id, name, phone, email, company, tax_code, source, note')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contact: created, duplicate: false })
}
