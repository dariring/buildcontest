import { getConfig } from './config.js'
import { ensureBot } from './bot.js'

let started = false

/**
 * 첫 요청이 들어오면 봇을 미리 붙여둡니다. 그래야 첫 텔레포트가 로그인 시간을
 * 기다리지 않습니다.
 *
 * instrumentation.js 에서 하지 않는 이유: Next 는 instrumentation 을 edge 런타임용으로도
 * 컴파일하는데, 그 과정에서 discord.js 가 쓰는 worker_threads 같은 Node 전용 모듈을
 * 찾지 못해 빌드가 깨집니다. API 라우트는 전부 Node 런타임이라 여기서는 안전합니다.
 */
export function warmBot() {
  if (started) return
  const token = getConfig().discord.botToken
  if (!token) return // 토큰이 나중에 설정되면 어드민 저장 시점에 restartBot() 이 돕니다.
  started = true
  ensureBot().catch(() => {
    /* 실패해도 botStatus() 로 어드민에 노출됩니다. */
  })
}
