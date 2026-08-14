import { Router } from 'express'
import { getConfig } from '../lib/config.js'
import { body, fail, requireUser, route } from '../lib/http.js'
import { checkLink } from '../lib/link.js'
import { resolveName } from '../lib/mojang.js'
import { sendConsoleCommand } from '../lib/bot.js'
import {
  buildTeleportCommand,
  getParticipant,
  getProgress,
  hasVisitedAll,
  listParticipants,
  markVisited,
} from '../lib/contest.js'
import { hit } from '../lib/ratelimit.js'

const router = Router()

router.post(
  '/',
  route(async (req, res) => {
    const user = requireUser(req)
    const config = getConfig()
    const { participantId } = body(req)

    const participant = getParticipant(String(participantId ?? ''))
    if (!participant || participant.hidden) throw fail('참가작을 찾을 수 없습니다.', 404)

    const link = await checkLink(user.id)
    if (link.error) throw fail(link.error, 502)
    if (!link.linked) throw fail('마인크래프트 계정 연동이 필요합니다.', 403, { needsLink: true })

    const cooldown = Number(config.teleport.cooldownSeconds) || 0
    const last = getProgress(user.id).lastTeleportAt ?? 0
    const waitMs = last + cooldown * 1000 - Date.now()
    if (waitMs > 0) throw fail(`${Math.ceil(waitMs / 1000)}초 후에 다시 시도해주세요.`, 429)

    // 위 쿨다운은 성공한 이동만 기록합니다. 명령 전송이 실패하면 시각이 갱신되지 않아
    // 무한정 재시도할 수 있으므로, 콘솔 채널이 도배되지 않게 상한을 하나 더 둡니다.
    const burst = hit('teleport', String(user.id), { limit: 30, windowMs: 60_000 })
    if (!burst.ok) throw fail(`요청이 너무 많습니다. ${burst.retryAfter}초 후에 다시 시도해주세요.`, 429)

    const mcName = link.uuid ? await resolveName(link.uuid) : null

    // 연동 확인을 꺼두거나 연동 API 가 이상한 값을 주면 어느 플레이어를 옮겨야 하는지
    // 알 수 없습니다. buildTeleportCommand 가 형식 검사까지 하므로 결과로 판단합니다.
    let command
    try {
      command = buildTeleportCommand(participant, mcName, link.uuid)
    } catch {
      throw fail('마인크래프트 계정을 확인할 수 없어 텔레포트할 수 없습니다. 관리자에게 문의해주세요.', 409)
    }

    try {
      await sendConsoleCommand(command)
    } catch (err) {
      console.error('[teleport] 콘솔 전송 실패:', err.message)
      throw fail('텔레포트 명령을 서버로 보내지 못했습니다. 관리자에게 문의해주세요.', 502)
    }

    const progress = markVisited(user.id, participant.id)
    res.json({
      ok: true,
      visited: progress.visited,
      total: listParticipants().length,
      unlocked: hasVisitedAll(user.id),
    })
  }),
)

export default router
