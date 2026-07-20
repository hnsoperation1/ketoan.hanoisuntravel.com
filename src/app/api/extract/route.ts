import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { extractCccdFields, type ExtractImageInput } from '@/lib/ai-extract'
import { getErrorMessage } from '@/lib/errors'

/** Fallback thủ công từ dashboard: kế toán upload ảnh CCCD/thẻ HDV thẳng từ trình duyệt
 *  thay vì qua Telegram bot, dùng chung logic AI trích xuất trong lib/ai-extract.ts. */
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return NextResponse.json({ error: 'Thiếu ảnh' }, { status: 400 })
  }

  const images: ExtractImageInput[] = await Promise.all(
    files.map(async (file) => ({
      base64: Buffer.from(await file.arrayBuffer()).toString('base64'),
      mimeType: file.type || 'image/jpeg',
    })),
  )

  try {
    const fields = await extractCccdFields(images)
    return NextResponse.json({ fields })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
