import { Router } from 'express'
import { getConfig, contestTitle } from '../lib/config.js'
import { body, fail, requireUser, route } from '../lib/http.js'
import { checkLink } from '../lib/link.js'
import { resolveName } from '../lib/mojang.js'
import { sendToChannel } from '../lib/bot.js'
import { getParticipant, getVote, hasVisitedAll, saveVote, tally, votingWindow } from '../lib/contest.js'
import { hit } from '../lib/ratelimit.js'

const router = Router()

const WINDOW_MESSAGE = {
  before: '아직 투표 기간이 아닙니다.',
  after: '투표가 마감되었습니다.',
  unscheduled: '투표 기간이 아직 정해지지 않았습니다.',
}

router.post(
  '/',
  route(async (req, res) => {
    const user = requireUser(req)
    const config = getConfig()
    const { picks } = body(req)

    // 수정 허용이 켜져 있으면 같은 사람이 계속 다시 낼 수 있습니다.
    // 제출마다 디스코드 알림이 나가므로 채널 도배를 막을 상한을 둡니다.
    const burst = hit('vote', String(user.id), { limit: 10, windowMs: 60_000 })
    if (!burst.ok) throw fail(`요청이 너무 많습니다. ${burst.retryAfter}초 후에 다시 시도해주세요.`, 429)

    const window = votingWindow(config)
    if (!window.open) throw fail(WINDOW_MESSAGE[window.reason] ?? '지금은 투표할 수 없습니다.', 403)

    const link = await checkLink(user.id)
    if (link.error) throw fail(link.error, 502)
    if (!link.linked) throw fail('마인크래프트 계정 연동이 필요합니다.', 403, { needsLink: true })

    if (!hasVisitedAll(user.id)) throw fail('모든 참가작을 텔레포트로 둘러본 뒤에 투표할 수 있습니다.', 403)

    const existing = getVote(user.id)
    if (existing && !config.vote.allowRevote) throw fail('이미 투표하셨습니다.', 409)

    const unique = [...new Set(Array.isArray(picks) ? picks.map(String) : [])]
    if (unique.length === 0) throw fail('최소 한 명은 선택해주세요.')
    if (unique.length > config.vote.maxVotes) throw fail(`최대 ${config.vote.maxVotes}명까지 선택할 수 있습니다.`)

    const chosen = unique.map((id) => getParticipant(id))
    if (chosen.some((p) => !p || p.hidden)) throw fail('존재하지 않는 참가작이 포함되어 있습니다.')

    if (!config.vote.allowSelfVote) {
      const self = chosen.find((p) => p.builderDiscordId && p.builderDiscordId === user.id)
      if (self) throw fail('본인의 작품에는 투표할 수 없습니다.')
    }

    const mcName = link.uuid ? await resolveName(link.uuid) : null
    const entry = {
      discordId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      uuid: link.uuid,
      mcName,
      picks: unique,
      submittedAt: Date.now(),
      revised: Boolean(existing),
    }
    saveVote(user.id, entry)

    // 알림 실패가 투표 자체를 되돌리지는 않습니다.
    // 실패 사유(디스코드 API 오류 문구)는 서버 로그로만 남깁니다. 투표자 화면에
    // 내부 사정을 그대로 띄울 이유가 없고, 어드민은 봇 상태에서 확인할 수 있습니다.
    let notified = true
    if (config.discord.voteChannelId) {
      try {
        await sendToChannel(config.discord.voteChannelId, {
          embeds: [
            {
              title: `🗳️ ${contestTitle(config)} — 투표 접수`,
              color: Number.parseInt((config.contest.accent || '#0071e3').replace('#', ''), 16) || 0x0071e3,
              author: { name: `${user.displayName} (@${user.username})`, icon_url: user.avatar },
              description: chosen
                .map((p, i) => `**${i + 1}.** ${p.title}${p.builderName ? ` — ${p.builderName}` : ''}`)
                .join('\n'),
              fields: [
                { name: '마인크래프트', value: mcName || link.uuid || '알 수 없음', inline: true },
                { name: '구분', value: existing ? '수정' : '신규', inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        })
      } catch (err) {
        notified = false
        console.error('[vote] 알림 전송 실패:', err.message)
      }
    }

    res.json({
      ok: true,
      myVote: entry,
      notified,
      results: config.vote.showResultsPublicly ? tally() : null,
    })
  }),
)

export default router
