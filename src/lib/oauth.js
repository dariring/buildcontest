const SCOPE = 'identify'

export function redirectUri(config, req) {
  if (config.discord.redirectUri?.trim()) return config.discord.redirectUri.trim()
  return new URL('/api/auth/callback', req.url).toString()
}

export function authorizeUrl(config, req, state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: redirectUri(config, req),
    response_type: 'code',
    scope: config.discord.guildId ? `${SCOPE} guilds` : SCOPE,
    state,
    prompt: 'none',
  })
  return `https://discord.com/api/oauth2/authorize?${params}`
}

export async function exchangeCode(config, req, code) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(config, req),
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`토큰 교환 실패 (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function fetchMe(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`사용자 정보 조회 실패 (${res.status})`)
  return res.json()
}

export async function fetchGuilds(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export function avatarUrl(user) {
  if (!user.avatar) {
    const index = (BigInt(user.id) >> 22n) % 6n
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
}
