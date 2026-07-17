import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  return NextResponse.json({ user: { id: user.id, email: user.email } })
}
