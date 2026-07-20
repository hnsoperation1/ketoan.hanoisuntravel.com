import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { extractProfileFromImages } from '@/lib/ai-extract'
import { uploadHoSoImage } from '@/lib/storage'
import { getErrorMessage } from '@/lib/errors'
import type { ImageKind } from '@/types'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Bước 1 của luồng "Thêm nhân sự": kế toán thả/dán 1 bộ ảnh của MỘT người
 * (không nhất thiết đủ 4 loại). Upload từng ảnh lên Storage rồi gọi AI đọc + tự
 * phân loại từng ảnh, trả về field gộp sẵn + URL từng ảnh kèm loại để kế toán
 * soát trước khi lưu (chưa ghi gì vào DB ở bước này).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return NextResponse.json({ error: 'Thiếu ảnh' }, { status: 400 })
  }

  try {
    const uploaded = await Promise.all(
      files.map(async (file, i) => {
        const bytes = Buffer.from(await file.arrayBuffer())
        const contentType = file.type || 'image/jpeg'
        const ext = contentType.includes('png') ? 'png' : 'jpg'
        const path = `moi/${id}-${Date.now()}-${i}.${ext}`
        const url = await uploadHoSoImage(path, bytes, contentType)
        return { url, bytes, contentType }
      }),
    )

    const { fields, imageTypes } = await extractProfileFromImages(
      uploaded.map((u) => ({ url: u.url })),
    )

    const images: { url: string; kind: ImageKind | null }[] = uploaded.map((u, i) => ({
      url: u.url,
      kind: imageTypes[i] ?? null,
    }))

    return NextResponse.json({ fields, images })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
