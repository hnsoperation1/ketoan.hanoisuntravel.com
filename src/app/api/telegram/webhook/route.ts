import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadHoSoImage } from '@/lib/storage'
import { extractCccdFields } from '@/lib/ai-extract'
import { upsertNhanSuFromExtract, createHoSo } from '@/lib/ho-so'
import { notify } from '@/lib/notify'
import { sendMessage, answerCallbackQuery, editMessageText, downloadTelegramFile, type InlineButton } from '@/lib/telegram'
import { parseKhoRequest, type KhoLoaiPhieu } from '@/lib/khoRequestParser'
import { listKhoNames, listVatPhamNames, resolveKho, resolveOrCreateVatPham, type KhoRow } from '@/lib/kho'
import { renderPhieuKhoCard } from '@/lib/khoCard'
import type { AiExtractedFields } from '@/types'

interface TelegramPhotoSize {
  file_id: string
}

interface TelegramMessage {
  chat: { id: number }
  from?: { id: number }
  text?: string
  photo?: TelegramPhotoSize[]
}

interface TelegramCallbackQuery {
  id: string
  data: string
  from: { id: number }
  message: { chat: { id: number }; message_id: number }
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

  // Nhóm này đăng ký cho luồng kho? -> tách hẳn sang xử lý riêng, không đụng
  // tới bot_session/luồng CCCD bên dưới.
  const { data: khoGroup } = await admin.from('kho_telegram_groups').select('chat_id').eq('chat_id', chatId).maybeSingle()
  if (khoGroup) {
    await handleKhoMessage(admin, message)
    return
  }

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
  if ((cb.data ?? '').startsWith('pk:')) {
    await handleKhoCallback(admin, cb)
    return
  }

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
    const nhansu = await upsertNhanSuFromExtract(admin, fields)
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

// ══════════════════════════ Kho quà tặng/lưu niệm ══════════════════════════
// Trạng thái nằm ngay trên dòng phieu_kho (không dùng bot_session) để 1 nhóm
// nhiều thủ kho dùng chung mà không đụng nhau — tra theo (group_chat_id,
// nguoi_tao_id/kho_dich_id, status, editing_field). Xem chi tiết thiết kế ở
// supabase/migrations/20260916_kho.sql.

interface PhieuKhoRow {
  id: string
  phieu_no: number
  loai: KhoLoaiPhieu
  kho_id: string
  kho_dich_id: string | null
  nguoi_tao_id: number
  nguoi_tao_ten: string
  nguoi_nhan_id: number | null
  nguoi_nhan_ten: string | null
  group_chat_id: number
  bot_message_id: number | null
  raw_text: string
  doan_ten: string | null
  ghi_chu: string | null
  editing_field: string | null
  status: 'soan' | 'cho_nhan' | 'hoan_tat' | 'hoan_tat_lech' | 'huy'
}

async function handleKhoMessage(admin: ReturnType<typeof createAdminClient>, message: TelegramMessage) {
  const chatId = message.chat.id
  const senderId = message.from?.id
  const text = message.text?.trim()
  if (!senderId) return

  const { data: thuKho } = await admin.from('kho_thu_kho').select('*').eq('telegram_user_id', senderId).maybeSingle()
  if (!thuKho) {
    if (text) {
      await sendMessage(
        chatId,
        `Bạn chưa được khai báo là thủ kho.\nID Telegram của bạn: <code>${senderId}</code> — gửi cho kế toán để được thêm vào hệ thống.`,
      )
    }
    return
  }
  if (!text) return

  const { data: editingCreate } = await admin
    .from('phieu_kho')
    .select('*')
    .eq('group_chat_id', chatId)
    .eq('nguoi_tao_id', senderId)
    .eq('status', 'soan')
    .eq('editing_field', 'items')
    .maybeSingle()
  if (editingCreate) {
    await applyItemsEdit(admin, editingCreate as PhieuKhoRow, text)
    return
  }

  const { data: editingReceive } = await admin
    .from('phieu_kho')
    .select('*')
    .eq('group_chat_id', chatId)
    .eq('kho_dich_id', thuKho.kho_id)
    .eq('status', 'cho_nhan')
    .eq('editing_field', 'nhan_lech')
    .maybeSingle()
  if (editingReceive) {
    await applyReceiveLech(admin, editingReceive as PhieuKhoRow, text, senderId, thuKho.ho_ten)
    return
  }

  await createPhieuFromText(admin, { chatId, senderId, senderTen: thuKho.ho_ten as string, text })
}

async function createPhieuFromText(
  admin: ReturnType<typeof createAdminClient>,
  input: { chatId: number; senderId: number; senderTen: string; text: string },
) {
  const { chatId, senderId, senderTen, text } = input
  const [khoNames, vatPhamNames] = await Promise.all([listKhoNames(admin), listVatPhamNames(admin)])
  const parsed = await parseKhoRequest(text, { khoNames, vatPhamNames })
  if (!parsed || !parsed.isRequest) return

  const kho = await resolveKho(admin, parsed.kho_ten)
  if (!kho) {
    await sendMessage(chatId, `Không nhận ra kho "${parsed.kho_ten}". Các kho hiện có: ${khoNames.join(', ') || '(chưa khai báo kho nào)'}.`)
    return
  }

  let khoDich: KhoRow | null = null
  if (parsed.loai === 'chuyen') {
    if (!parsed.kho_dich_ten) {
      await sendMessage(chatId, 'Chuyển kho cần rõ kho đích, gửi lại giúp mình nhé (vd "chuyển 20 áo từ kho A sang kho B").')
      return
    }
    khoDich = await resolveKho(admin, parsed.kho_dich_ten)
    if (!khoDich) {
      await sendMessage(chatId, `Không nhận ra kho đích "${parsed.kho_dich_ten}". Các kho hiện có: ${khoNames.join(', ')}.`)
      return
    }
    if (khoDich.id === kho.id) {
      await sendMessage(chatId, 'Kho nguồn và kho đích đang trùng nhau, gửi lại giúp mình nhé.')
      return
    }
  }

  if (parsed.items.length === 0) {
    await sendMessage(chatId, 'Chưa rõ vật phẩm/số lượng, gửi lại rõ hơn nhé (vd "nhập 20 áo, 15 mũ vào kho A").')
    return
  }

  const items: { vat_pham_id: string; ten: string; don_vi: string; so_luong: number }[] = []
  for (const it of parsed.items) {
    const vp = await resolveOrCreateVatPham(admin, it.ten)
    items.push({ vat_pham_id: vp.id, ten: vp.ten, don_vi: vp.don_vi, so_luong: it.so_luong })
  }

  const { data: created, error } = await admin
    .from('phieu_kho')
    .insert({
      loai: parsed.loai,
      kho_id: kho.id,
      kho_dich_id: khoDich?.id ?? null,
      nguoi_tao_id: senderId,
      nguoi_tao_ten: senderTen,
      group_chat_id: chatId,
      raw_text: text,
      doan_ten: parsed.doan_ten ?? null,
      ghi_chu: parsed.ghi_chu ?? null,
      status: 'soan',
    })
    .select('*')
    .single()
  if (error || !created) {
    console.error('[kho webhook] tạo phiếu thất bại', error)
    return
  }

  await admin.from('phieu_kho_chi_tiet').insert(items.map((it) => ({ phieu_id: created.id, vat_pham_id: it.vat_pham_id, so_luong: it.so_luong })))

  const card = renderPhieuKhoCard({
    phieu_no: created.phieu_no,
    loai: created.loai,
    status: created.status,
    kho_ten: kho.ten_kho,
    kho_dich_ten: khoDich?.ten_kho ?? null,
    doan_ten: created.doan_ten,
    ghi_chu: created.ghi_chu,
    nguoi_tao_ten: senderTen,
    nguoi_nhan_ten: null,
    items: items.map((it) => ({ ten: it.ten, don_vi: it.don_vi, so_luong: it.so_luong, so_luong_thuc_nhan: null })),
  })
  const sent = await sendMessage(chatId, card.text, card.buttons)
  await admin.from('phieu_kho').update({ bot_message_id: sent.message_id }).eq('id', created.id)
}

async function applyItemsEdit(admin: ReturnType<typeof createAdminClient>, phieu: PhieuKhoRow, text: string) {
  const [khoNames, vatPhamNames] = await Promise.all([listKhoNames(admin), listVatPhamNames(admin)])
  const parsed = await parseKhoRequest(text, { khoNames, vatPhamNames })
  if (!parsed || !parsed.isRequest) {
    await sendMessage(phieu.group_chat_id, 'Chưa hiểu nội dung sửa, gửi lại nguyên phiếu giúp mình nhé.')
    return
  }

  const kho = await resolveKho(admin, parsed.kho_ten)
  if (!kho) {
    await sendMessage(phieu.group_chat_id, `Không nhận ra kho "${parsed.kho_ten}".`)
    return
  }
  let khoDich: KhoRow | null = null
  if (parsed.loai === 'chuyen') {
    khoDich = parsed.kho_dich_ten ? await resolveKho(admin, parsed.kho_dich_ten) : null
    if (!khoDich || khoDich.id === kho.id) {
      await sendMessage(phieu.group_chat_id, 'Chuyển kho cần rõ kho nguồn và kho đích khác nhau, gửi lại giúp mình nhé.')
      return
    }
  }
  if (parsed.items.length === 0) {
    await sendMessage(phieu.group_chat_id, 'Chưa rõ vật phẩm/số lượng, gửi lại rõ hơn nhé.')
    return
  }

  const items: { vat_pham_id: string; ten: string; don_vi: string; so_luong: number }[] = []
  for (const it of parsed.items) {
    const vp = await resolveOrCreateVatPham(admin, it.ten)
    items.push({ vat_pham_id: vp.id, ten: vp.ten, don_vi: vp.don_vi, so_luong: it.so_luong })
  }

  await admin
    .from('phieu_kho')
    .update({
      loai: parsed.loai,
      kho_id: kho.id,
      kho_dich_id: khoDich?.id ?? null,
      raw_text: text,
      doan_ten: parsed.doan_ten ?? null,
      ghi_chu: parsed.ghi_chu ?? null,
      editing_field: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', phieu.id)
  await admin.from('phieu_kho_chi_tiet').delete().eq('phieu_id', phieu.id)
  await admin.from('phieu_kho_chi_tiet').insert(items.map((it) => ({ phieu_id: phieu.id, vat_pham_id: it.vat_pham_id, so_luong: it.so_luong })))

  const card = renderPhieuKhoCard({
    phieu_no: phieu.phieu_no,
    loai: parsed.loai,
    status: 'soan',
    kho_ten: kho.ten_kho,
    kho_dich_ten: khoDich?.ten_kho ?? null,
    doan_ten: parsed.doan_ten ?? null,
    ghi_chu: parsed.ghi_chu ?? null,
    nguoi_tao_ten: phieu.nguoi_tao_ten,
    nguoi_nhan_ten: null,
    items: items.map((it) => ({ ten: it.ten, don_vi: it.don_vi, so_luong: it.so_luong, so_luong_thuc_nhan: null })),
  })
  if (phieu.bot_message_id) await editMessageText(phieu.group_chat_id, phieu.bot_message_id, card.text, card.buttons)
}

async function applyReceiveLech(
  admin: ReturnType<typeof createAdminClient>,
  phieu: PhieuKhoRow,
  text: string,
  senderId: number,
  senderTen: string,
) {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').trim().toLowerCase()

  const { data: chiTiet } = await admin
    .from('phieu_kho_chi_tiet')
    .select('*, vat_pham:vat_pham_id(id, ten, don_vi)')
    .eq('phieu_id', phieu.id)
  const rows = chiTiet ?? []

  let matchedAny = false
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const ten = line.slice(0, idx).trim()
    const soLuong = Number(line.slice(idx + 1).trim())
    if (!ten || !Number.isFinite(soLuong)) continue
    const row = rows.find((r) => norm(r.vat_pham.ten) === norm(ten))
    if (!row) continue
    matchedAny = true
    await admin.from('phieu_kho_chi_tiet').update({ so_luong_thuc_nhan: soLuong }).eq('id', row.id)
  }

  if (!matchedAny) {
    await sendMessage(phieu.group_chat_id, 'Chưa nhận diện được món nào, gửi lại theo dạng mỗi dòng "tên món: số lượng thực nhận" nhé.')
    return
  }

  const { data: updatedChiTiet } = await admin
    .from('phieu_kho_chi_tiet')
    .select('*, vat_pham:vat_pham_id(id, ten, don_vi)')
    .eq('phieu_id', phieu.id)
  const finalRows = updatedChiTiet ?? []
  const coLech = finalRows.some((r) => r.so_luong_thuc_nhan !== null && r.so_luong_thuc_nhan !== r.so_luong)

  await admin
    .from('phieu_kho')
    .update({
      status: coLech ? 'hoan_tat_lech' : 'hoan_tat',
      nguoi_nhan_id: senderId,
      nguoi_nhan_ten: senderTen,
      xac_nhan_nhan_at: new Date().toISOString(),
      editing_field: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', phieu.id)

  await renderAndEdit(admin, {
    ...phieu,
    status: coLech ? 'hoan_tat_lech' : 'hoan_tat',
    nguoi_nhan_ten: senderTen,
  })
}

async function handleKhoCallback(admin: ReturnType<typeof createAdminClient>, cb: TelegramCallbackQuery) {
  const [, phieuNoRaw, action] = (cb.data ?? '').split(':')
  const callerId = cb.from.id

  const { data: phieu } = await admin.from('phieu_kho').select('*').eq('phieu_no', Number(phieuNoRaw)).maybeSingle()
  if (!phieu) {
    await answerCallbackQuery(cb.id, 'Phiếu này không còn tồn tại', true)
    return
  }
  const { data: callerThuKho } = await admin.from('kho_thu_kho').select('*').eq('telegram_user_id', callerId).maybeSingle()

  if (action === 'edit') {
    if (phieu.status !== 'soan' || phieu.nguoi_tao_id !== callerId) {
      await answerCallbackQuery(cb.id, 'Bạn không có quyền thao tác này', true)
      return
    }
    await admin.from('phieu_kho').update({ editing_field: 'items' }).eq('id', phieu.id)
    if (phieu.bot_message_id) {
      await editMessageText(
        phieu.group_chat_id,
        phieu.bot_message_id,
        'Gửi lại toàn bộ nội dung phiếu (vd "chuyển 20 áo, 15 mũ từ kho A sang kho B") để thay cho phiếu cũ:',
        [],
      )
    }
    await answerCallbackQuery(cb.id)
    return
  }

  if (action === 'cancel') {
    const cancellable = phieu.status === 'soan' || phieu.status === 'cho_nhan'
    const allowed =
      phieu.nguoi_tao_id === callerId || (phieu.status === 'cho_nhan' && callerThuKho?.kho_id === phieu.kho_dich_id)
    if (!cancellable || !allowed) {
      await answerCallbackQuery(cb.id, 'Bạn không có quyền thao tác này', true)
      return
    }
    await admin.from('phieu_kho').update({ status: 'huy', editing_field: null, updated_at: new Date().toISOString() }).eq('id', phieu.id)
    await renderAndEdit(admin, { ...phieu, status: 'huy' })
    await answerCallbackQuery(cb.id, 'Đã huỷ phiếu')
    return
  }

  if (action === 'confirm') {
    if (phieu.status !== 'soan' || phieu.nguoi_tao_id !== callerId) {
      await answerCallbackQuery(cb.id, 'Bạn không có quyền thao tác này', true)
      return
    }
    const newStatus = phieu.loai === 'chuyen' ? 'cho_nhan' : 'hoan_tat'
    await admin
      .from('phieu_kho')
      .update({ status: newStatus, xac_nhan_tao_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', phieu.id)
    await renderAndEdit(admin, { ...phieu, status: newStatus })
    await answerCallbackQuery(cb.id, 'Đã xác nhận')
    return
  }

  if (action === 'receive_ok' || action === 'receive_short') {
    if (phieu.status !== 'cho_nhan' || callerThuKho?.kho_id !== phieu.kho_dich_id) {
      await answerCallbackQuery(cb.id, 'Bạn không có quyền thao tác này', true)
      return
    }

    if (action === 'receive_short') {
      await admin.from('phieu_kho').update({ editing_field: 'nhan_lech' }).eq('id', phieu.id)
      if (phieu.bot_message_id) {
        await editMessageText(
          phieu.group_chat_id,
          phieu.bot_message_id,
          'Gửi số lượng thực nhận của (các) món bị thiếu/lệch, mỗi dòng 1 món dạng "tên món: số lượng" (món không nhắc tới coi như đã nhận đủ):',
          [],
        )
      }
      await answerCallbackQuery(cb.id)
      return
    }

    await admin
      .from('phieu_kho')
      .update({
        status: 'hoan_tat',
        nguoi_nhan_id: callerId,
        nguoi_nhan_ten: callerThuKho?.ho_ten ?? '',
        xac_nhan_nhan_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', phieu.id)
    await renderAndEdit(admin, { ...phieu, status: 'hoan_tat', nguoi_nhan_ten: callerThuKho?.ho_ten ?? '' })
    await answerCallbackQuery(cb.id, 'Đã xác nhận nhận hàng')
    return
  }

  await answerCallbackQuery(cb.id)
}

async function renderAndEdit(admin: ReturnType<typeof createAdminClient>, phieu: PhieuKhoRow) {
  const [khoRes, khoDichRes, chiTietRes] = await Promise.all([
    admin.from('kho').select('ten_kho').eq('id', phieu.kho_id).maybeSingle(),
    phieu.kho_dich_id ? admin.from('kho').select('ten_kho').eq('id', phieu.kho_dich_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('phieu_kho_chi_tiet').select('*, vat_pham:vat_pham_id(id, ten, don_vi)').eq('phieu_id', phieu.id),
  ])
  const card = renderPhieuKhoCard({
    phieu_no: phieu.phieu_no,
    loai: phieu.loai,
    status: phieu.status,
    kho_ten: khoRes.data?.ten_kho ?? '',
    kho_dich_ten: khoDichRes.data?.ten_kho ?? null,
    doan_ten: phieu.doan_ten,
    ghi_chu: phieu.ghi_chu,
    nguoi_tao_ten: phieu.nguoi_tao_ten,
    nguoi_nhan_ten: phieu.nguoi_nhan_ten,
    items: (chiTietRes.data ?? []).map((r) => ({
      ten: r.vat_pham.ten,
      don_vi: r.vat_pham.don_vi,
      so_luong: r.so_luong,
      so_luong_thuc_nhan: r.so_luong_thuc_nhan,
    })),
  })
  if (phieu.bot_message_id) await editMessageText(phieu.group_chat_id, phieu.bot_message_id, card.text, card.buttons)
}
