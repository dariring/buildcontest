import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config.js'
import { randomState, setOAuthState } from '@/lib/session.js'
import { authorizeUrl } from '@/lib/oauth.js'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const config = getConfig()
  if (!config.discord.clientId || !config.discord.clientSecret) {
    return NextResponse.redirect(new URL('/?error=discord_not_configured', req.url))
  }

  const state = randomState()
  await setOAuthState(state)
  return NextResponse.redirect(authorizeUrl(config, req, state))
}
