// Dựng nội dung + bàn phím inline cho 1 phiếu kho theo từng trạng thái —
// dùng chung cho lúc gửi tin đầu tiên (sendMessage) và mọi lần sửa tin sau
// đó (editMessageText), một tin nhắn duy nhất đi theo suốt vòng đời phiếu.

import type { InlineButton } from './telegram'
import type { KhoLoaiPhieu } from './khoRequestParser'

type PhieuKhoStatus = 'soan' | 'cho_nhan' | 'hoan_tat' | 'hoan_tat_lech' | 'huy'

export interface PhieuKhoCardItem {
  ten: string
  don_vi: string
  so_luong: number
  so_luong_thuc_nhan: number | null
}

export interface PhieuKhoCardInput {
  phieu_no: number
  loai: KhoLoaiPhieu
  status: PhieuKhoStatus
  kho_ten: string
  kho_dich_ten?: string | null
  doan_ten?: string | null
  ghi_chu?: string | null
  nguoi_tao_ten: string
  nguoi_nhan_ten?: string | null
  items: PhieuKhoCardItem[]
}

const LOAI_TITLE: Record<KhoLoaiPhieu, string> = {
  nhap: '📥 NHẬP KHO',
  xuat: '📤 XUẤT KHO',
  chuyen: '🔄 CHUYỂN KHO',
}

function formatItemLine(it: PhieuKhoCardItem, showThucNhan: boolean): string {
  const base = `• ${it.ten}: ${it.so_luong} ${it.don_vi}`
  if (!showThucNhan || it.so_luong_thuc_nhan === null) return base
  if (it.so_luong_thuc_nhan === it.so_luong) return `${base} (đã nhận đủ)`
  return `${base} — thực nhận: ${it.so_luong_thuc_nhan} ${it.don_vi} ⚠️`
}

export function renderPhieuKhoCard(input: PhieuKhoCardInput): { text: string; buttons: InlineButton[][] } {
  const { phieu_no, loai, status, kho_ten, kho_dich_ten, doan_ten, ghi_chu, nguoi_tao_ten, nguoi_nhan_ten, items } = input

  const lines = [`<b>${LOAI_TITLE[loai]} #${phieu_no}</b>`, `Người tạo: ${nguoi_tao_ten}`]

  if (loai === 'chuyen') {
    lines.push(`Từ kho: ${kho_ten} → Đến kho: ${kho_dich_ten}`)
  } else {
    lines.push(`Kho: ${kho_ten}`)
  }
  if (doan_ten) lines.push(`Đoàn: ${doan_ten}`)

  const showThucNhan = status === 'hoan_tat' || status === 'hoan_tat_lech'
  lines.push('', 'Vật phẩm:', ...items.map((it) => formatItemLine(it, showThucNhan)))

  if (ghi_chu) lines.push('', `Ghi chú: ${ghi_chu}`)

  lines.push('')
  if (status === 'cho_nhan') lines.push(`⏳ Đang chờ kho ${kho_dich_ten} xác nhận nhận hàng...`)
  if (status === 'hoan_tat') lines.push(`✅ Hoàn tất${nguoi_nhan_ten ? ` — ${nguoi_nhan_ten} đã xác nhận nhận` : ''}`)
  if (status === 'hoan_tat_lech') lines.push(`✅ Hoàn tất (có chênh lệch)${nguoi_nhan_ten ? ` — ${nguoi_nhan_ten} xác nhận` : ''}`)
  if (status === 'huy') lines.push('❌ Đã huỷ phiếu')

  const cancelButton: InlineButton = { text: '❌ Huỷ', callback_data: `pk:${phieu_no}:cancel` }

  let buttons: InlineButton[][] = []
  if (status === 'soan') {
    buttons = [
      [{ text: '✏️ Sửa lại', callback_data: `pk:${phieu_no}:edit` }, cancelButton],
      [{ text: '✅ Xác nhận', callback_data: `pk:${phieu_no}:confirm` }],
    ]
  } else if (status === 'cho_nhan') {
    buttons = [
      [{ text: '✅ Đã nhận đủ', callback_data: `pk:${phieu_no}:receive_ok` }, { text: '⚠️ Thiếu/lệch', callback_data: `pk:${phieu_no}:receive_short` }],
      [cancelButton],
    ]
  }

  return { text: lines.join('\n'), buttons }
}
