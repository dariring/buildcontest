import { Router } from 'express'
import { getConfig } from '../lib/config.js'
import { route } from '../lib/http.js'
import { clearUserSession, randomState, safeEqual, setOAuthState, setUserSession, takeOAuthState } from '../lib/session.js'
import { authorizeUrl, avatarUrl, exchangeCode, fetchGuilds, fetchMe } from '../lib/oauth.js'
import { clientKey, hit } from '../lib/ratelimit.js'

const router = Router()

// 돌아갈 곳은 항상 우리 사이트 안의 상대 경로입니다.
// 절대 주소를 만들면 Host 헤더를 통해 열린 리디렉션이 될 수 있습니다.
function back(res, error) {
  res.redirect(error ? `/?error=${encodeURIComponent(error)}` : '/')
}

router.get(
  '/login',
  route(async (req, res) => {
    const config = getConfig()
    if (!config.discord.clientId || !config.discord.clientSecret) {
      return back(res, 'discord_not_configured')
    }

    const state = randomState()
    setOAuthState(req, res, state)
    res.redirect(authorizeUrl(config, req, state))
  }),
)

router.get(
  '/callback',
  route(async (req, res) => {
    const { code, state, error } = req.query
    const savedState = takeOAuthState(req, res)

    if (error) return back(res, 'discord_denied')
    if (!code || typeof code !== 'string') return back(res, 'missing_code')
    if (!savedState || !safeEqual(typeof state === 'string' ? state : '', savedState)) return back(res, 'bad_state')

    // 코드 교환은 디스코드로 나가는 요청이라, 콜백 주소를 두들겨 외부 API 를
    // 대신 호출하게 만드는 일이 없도록 시도 횟수를 제한합니다.
    const burst = hit('oauth-callback', clientKey(req), { limit: 20, windowMs: 60_000 })
    if (!burst.ok) return back(res, 'too_many_requests')

    const config = getConfig()
    try {
      const token = await exchangeCode(config, req, code)
      const me = await fetchMe(token.access_token)

      if (config.discord.guildId) {
        const guilds = await fetchGuilds(token.access_token)
        const inGuild = guilds.some((g) => g.id === config.discord.guildId)
        if (!inGuild) return back(res, 'not_in_guild')
      }

      setUserSession(req, res, {
        id: String(me.id),
        username: String(me.username ?? ''),
        displayName: String(me.global_name || me.username || ''),
        avatar: avatarUrl(me),
      })
      res.redirect('/#participants')
    } catch (err) {
      console.error('[oauth]', err)
      back(res, 'oauth_failed')
    }
  }),
)

router.post(
  '/logout',
  route(async (req, res) => {
    clearUserSession(res)
    res.json({ ok: true })
  }),
)

export default router
