import OpenAI from 'openai'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import type { AiExtractedFields, ImageKind } from '@/types'

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
  "loai_the_hdv": "CHỈ được là 1 trong 2 giá trị: 'Nội địa' hoặc 'Quốc tế' — tự dịch/suy ra từ chữ trên thẻ (vd 'Domestic Tour Guide Licence' -> 'Nội địa', 'International Tour Guide Licence' -> 'Quốc tế'), KHÔNG chép nguyên văn tiếng Anh trên thẻ",
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

const PROFILE_PROMPT = `Bạn là AI hỗ trợ phòng kế toán một công ty du lịch nhập hồ sơ hướng dẫn viên/MC/nhân sự (HDV/MC/NS).

Kế toán thả vào 1 bộ ảnh của MỘT người, gồm tối đa 4 loại (không nhất thiết đủ cả 4):
- "cccd_truoc": mặt trước CCCD (ảnh, tên, ngày sinh, quê quán...)
- "cccd_sau": mặt sau CCCD (vân tay, ngày cấp, mã vạch...)
- "the_hdv": thẻ hướng dẫn viên du lịch (số thẻ, loại thẻ, hạn thẻ)
- "xac_nhan": ảnh chụp màn hình tin nhắn Zalo do người đó tự gõ gửi kế toán — thường có họ tên, SĐT, mã số thuế (MST), số tài khoản (STK) + tên ngân hàng, có thể kèm theo ảnh CCCD/thẻ chụp lại (độ phân giải thấp hơn ảnh gốc).

Nhiệm vụ:
1. Với mỗi ảnh được đưa vào (theo đúng thứ tự, đánh số từ 0), xác định nó thuộc loại nào trong 4 loại trên.
2. Trích xuất và GỘP thông tin của người này vào một bộ field duy nhất. Quy tắc ưu tiên khi 1 field xuất hiện ở nhiều ảnh:
   - "ho_ten", "so_cccd", "ngay_sinh", "ngay_cap", "noi_cap", "dia_chi": lấy từ CCCD gốc (rõ nét, chính xác pháp lý) nếu có, chỉ lấy từ ảnh xác nhận khi không có CCCD gốc.
   - "so_the_hdv", "loai_the_hdv", "han_the_hdv": lấy từ ảnh thẻ HDV gốc nếu có. "loai_the_hdv" CHỈ được là 1 trong 2 giá trị "Nội địa" hoặc "Quốc tế" — tự dịch/suy ra từ chữ trên thẻ (vd "Domestic Tour Guide Licence" -> "Nội địa", "International Tour Guide Licence" -> "Quốc tế"), KHÔNG chép nguyên văn tiếng Anh trên thẻ.
   - "sdt", "ma_so_thue_tncn", "stk", "ten_ngan_hang": lấy từ ảnh xác nhận (đây là nguồn gõ tay rõ ràng, KHÔNG có trên CCCD/thẻ).
3. Trường nào không tìm thấy ở bất kỳ ảnh nào thì bỏ qua, KHÔNG bịa đặt.

Trả về đúng JSON thuần (không markdown, không text thêm) theo cấu trúc:
{
  "images": [ { "index": 0, "type": "cccd_truoc" }, { "index": 1, "type": "xac_nhan" } ],
  "fields": {
    "ho_ten": "...", "so_cccd": "...", "ngay_sinh": "yyyy-mm-dd", "ngay_cap": "yyyy-mm-dd",
    "noi_cap": "...", "dia_chi": "...", "so_the_hdv": "...", "loai_the_hdv": "...", "han_the_hdv": "yyyy-mm-dd",
    "sdt": "...", "ma_so_thue_tncn": "...", "stk": "...", "ten_ngan_hang": "..."
  }
}`

/** Kết quả AI đọc 1 bộ ảnh của 1 người: field đã gộp + loại của từng ảnh đầu vào
 *  (theo đúng thứ tự images truyền vào) — dùng cho luồng "Thêm nhân sự" trên dashboard,
 *  khác extractCccdFields (bot Telegram) ở chỗ tự phân loại ảnh thay vì hỏi tay từng ảnh. */
export async function extractProfileFromImages(
  images: ExtractImageInput[],
): Promise<{ fields: AiExtractedFields; imageTypes: (ImageKind | null)[] }> {
  if (images.length === 0) return { fields: {}, imageTypes: [] }

  const userContent: ChatCompletionContentPart[] = images.map((img) => ({
    type: 'image_url',
    image_url: { url: toImageUrl(img), detail: 'high' },
  }))
  userContent.push({ type: 'text', text: PROFILE_PROMPT })

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1536,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  try {
    const parsed = JSON.parse(raw) as {
      images?: { index: number; type: ImageKind }[]
      fields?: AiExtractedFields
    }
    const imageTypes: (ImageKind | null)[] = images.map((_, i) => {
      const match = parsed.images?.find((x) => x.index === i)
      return match?.type ?? null
    })
    return { fields: parsed.fields ?? {}, imageTypes }
  } catch {
    return { fields: {}, imageTypes: images.map(() => null) }
  }
}
