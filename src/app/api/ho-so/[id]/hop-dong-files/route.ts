import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ho_so_hop_dong_files')
    .select('*')
    .eq('ho_so_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ files: data })
}
