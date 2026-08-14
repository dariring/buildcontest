import { getConfig } from '@/lib/config.js'
import { requireUser, guarded, json, fail, body } from '@/lib/http.js'
import { checkLink } from '@/lib/link.js'
import { resolveName } from '@/lib/mojang.js'
import { sendConsoleCommand } from '@/lib/bot.js'
import {
  buildTeleportCommand,
  getParticipant,
  getProgress,
  hasVisitedAll,
  listParticipants,
  markVisited,
} from '@/lib/contest.js'

export const dynamic = 'force-dynamic'

export const POST = guarded(async (req) => {
  const user = await requireUser()
  const config = getConfig()
  const { participantId } = await body(req)

  const participant = getParticipant(participantId)
  if (!participant || participant.hidden) return fail('참가작을 찾을 수 없습니다.', 404)

  const link = await checkLink(user.id)
  if (link.error) return fail(link.error, 502)
  if (!link.linked) return fail('마인크래프트 계정 연동이 필요합니다.', 403, { needsLink: true })

  const cooldown = Number(config.teleport.cooldownSeconds) || 0
  const last = getProgress(user.id).lastTeleportAt ?? 0
  const waitMs = last + cooldown * 1000 - Date.now()
  if (waitMs > 0) return fail(`${Math.ceil(waitMs / 1000)}초 후에 다시 시도해주세요.`, 429)

  const mcName = link.uuid ? await resolveName(link.uuid) : null
  if (!mcName && !link.uuid) {
    // 연동 확인을 꺼두면 어느 플레이어를 옮겨야 하는지 알 수 없습니다.
    return fail('마인크래프트 계정을 확인할 수 없어 텔레포트할 수 없습니다. 관리자에게 문의해주세요.', 409)
  }
  const command = buildTeleportCommand(participant, mcName, link.uuid)

  try {
    await sendConsoleCommand(command)
  } catch (err) {
    return fail(`텔레포트 명령 전송 실패: ${err.message}`, 502)
  }

  const progress = markVisited(user.id, participant.id)
  return json({
    ok: true,
    visited: progress.visited,
    total: listParticipants().length,
    unlocked: hasVisitedAll(user.id),
  })
})
