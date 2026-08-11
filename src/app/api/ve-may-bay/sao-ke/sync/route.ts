import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getGoogleAuth } from '@/lib/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// Đồng bộ thủ công (bấm nút trên UI) từ Google Sheet "SAO KÊ CÁ NHÂN" vào
// bảng sao_ke_giao_dich. Không chạy định kỳ/tự động — chỉ khi user gọi POST.
//
// Mở cho cả ke_toan_allowlist/boss (không chỉ super_admin) — response chỉ
// trả về SỐ LƯỢNG dòng đã đồng bộ (breakdown theo tài khoản), KHÔNG trả
// nội dung giao dịch, nên không lộ thêm dữ liệu gì cho non-superadmin.
// Xem dữ liệu đầy đủ vẫn chỉ super_admin (route GET /api/ve-may-bay/sao-ke
// riêng, không đổi ở đây).
//
// Mapping cột theo VỊ TRÍ (không theo tên header) vì header text lệch nhau
// giữa 5 sheet — xem chú thích trong migration_sao_ke_giao_dich.sql (repo
// hns-crm) và scratchpad gen-seed-sao-ke.js (nguồn gốc logic parse này).
const SPREADSHEET_ID = '1icCvAF9tqR4pxh_kkgMIz28BZ_e2C1M5WWmVU2D_QFI'
const SHEETS = ['Tiền mặt', 'TCB VA 866', 'TCB P889', 'TCB017', 'TCB012']
const HEADER_ROW_IDX = 5 // dòng chứa "STT" (0-based)
const DATA_START_IDX = 6

function parseNum(v: unknown): number | null {
  const s = String(v ?? '').trim()
  if (s === '' || s === '-') return null
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-')
  const cleaned = s.replace(/[()]/g, '').replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}

function str(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export async function POST() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  let batch
  try {
    batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: SHEETS.map(s => `'${s}'!A1:Q3000`),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Không đọc được Google Sheet'
    return NextResponse.json(
      { error: `${msg}. Kiểm tra file đã được share (Viewer) cho ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} chưa.` },
      { status: 502 },
    )
  }

  const admin = createAdminClient()
  let total = 0
  const breakdown: { tai_khoan: string; parsed: number; sheetRows: number }[] = []

  for (let s = 0; s < SHEETS.length; s++) {
    const tai_khoan = SHEETS[s]
    const rows = batch.data.valueRanges?.[s]?.values ?? []
    const header = rows[HEADER_ROW_IDX]
    if (!header || String(header[0] ?? '').trim() !== 'STT') {
      return NextResponse.json(
        { error: `Sheet "${tai_khoan}" sai định dạng (dòng ${HEADER_ROW_IDX + 1} phải là "STT", đọc được ${rows.length} dòng)` },
        { status: 502 },
      )
    }

    const records: Record<string, unknown>[] = []
    for (let i = DATA_START_IDX; i < rows.length; i++) {
      const r = rows[i] ?? []
      const sttRaw = String(r[0] ?? '').trim()
      if (!/^\d+$/.test(sttRaw)) continue // bỏ dòng trống + dòng tổng kết cuối sheet

      records.push({
        tai_khoan,
        stt: parseInt(sttRaw, 10),
        ngay: str(r[1]),
        ma: str(r[3]),
        tag: str(r[4]),
        don_vi: str(r[5]),
        dien_giai: str(r[6]),
        thu: parseNum(r[7]),
        chi: parseNum(r[8]),
        vay: parseNum(r[9]),
        so_du_cuoi_ky: parseNum(r[10]),
        ten_du_an: str(r[11]),
        ma_tk: str(r[12]),
        ma_1: str(r[13]),
        ma_2: str(r[14]),
        ma_3: str(r[15]),
        row_index: i,
      })
    }

    breakdown.push({ tai_khoan, parsed: records.length, sheetRows: rows.length })

    if (records.length === 0) continue

    // Ghi theo lô 500 dòng/lần — upsert 1 lần cả nghìn dòng (TCB017 hiện đã
    // >2500 dòng) có nguy cơ vượt giới hạn payload/timeout của PostgREST,
    // và trước đây lỗi đó không lộ rõ nguyên nhân là do sheet nào.
    try {
      const CHUNK = 500
      for (let c = 0; c < records.length; c += CHUNK) {
        const slice = records.slice(c, c + CHUNK)
        const { error } = await admin
          .from('sao_ke_giao_dich')
          .upsert(slice, { onConflict: 'tai_khoan,row_index' })
        if (error) {
          return NextResponse.json(
            { error: `Lỗi ghi DB (${tai_khoan}, lô dòng ${c}-${c + slice.length}): ${error.message}`, breakdown },
            { status: 500 },
          )
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: `Lỗi không mong đợi khi ghi DB (${tai_khoan}): ${msg}`, breakdown },
        { status: 500 },
      )
    }
    total += records.length
  }

  return NextResponse.json({ synced: total, breakdown })
}
