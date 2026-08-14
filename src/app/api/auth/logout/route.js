import { NextResponse } from 'next/server'
import { clearUserSession } from '@/lib/session.js'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  await clearUserSession()
  return NextResponse.json({ ok: true })
}

export async function GET(req) {
  await clearUserSession()
  return NextResponse.redirect(new URL('/', req.url))
}
