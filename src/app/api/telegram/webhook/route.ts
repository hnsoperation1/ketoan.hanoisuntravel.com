import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadHoSoImage } from '@/lib/storage'
import { extractCccdFields } from '@/lib/ai-extract'
import { upsertNhanSuFromExtract, createHoSo } from '@/lib/ho-so'
import { notify } from '@/lib/notify'
import { sendMessage, answerCallbackQuery, downloadTelegramFile, type InlineButton } from '@/lib/telegram'
import type { AiExtractedFields } from '@/types'

interface TelegramPhotoSize {
  file_id: string
}

interface TelegramMessage {
  chat: { id: number }
  text?: string
  photo?: TelegramPhotoSize[]
}

interface TelegramCallbackQuery {
  id: string
  data: string
  message: { chat: { id: number } }
}

const IMAGE_TYPE_LABELS: Record<string, string> = {
  cccd_truoc: 'CCCD mặt trước',
  cccd_sau: 'CCCD mặt sau',
  the_hdv: 'Thẻ HDV',
  xac_nhan: 'Xác nhận',
}

interface BotSession {
  chat_id: number
  state: 'idle' | 'choosing_doan' | 'choosing_type' | 'confirming'
  current_doan_id: string | null
  draft_json: { images?: Record<string, string>; fields?: AiExtractedFields }
  pending_image_urls: string[]
}

async function getSession(admin: ReturnType<typeof createAdminClient>, chatId: number): Promise<BotSession> {
  const { data } = await admin.from('bot_session').select('*').eq('chat_id', chatId).maybeSingle()
  if (data) return data as BotSession
  const fresh: BotSession = { chat_id: chatId, state: 'idle', current_doan_id: null, draft_json: {}, pending_image_urls: [] }
  await admin.from('bot_session').insert(fresh)
  return fresh
}

async function saveSession(admin: ReturnType<typeof createAdminClient>, session: BotSession) {
  await admin
    .from('bot_session')
    .update({
      state: session.state,
      current_doan_id: session.current_doan_id,
      draft_json: session.draft_json,
      pending_image_urls: session.pending_image_urls,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', session.chat_id)
}

async function askImageType(chatId: number) {
  const buttons: InlineButton[][] = [
    [{ text: 'CCCD mặt trước', callback_data: 'type:cccd_truoc' }, { text: 'CCCD mặt sau', callback_data: 'type:cccd_sau' }],
    [{ text: 'Thẻ HDV', callback_data: 'type:the_hdv' }, { text: 'Xác nhận', callback_data: 'type:xac_nhan' }],
  ]
  await sendMessage(chatId, 'Ảnh vừa gửi là loại nào?', buttons)
}

function formatFieldsSummary(fields: AiExtractedFields): string {
  const lines = [
    `Họ tên: ${fields.ho_ten ?? '—'}`,
    `Số CCCD: ${fields.so_cccd ?? '—'}`,
    `Ngày sinh: ${fields.ngay_sinh ?? '—'}`,
    `Ngày cấp: ${fields.ngay_cap ?? '—'}`,
    `Nơi cấp: ${fields.noi_cap ?? '—'}`,
    `Địa chỉ: ${fields.dia_chi ?? '—'}`,
    `Số thẻ HDV: ${fields.so_the_hdv ?? '—'}`,
    `Loại thẻ: ${fields.loai_the_hdv ?? '—'}`,
    `Hạn thẻ: ${fields.han_the_hdv ?? '—'}`,
  ]
  return `AI đọc được:\n${lines.join('\n')}\n\nSửa: gửi từng dòng "truong: gia_tri" (vd "ho_ten: Nguyễn Văn A") rồi bấm Xác nhận lại.`
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Sai secret token' }, { status: 401 })
  }

  const update = await req.json()
  const admin = createAdminClient()

  try {
    if (update.callback_query) {
      await handleCallback(admin, update.callback_query)
    } else if (update.message) {
      await handleMessage(admin, update.message)
    }
  } catch (e) {
    console.error('[telegram webhook]', e)
  }

  // Luôn trả 200 cho Telegram dù có lỗi nội bộ, tránh Telegram retry vô hạn.
  return NextResponse.json({ ok: true })
}

async function handleMessage(admin: ReturnType<typeof createAdminClient>, message: TelegramMessage) {
  const chatId = message.chat.id as number
  const session = await getSession(admin, chatId)

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1]
    const { bytes, mimeType } = await downloadTelegramFile(largest.file_id)
    const ext = mimeType.includes('png') ? 'png' : 'jpg'
    const path = `telegram/${chatId}/${Date.now()}.${ext}`
    const signedUrl = await uploadHoSoImage(path, bytes, mimeType)

    session.pending_image_urls.push(signedUrl)

    if (!session.current_doan_id) {
      const { data: recentDoan } = await admin
        .from('doan')
        .select('id, ten_doan, ngay_di')
        .order('ngay_di', { ascending: false })
        .limit(5)
      if (!recentDoan || recentDoan.length === 0) {
        await sendMessage(chatId, 'Chưa có đoàn nào trong hệ thống. Vào dashboard tạo đoàn trước rồi gửi lại ảnh nhé.')
        await saveSession(admin, session)
        return
      }
      session.state = 'choosing_doan'
      await saveSession(admin, session)
      const buttons: InlineButton[][] = recentDoan.map((d) => [{ text: `${d.ten_doan} (${d.ngay_di})`, callback_data: `doan:${d.id}` }])
      await sendMessage(chatId, 'Ảnh này thuộc đoàn nào?', buttons)
      return
    }

    session.state = 'choosing_type'
    await saveSession(admin, session)
    await askImageType(chatId)
    return
  }

  const text: string | undefined = message.text
  if (!text) return

  if (text.trim() === '/xong') {
    const images = session.draft_json.images ?? {}
    if (!images.cccd_truoc || !images.cccd_sau) {
      await sendMessage(chatId, 'Cần ít nhất ảnh CCCD mặt trước và mặt sau trước khi đọc. Gửi thêm ảnh nhé.')
      return
    }
    const fields = await extractCccdFields([
      { url: images.cccd_truoc },
      { url: images.cccd_sau },
      ...(images.the_hdv ? [{ url: images.the_hdv }] : []),
    ])
    session.draft_json.fields = fields
    session.state = 'confirming'
    await saveSession(admin, session)
    await sendMessage(chatId, formatFieldsSummary(fields), [[{ text: '✅ Xác nhận', callback_data: 'confirm:yes' }]])
    return
  }

  if (session.state === 'confirming' && text.includes(':')) {
    const [rawKey, ...rest] = text.split(':')
    const key = rawKey.trim() as keyof AiExtractedFields
    const value = rest.join(':').trim()
    const validKeys: (keyof AiExtractedFields)[] = [
      'ho_ten', 'so_cccd', 'ngay_sinh', 'ngay_cap', 'noi_cap', 'dia_chi', 'so_the_hdv', 'loai_the_hdv', 'han_the_hdv',
    ]
    if (validKeys.includes(key)) {
      session.draft_json.fields = { ...session.draft_json.fields, [key]: value }
      await saveSession(admin, session)
      await sendMessage(chatId, formatFieldsSummary(session.draft_json.fields!), [[{ text: '✅ Xác nhận', callback_data: 'confirm:yes' }]])
    }
  }
}

async function handleCallback(admin: ReturnType<typeof createAdminClient>, cb: TelegramCallbackQuery) {
  const chatId = cb.message.chat.id
  const data = cb.data
  const session = await getSession(admin, chatId)

  await answerCallbackQuery(cb.id)

  if (data.startsWith('doan:')) {
    session.current_doan_id = data.slice('doan:'.length)
    session.state = 'choosing_type'
    await saveSession(admin, session)
    await askImageType(chatId)
    return
  }

  if (data.startsWith('type:')) {
    const type = data.slice('type:'.length)
    const url = session.pending_image_urls.shift()
    if (url) {
      session.draft_json.images = { ...session.draft_json.images, [type]: url }
    }
    session.state = 'idle'
    await saveSession(admin, session)
    if (session.pending_image_urls.length > 0) {
      await askImageType(chatId)
    } else {
      const have = Object.keys(session.draft_json.images ?? {}).map((k) => IMAGE_TYPE_LABELS[k]).join(', ')
      await sendMessage(chatId, `Đã nhận: ${have}.\nGửi thêm ảnh hoặc gõ /xong khi đủ ảnh (CCCD 2 mặt + thẻ HDV) để AI đọc.`)
    }
    return
  }

  if (data === 'confirm:yes') {
    const fields = session.draft_json.fields
    const doanId = session.current_doan_id
    if (!fields || !doanId) {
      await sendMessage(chatId, 'Thiếu dữ liệu, gửi lại ảnh từ đầu giúp mình nhé.')
      return
    }
    const nhansu = await upsertNhanSuFromExtract(admin, fields, 'HDV')
    const images = session.draft_json.images ?? {}
    await createHoSo(admin, {
      doan_id: doanId,
      nhansu_id: nhansu.id,
      trang_thai: 'da_xac_nhan',
      anh_cccd_truoc_url: images.cccd_truoc ?? null,
      anh_cccd_sau_url: images.cccd_sau ?? null,
      anh_the_hdv_url: images.the_hdv ?? null,
      anh_xac_nhan_url: images.xac_nhan ?? null,
    })

    session.state = 'idle'
    session.draft_json = {}
    session.pending_image_urls = []
    await saveSession(admin, session)

    const { data: doanRow } = await admin.from('doan').select('ten_doan').eq('id', doanId).maybeSingle()
    await notify(admin, {
      title: 'Đã thêm hồ sơ mới',
      body: `${nhansu.ho_ten} — đoàn ${doanRow?.ten_doan ?? ''}`,
      link: `/doan/${doanId}`,
    })

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/doan/${doanId}`
    await sendMessage(
      chatId,
      `Đã lưu ${nhansu.ho_ten}. Vào dashboard bổ sung STK/ngân hàng/email và số tiền hợp đồng: ${dashboardUrl}`,
    )
  }
}
