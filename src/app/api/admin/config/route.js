import { getConfig, saveConfig, contestTitle } from '@/lib/config.js'
import { hashPassword } from '@/lib/session.js'
import { requireAdmin, guarded, json, fail, body } from '@/lib/http.js'
import { botStatus, restartBot } from '@/lib/bot.js'
import { clearLinkCache } from '@/lib/link.js'
import { warmBot } from '@/lib/warm.js'

export const dynamic = 'force-dynamic'

/** 저장 파일에만 있어야 하는 값들을 걷어냅니다. */
function forClient(config) {
  const { adminPassword, sessionSecret, ...rest } = config
  return { ...rest, title: contestTitle(config), hasAdminPassword: Boolean(adminPassword) }
}

export const GET = guarded(async () => {
  await requireAdmin()
  warmBot() // 대시보드에 봇 상태가 제대로 뜨도록 미리 붙여둡니다.
  return json({ config: forClient(getConfig()), bot: botStatus() })
})

export const PATCH = guarded(async (req) => {
  await requireAdmin()
  const patch = await body(req)

  // 비밀번호는 평문 필드로 들어오면 즉시 해시로 바꿔 저장합니다.
  if (typeof patch.newAdminPassword === 'string' && patch.newAdminPassword) {
    if (patch.newAdminPassword.length < 8) return fail('관리자 비밀번호는 8자 이상이어야 합니다.')
    patch.adminPassword = hashPassword(patch.newAdminPassword)
  }
  delete patch.newAdminPassword
  delete patch.sessionSecret

  const before = getConfig()
  const config = saveConfig(patch)

  // 토큰이 바뀌었으면 봇을 다시 붙입니다.
  if (before.discord.botToken !== config.discord.botToken) {
    restartBot().catch(() => {})
  }
  // 연동 API 설정이 바뀌면 캐시된 조회 결과는 더 이상 믿을 수 없습니다.
  if (JSON.stringify(before.link) !== JSON.stringify(config.link)) clearLinkCache()

  return json({ ok: true, config: forClient(config), bot: botStatus() })
})
