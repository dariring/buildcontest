// 공개 페이지가 필요로 하는 모든 상태를 한 번에 내려주는 엔드포인트.
import { Router } from 'express'
import { getConfig, publicConfig } from '../lib/config.js'
import { getUserSession } from '../lib/session.js'
import { checkLink } from '../lib/link.js'
import { resolveName } from '../lib/mojang.js'
import { getProgress, getVote, hasVisitedAll, listParticipants, tally, votingWindow } from '../lib/contest.js'
import { route } from '../lib/http.js'

const router = Router()

router.get(
  '/',
  route(async (req, res) => {
    const config = getConfig()
    const pub = publicConfig(config)
    // 익명 설정이면 실제 이름을 아예 내려보내지 않습니다.
    // builderDiscordId 는 자기 투표 방지에만 쓰이므로 서버에만 둡니다.
    const participants = listParticipants().map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      builderName: p.anonymous ? null : p.builderName,
      anonymous: Boolean(p.anonymous),
      images: p.images,
    }))

    const window = votingWindow(config)
    const user = getUserSession(req)

    const state = {
      config: pub,
      participants,
      voting: window,
      user: null,
      link: null,
      progress: { visited: [], total: participants.length, unlocked: false },
      myVote: null,
      results: null,
    }

    if (pub.vote.showResultsPublicly) state.results = tally()

    if (user) {
      state.user = { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar }
      const link = await checkLink(user.id)
      const mcName = link.uuid ? await resolveName(link.uuid) : null
      state.link = { linked: link.linked, uuid: link.uuid, mcName, error: link.error }

      const progress = getProgress(user.id)
      state.progress = {
        visited: progress.visited.filter((id) => participants.some((p) => p.id === id)),
        total: participants.length,
        unlocked: hasVisitedAll(user.id),
        lastTeleportAt: progress.lastTeleportAt ?? 0,
      }
      state.myVote = getVote(user.id)
    }

    res.json(state)
  }),
)

export default router
