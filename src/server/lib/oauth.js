const SCOPE = 'identify'

/**
 * 콜백 주소. 아래 순서로 정합니다.
 *   1) 어드민에 적어둔 리디렉션 URL
 *   2) BUILDCONTEST_PUBLIC_ORIGIN 환경변수
 *   3) 접속한 요청의 주소
 *
 * 3번은 Host 헤더에 기대는데, 이 값은 클라이언트가 마음대로 보낼 수 있습니다.
 * 다만 디스코드가 앱에 등록된 목록과 대조하므로 엉뚱한 곳으로 코드가 배달되지는 않고,
 * 대신 등록해둔 주소와 어긋나면 로그인이 실패합니다. 그래서 운영 시에는 1번이나 2번으로
 * 고정해두는 편이 안전합니다. (프록시 뒤라면 https 로 인식되도록 trust proxy 도 켜야 합니다.)
 */
export function redirectUri(config, req) {
  if (config.discord.redirectUri?.trim()) return config.discord.redirectUri.trim()

  const publicOrigin = process.env.BUILDCONTEST_PUBLIC_ORIGIN?.trim()
  if (publicOrigin) {
    try {
      return new URL('/api/auth/callback', publicOrigin).toString()
    } catch {
      /* 형식이 깨졌으면 아래 기본 방식으로 넘어갑니다. */
    }
  }

  return `${req.protocol}://${req.get('host')}/api/auth/callback`
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
