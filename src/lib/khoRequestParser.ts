// Đọc tin nhắn tự do trong nhóm Telegram kho, dùng LLM (OpenAI gpt-4o-mini)
// để nhận diện có phải phiếu nhập/xuất/chuyển kho không, và nếu đúng thì
// tách thành dữ liệu có cấu trúc. Cùng cách gọi REST API trực tiếp bằng
// fetch như leaveRequestParser.ts bên ihns.vn (không thêm SDK openai chỉ để
// dùng 1 lệnh gọi đơn giản).

export type KhoLoaiPhieu = 'nhap' | 'xuat' | 'chuyen'

export interface ParsedKhoItem {
  ten: string
  so_luong: number
}

export type ParsedKhoRequest =
  | { isRequest: false }
  | {
      isRequest: true
      loai: KhoLoaiPhieu
      kho_ten: string
      kho_dich_ten?: string
      doan_ten?: string
      ghi_chu?: string
      items: ParsedKhoItem[]
    }

function stripCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return match ? match[1] : trimmed
}

export async function parseKhoRequest(
  rawText: string,
  ctx: { khoNames: string[]; vatPhamNames: string[] },
): Promise<ParsedKhoRequest | null> {
  const khoList = ctx.khoNames.length > 0 ? ctx.khoNames.join(', ') : '(chưa có kho nào)'
  const vatPhamList = ctx.vatPhamNames.length > 0 ? ctx.vatPhamNames.join(', ') : '(chưa có vật phẩm nào)'

  const system = `Bạn đọc tin nhắn trong 1 nhóm chat của thủ kho quà tặng/lưu niệm công ty du lịch. Nhiệm vụ: xác định tin nhắn có phải phiếu nhập kho / xuất kho / chuyển kho hay không, nếu đúng thì tách thông tin.

Các kho hiện có: ${khoList}
Các vật phẩm hiện có trong danh mục: ${vatPhamList}

Quy tắc:
- "kho_ten" (và "kho_dich_ten" nếu là chuyển kho) PHẢI chọn đúng 1 tên trong danh sách kho hiện có ở trên (khớp gần đúng, ví dụ người dùng gõ tắt/sai dấu vẫn map về đúng tên trong danh sách) — TUYỆT ĐỐI không bịa ra tên kho không có trong danh sách. Nếu không xác định được là kho nào trong danh sách, trả is_request false.
- "nhap": chỉ có kho_ten (hàng vào kho đó), không có kho_dich_ten.
- "xuat": chỉ có kho_ten (hàng ra khỏi kho đó), không có kho_dich_ten.
- "chuyen": có cả kho_ten (kho nguồn/kho gửi) và kho_dich_ten (kho đích/kho nhận).
- "items": danh sách vật phẩm + số lượng nhắc tới trong tin nhắn. Với "ten" của từng vật phẩm: nếu khớp gần đúng với 1 tên trong danh mục vật phẩm hiện có thì dùng ĐÚNG tên trong danh mục đó; nếu là vật phẩm mới chưa có trong danh mục thì giữ nguyên tên người dùng gõ (không bịa thêm chi tiết). Không suy đoán số lượng nếu người dùng không nói rõ.
- "doan_ten": tên đoàn/tour nếu có nhắc tới (vd "cho đoàn ABC", "đoàn Hàn Quốc 20/09"), để trống nếu không nhắc.
- "ghi_chu": lý do/ghi chú thêm nếu có (vd "hàng lỗi", "khách VIP"), để trống nếu không có.

Chỉ trả lời bằng JSON, KHÔNG kèm chữ nào khác, đúng 1 trong 2 dạng:
{"is_request": false}
{"is_request": true, "loai": "nhap|xuat|chuyen", "kho_ten": "...", "kho_dich_ten": "...", "doan_ten": "...", "ghi_chu": "...", "items": [{"ten": "...", "so_luong": 0}]}

Tin nhắn phiếm/chào hỏi/không liên quan tới kho -> is_request false.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: rawText },
      ],
    }),
  })

  if (!res.ok) {
    console.error('[khoRequestParser] OpenAI API lỗi', res.status, await res.text().catch(() => ''))
    return null
  }

  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return null

  try {
    const parsed = JSON.parse(stripCodeFence(text))
    if (parsed?.is_request === false) return { isRequest: false }
    if (
      parsed?.is_request === true &&
      typeof parsed.loai === 'string' &&
      ['nhap', 'xuat', 'chuyen'].includes(parsed.loai) &&
      typeof parsed.kho_ten === 'string' &&
      Array.isArray(parsed.items)
    ) {
      const items: ParsedKhoItem[] = parsed.items
        .filter((it: unknown): it is { ten: unknown; so_luong: unknown } => typeof it === 'object' && it !== null)
        .map((it: { ten: unknown; so_luong: unknown }) => ({ ten: String(it.ten ?? '').trim(), so_luong: Number(it.so_luong) }))
        .filter((it: ParsedKhoItem) => it.ten && Number.isFinite(it.so_luong) && it.so_luong > 0)

      return {
        isRequest: true,
        loai: parsed.loai as KhoLoaiPhieu,
        kho_ten: parsed.kho_ten,
        kho_dich_ten: typeof parsed.kho_dich_ten === 'string' && parsed.kho_dich_ten.trim() ? parsed.kho_dich_ten.trim() : undefined,
        doan_ten: typeof parsed.doan_ten === 'string' && parsed.doan_ten.trim() ? parsed.doan_ten.trim() : undefined,
        ghi_chu: typeof parsed.ghi_chu === 'string' && parsed.ghi_chu.trim() ? parsed.ghi_chu.trim() : undefined,
        items,
      }
    }
    return null
  } catch (e) {
    console.error('[khoRequestParser] Không parse được JSON từ LLM', text, e)
    return null
  }
}
