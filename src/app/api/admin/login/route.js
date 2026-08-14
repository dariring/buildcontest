import { getConfig, saveConfig } from '@/lib/config.js'
import { checkPassword, hashPassword, setAdminSession, clearAdminSession } from '@/lib/session.js'
import { json, fail, handler, body } from '@/lib/http.js'

export const dynamic = 'force-dynamic'

export const POST = handler(async (req) => {
  const { password } = await body(req)
  const config = getConfig()

  // 첫 실행: 여기서 입력한 비밀번호가 관리자 비밀번호가 됩니다.
  if (!config.setupComplete || !config.adminPassword) {
    if (!password || String(password).length < 8) {
      return fail('관리자 비밀번호는 8자 이상이어야 합니다.')
    }
    saveConfig({ adminPassword: hashPassword(String(password)), setupComplete: true })
    await setAdminSession()
    return json({ ok: true, created: true })
  }

  if (!checkPassword(String(password ?? ''), config.adminPassword)) {
    return fail('비밀번호가 올바르지 않습니다.', 401)
  }
  await setAdminSession()
  return json({ ok: true, created: false })
})

export const DELETE = handler(async () => {
  await clearAdminSession()
  return json({ ok: true })
})
