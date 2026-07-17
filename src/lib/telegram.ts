const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export interface InlineButton {
  text: string
  callback_data: string
}

async function call(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram ${method} lỗi: ${json.description ?? res.statusText}`)
  return json.result
}

export function sendMessage(chatId: number, text: string, buttons?: InlineButton[][]) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

export function editMessageReplyMarkup(chatId: number, messageId: number, buttons?: InlineButton[][]) {
  return call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: buttons ? { inline_keyboard: buttons } : { inline_keyboard: [] },
  })
}

/** Tải file ảnh từ Telegram (theo file_id) về dạng bytes để upload lên Supabase Storage. */
export async function downloadTelegramFile(fileId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const fileInfo = await call('getFile', { file_id: fileId })
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Không tải được file từ Telegram')
  const bytes = new Uint8Array(await res.arrayBuffer())
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  return { bytes, mimeType }
}
