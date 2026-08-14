import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config.js'
import { setUserSession, takeOAuthState } from '@/lib/session.js'
import { exchangeCode, fetchGuilds, fetchMe, avatarUrl } from '@/lib/oauth.js'

export const dynamic = 'force-dynamic'

function back(req, error) {
  return NextResponse.redirect(new URL(error ? `/?error=${error}` : '/', req.url))
}

export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = await takeOAuthState()

  if (url.searchParams.get('error')) return back(req, 'discord_denied')
  if (!code) return back(req, 'missing_code')
  if (!state || state !== savedState) return back(req, 'bad_state')

  const config = getConfig()
  try {
    const token = await exchangeCode(config, req, code)
    const me = await fetchMe(token.access_token)

    if (config.discord.guildId) {
      const guilds = await fetchGuilds(token.access_token)
      const inGuild = guilds.some((g) => g.id === config.discord.guildId)
      if (!inGuild) return back(req, 'not_in_guild')
    }

    await setUserSession({
      id: me.id,
      username: me.username,
      displayName: me.global_name || me.username,
      avatar: avatarUrl(me),
    })
    return NextResponse.redirect(new URL('/#participants', req.url))
  } catch (err) {
    console.error('[oauth]', err)
    return back(req, 'oauth_failed')
  }
}
