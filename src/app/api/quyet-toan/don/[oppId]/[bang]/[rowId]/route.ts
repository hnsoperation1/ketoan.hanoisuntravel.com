import { NextRequest } from 'next/server'
import { requireScreen } from '@/lib/auth'
import { adminClient, docBody, kiemTraDon, loiResponse } from '@/lib/quyetToanServer'
import { suaDong, xoaDong } from '@/lib/quyetToanBang'

type Ctx = { params: Promise<{ oppId: string; bang: string; rowId: string }> }

// PATCH — sửa 1 dòng (tam-ung: body.action = chi | tu_choi | quyet_toan | huy_quyet_toan). Xem lib/quyetToanBang.ts.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const { oppId, bang, rowId } = await ctx.params
  const admin = adminClient()
  try {
    await kiemTraDon(admin, oppId)
    return await suaDong(admin, oppId, user!.id, bang, rowId, await docBody(req))
  } catch (e) {
    return loiResponse(e)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const { oppId, bang, rowId } = await ctx.params
  const admin = adminClient()
  try {
    await kiemTraDon(admin, oppId)
    return await xoaDong(admin, oppId, user!.id, bang, rowId)
  } catch (e) {
    return loiResponse(e)
  }
}
