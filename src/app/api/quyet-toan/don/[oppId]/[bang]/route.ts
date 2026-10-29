import { NextRequest } from 'next/server'
import { requireScreen } from '@/lib/auth'
import { adminClient, docBody, kiemTraDon, loiResponse } from '@/lib/quyetToanServer'
import { taoDong } from '@/lib/quyetToanBang'

type Ctx = { params: Promise<{ oppId: string; bang: string }> }

// POST — thêm 1 dòng vào bảng kế toán nhập (hoa-don | thanh-toan | thu-khach | lich-thu | chi-phi). Xem lib/quyetToanBang.ts.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const { oppId, bang } = await ctx.params
  const admin = adminClient()
  try {
    await kiemTraDon(admin, oppId)
    return await taoDong(admin, oppId, user!.id, bang, await docBody(req))
  } catch (e) {
    return loiResponse(e)
  }
}
