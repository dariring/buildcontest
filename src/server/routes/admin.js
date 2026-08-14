import { Router } from 'express'
import { contestTitle, getConfig, saveConfig } from '../lib/config.js'
import { adminOnly, body, fail, route } from '../lib/http.js'
import {
  checkPassword,
  clearAdminSession,
  hashPassword,
  isAdmin,
  setAdminSession,
} from '../lib/session.js'
import { botStatus, restartBot, sendConsoleCommand, sendToChannel } from '../lib/bot.js'
import { clearLinkCache, probeLinkApi } from '../lib/link.js'
import {
  archiveCurrent,
  buildTeleportCommand,
  createParticipant,
  deleteParticipant,
  deleteVote,
  getParticipant,
  getVotes,
  listArchives,
  listParticipants,
  reorderParticipants,
  resetContest,
  tally,
  updateParticipant,
  votingWindow,
} from '../lib/contest.js'
import { clientKey, hit, reset } from '../lib/ratelimit.js'

const router = Router()

// ================================================================== 로그인

// 관리자 비밀번호는 이 한 곳만 뚫으면 봇 토큰·콘솔 명령까지 전부 열리는 열쇠입니다.
// 요청자별로 한 번 막고, 헤더 위조로 우회하는 경우를 대비해 전체 시도량에도 상한을 둡니다.
const PER_CLIENT = { limit: 8, windowMs: 15 * 60 * 1000 }
const GLOBAL = { limit: 60, windowMs: 15 * 60 * 1000 }

router.get(
  '/session',
  route(async (req, res) => {
    res.json({ setupComplete: getConfig().setupComplete, authenticated: isAdmin(req) })
  }),
)

router.post(
  '/login',
  route(async (req, res) => {
    const who = clientKey(req)
    for (const [key, rule] of [
      [who, PER_CLIENT],
      ['*', GLOBAL],
    ]) {
      const attempt = hit('admin-login', key, rule)
      if (!attempt.ok) {
        throw fail(`로그인 시도가 너무 많습니다. ${attempt.retryAfter}초 후에 다시 시도해주세요.`, 429)
      }
    }

    const { password } = body(req)
    const config = getConfig()

    // 첫 실행: 여기서 입력한 비밀번호가 관리자 비밀번호가 됩니다.
    if (!config.setupComplete || !config.adminPassword) {
      if (!password || String(password).length < 8) {
        throw fail('관리자 비밀번호는 8자 이상이어야 합니다.')
      }
      saveConfig({ adminPassword: hashPassword(String(password)), setupComplete: true })
      setAdminSession(req, res)
      reset('admin-login', who)
      return res.json({ ok: true, created: true })
    }

    if (!checkPassword(String(password ?? ''), config.adminPassword)) {
      throw fail('비밀번호가 올바르지 않습니다.', 401)
    }
    setAdminSession(req, res)
    reset('admin-login', who)
    res.json({ ok: true, created: false })
  }),
)

router.delete(
  '/login',
  route(async (req, res) => {
    clearAdminSession(res)
    res.json({ ok: true })
  }),
)

// 여기서부터는 전부 관리자 전용입니다.
router.use(adminOnly)

// ==================================================================== 설정

/** 저장 파일에만 있어야 하는 값들을 걷어냅니다. */
function forClient(config) {
  const { adminPassword, sessionSecret, ...rest } = config
  return { ...rest, title: contestTitle(config), hasAdminPassword: Boolean(adminPassword) }
}

// 이 패널에서 건드릴 수 있는 최상위 키. 나머지는 조용히 버립니다.
// 특히 setupComplete / adminPassword / sessionSecret 이 여기로 새면
// setupComplete 를 false 로 되돌려 초기 설정 화면(= 아무나 관리자 비밀번호를
// 새로 정할 수 있는 상태)을 다시 열어버릴 수 있습니다.
const PATCHABLE = new Set(['contest', 'discord', 'link', 'teleport', 'vote'])

router.get(
  '/config',
  route(async (req, res) => {
    res.json({ config: forClient(getConfig()), bot: botStatus() })
  }),
)

router.patch(
  '/config',
  route(async (req, res) => {
    const raw = body(req)

    const patch = {}
    for (const key of Object.keys(raw)) {
      if (PATCHABLE.has(key)) patch[key] = raw[key]
    }

    // 비밀번호는 평문 필드로 들어오면 즉시 해시로 바꿔 저장합니다.
    if (typeof raw.newAdminPassword === 'string' && raw.newAdminPassword) {
      if (raw.newAdminPassword.length < 8) throw fail('관리자 비밀번호는 8자 이상이어야 합니다.')
      patch.adminPassword = hashPassword(raw.newAdminPassword)
    }

    const before = getConfig()
    const config = saveConfig(patch)

    // 비밀번호를 바꾸면 기존 관리자 세션이 전부 끊깁니다(의도한 동작).
    // 방금 바꾼 본인까지 튕기지 않도록 이 요청에는 새 세션을 다시 발급합니다.
    if (patch.adminPassword) setAdminSession(req, res)

    // 토큰이 바뀌었으면 봇을 다시 붙입니다.
    if (before.discord.botToken !== config.discord.botToken) {
      restartBot().catch(() => {})
    }
    // 연동 API 설정이 바뀌면 캐시된 조회 결과는 더 이상 믿을 수 없습니다.
    if (JSON.stringify(before.link) !== JSON.stringify(config.link)) clearLinkCache()

    res.json({ ok: true, config: forClient(config), bot: botStatus() })
  }),
)

// ================================================================== 참가작

router.get(
  '/participants',
  route(async (req, res) => {
    res.json({ participants: listParticipants({ includeHidden: true }) })
  }),
)

router.post(
  '/participants',
  route(async (req, res) => {
    const input = body(req)
    if (!String(input.title ?? '').trim()) throw fail('건축물 제목을 입력해주세요.')
    const participant = createParticipant(input)
    res.json({ ok: true, participant, participants: listParticipants({ includeHidden: true }) })
  }),
)

// 순서 변경
router.put(
  '/participants',
  route(async (req, res) => {
    const { ids } = body(req)
    if (!Array.isArray(ids)) throw fail('ids 배열이 필요합니다.')
    res.json({ ok: true, participants: reorderParticipants(ids.map(String)) })
  }),
)

router.patch(
  '/participants/:id',
  route(async (req, res) => {
    const updated = updateParticipant(req.params.id, body(req))
    if (!updated) throw fail('참가작을 찾을 수 없습니다.', 404)
    res.json({ ok: true, participant: updated, participants: listParticipants({ includeHidden: true }) })
  }),
)

router.delete(
  '/participants/:id',
  route(async (req, res) => {
    deleteParticipant(req.params.id)
    res.json({ ok: true, participants: listParticipants({ includeHidden: true }) })
  }),
)

// ==================================================================== 투표

router.get(
  '/votes',
  route(async (req, res) => {
    const votes = Object.values(getVotes()).sort((a, b) => b.submittedAt - a.submittedAt)
    const participants = listParticipants({ includeHidden: true })
    const titles = new Map(participants.map((p) => [p.id, p.title]))
    const summary = tally()

    if (req.query.format === 'csv') {
      const header = ['디스코드ID', '디스코드이름', '마인크래프트', '선택1', '선택2', '선택3', '제출시각']
      // 디스코드 표시 이름은 사용자가 마음대로 정하는 값입니다. =, +, -, @ 로 시작하면
      // 엑셀이 수식으로 해석하므로(CSV 수식 주입) 앞에 작은따옴표를 붙여 무력화합니다.
      const escape = (v) => {
        const raw = String(v ?? '')
        const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
        return `"${safe.replace(/"/g, '""')}"`
      }
      const lines = [header.map(escape).join(',')]
      for (const v of votes) {
        lines.push(
          [
            v.discordId,
            v.displayName,
            v.mcName || v.uuid || '',
            ...[0, 1, 2].map((i) => titles.get(v.picks[i]) ?? ''),
            new Date(v.submittedAt).toLocaleString('ko-KR'),
          ]
            .map(escape)
            .join(','),
        )
      }
      res.set('content-type', 'text/csv; charset=utf-8')
      res.set('content-disposition', `attachment; filename="votes-${Date.now()}.csv"`)
      return res.send('﻿' + lines.join('\r\n'))
    }

    res.json({
      votes: votes.map((v) => ({ ...v, pickTitles: v.picks.map((id) => titles.get(id) ?? '(삭제됨)') })),
      summary,
      voting: votingWindow(getConfig()),
    })
  }),
)

router.delete(
  '/votes',
  route(async (req, res) => {
    const { discordId } = body(req)
    if (!discordId) throw fail('discordId 가 필요합니다.')
    deleteVote(String(discordId))
    res.json({ ok: true, summary: tally() })
  }),
)

// ================================================================== 초기화

router.get(
  '/reset',
  route(async (req, res) => {
    res.json({ archives: listArchives() })
  }),
)

router.post(
  '/reset',
  route(async (req, res) => {
    const {
      archive = true,
      clearVotes = true,
      clearProgress = true,
      clearParticipants = false,
      advanceMonth = true,
      clearSchedule = true,
    } = body(req)

    const snapshot = archive ? archiveCurrent() : null
    resetContest({ clearVotes, clearProgress, clearParticipants })

    const patch = {}
    if (advanceMonth) {
      const { month, year } = getConfig().contest
      patch.contest = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
    }
    if (clearSchedule) {
      patch.vote = { startAt: '', endAt: '', manualOpen: false }
    }
    const config = Object.keys(patch).length ? saveConfig(patch) : getConfig()

    res.json({
      ok: true,
      archivedId: snapshot?.id ?? null,
      contest: config.contest,
      archives: listArchives(),
    })
  }),
)

// ================================================================== 진단

router.post(
  '/test',
  route(async (req, res) => {
    const { kind, value } = body(req)
    const config = getConfig()

    switch (kind) {
      case 'bot-restart': {
        try {
          await restartBot()
          return res.json({ ok: true, message: `봇 재접속 완료 (${botStatus().tag})`, bot: botStatus() })
        } catch (err) {
          return res.json({ ok: false, message: `봇 재접속 실패: ${err.message}`, bot: botStatus() })
        }
      }

      case 'console': {
        const command = String(value || 'say [건축 공모전] 콘솔 연결 테스트').trim()
        try {
          await sendConsoleCommand(command)
          return res.json({ ok: true, message: `콘솔 채널로 전송했습니다: ${command}` })
        } catch (err) {
          return res.json({ ok: false, message: err.message })
        }
      }

      case 'vote-channel': {
        try {
          await sendToChannel(config.discord.voteChannelId, {
            content: `✅ ${contestTitle(config)} — 투표 알림 채널 연결 테스트`,
          })
          return res.json({ ok: true, message: '투표 채널로 테스트 메시지를 보냈습니다.' })
        } catch (err) {
          return res.json({ ok: false, message: err.message })
        }
      }

      case 'link': {
        if (!value) throw fail('테스트할 디스코드 ID를 입력해주세요.')
        return res.json(await probeLinkApi(String(value).trim()))
      }

      case 'teleport-preview': {
        const participant = getParticipant(String(value))
        if (!participant) throw fail('참가작을 찾을 수 없습니다.', 404)
        // 실제 값 대신 예시 플레이어로 치환해 결과 문자열만 보여줍니다.
        const command = buildTeleportCommand(participant, 'Player123', '00000000-0000-0000-0000-000000000000')
        return res.json({ ok: true, message: command })
      }

      default:
        throw fail('알 수 없는 테스트 종류입니다.')
    }
  }),
)

export default router
