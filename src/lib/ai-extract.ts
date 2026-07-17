import OpenAI from 'openai'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import type { AiExtractedFields } from '@/types'

// Khởi tạo trễ (không phải ở top-level module) — nếu tạo ngay khi import,
// bước "Collecting page data" của Next.js build sẽ load module này và làm
// OpenAI SDK throw do chưa có OPENAI_API_KEY tại thời điểm build.
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

const EXTRACT_PROMPT = `Bạn là AI hỗ trợ trích xuất thông tin từ ảnh CCCD (mặt trước/sau) và ảnh thẻ Hướng dẫn viên (HDV) của một công ty du lịch.

Đọc các ảnh được cung cấp và trích xuất vào JSON với các trường sau (bỏ qua trường không tìm thấy trong ảnh, KHÔNG bịa đặt):

{
  "ho_ten": "họ và tên đầy đủ (từ CCCD)",
  "so_cccd": "số CCCD (12 số)",
  "ngay_sinh": "ngày sinh, định dạng yyyy-mm-dd",
  "ngay_cap": "ngày cấp CCCD, định dạng yyyy-mm-dd",
  "noi_cap": "nơi cấp CCCD",
  "dia_chi": "địa chỉ thường trú đầy đủ trên CCCD",
  "so_the_hdv": "số thẻ hướng dẫn viên (nếu có ảnh thẻ HDV)",
  "loai_the_hdv": "loại thẻ, vd Nội địa / Quốc tế",
  "han_the_hdv": "hạn thẻ HDV, định dạng yyyy-mm-dd"
}

Trả về JSON thuần, KHÔNG có markdown, không có text thêm.`

export type ExtractImageInput = { base64: string; mimeType: string } | { url: string }

function toImageUrl(img: ExtractImageInput): string {
  return 'url' in img ? img.url : `data:${img.mimeType};base64,${img.base64}`
}

/** Gọi OpenAI gpt-4o (vision) để đọc CCCD + thẻ HDV, trả về field có cấu trúc chờ xác nhận.
 *  Nhận base64 (dashboard upload) hoặc URL đã ký sẵn (ảnh đã lưu Supabase Storage từ bot). */
export async function extractCccdFields(images: ExtractImageInput[]): Promise<AiExtractedFields> {
  if (images.length === 0) return {}

  const userContent: ChatCompletionContentPart[] = images.map((img) => ({
    type: 'image_url',
    image_url: { url: toImageUrl(img), detail: 'high' },
  }))
  userContent.push({ type: 'text', text: EXTRACT_PROMPT })

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(raw) as AiExtractedFields
  } catch {
    return {}
  }
}
