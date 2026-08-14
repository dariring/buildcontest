// 어드민 패널의 "테스트" 버튼들이 쓰는 진단 엔드포인트.
import { requireAdmin, guarded, json, fail, body } from '@/lib/http.js'
import { getConfig, contestTitle } from '@/lib/config.js'
import { botStatus, restartBot, sendConsoleCommand, sendToChannel } from '@/lib/bot.js'
import { probeLinkApi } from '@/lib/link.js'
import { buildTeleportCommand, getParticipant } from '@/lib/contest.js'

export const dynamic = 'force-dynamic'

export const POST = guarded(async (req) => {
  await requireAdmin()
  const { kind, value } = await body(req)
  const config = getConfig()

  switch (kind) {
    case 'bot-restart': {
      try {
        await restartBot()
        return json({ ok: true, message: `봇 재접속 완료 (${botStatus().tag})`, bot: botStatus() })
      } catch (err) {
        return json({ ok: false, message: `봇 재접속 실패: ${err.message}`, bot: botStatus() })
      }
    }

    case 'console': {
      const command = String(value || 'say [건축 공모전] 콘솔 연결 테스트').trim()
      try {
        await sendConsoleCommand(command)
        return json({ ok: true, message: `콘솔 채널로 전송했습니다: ${command}` })
      } catch (err) {
        return json({ ok: false, message: err.message })
      }
    }

    case 'vote-channel': {
      try {
        await sendToChannel(config.discord.voteChannelId, {
          content: `✅ ${contestTitle(config)} — 투표 알림 채널 연결 테스트`,
        })
        return json({ ok: true, message: '투표 채널로 테스트 메시지를 보냈습니다.' })
      } catch (err) {
        return json({ ok: false, message: err.message })
      }
    }

    case 'link': {
      if (!value) return fail('테스트할 디스코드 ID를 입력해주세요.')
      const result = await probeLinkApi(String(value).trim())
      return json(result)
    }

    case 'teleport-preview': {
      const participant = getParticipant(String(value))
      if (!participant) return fail('참가작을 찾을 수 없습니다.', 404)
      // 실제 값 대신 예시 플레이어로 치환해 결과 문자열만 보여줍니다.
      const command = buildTeleportCommand(participant, 'Player123', '00000000-0000-0000-0000-000000000000')
      return json({ ok: true, message: command })
    }

    default:
      return fail('알 수 없는 테스트 종류입니다.')
  }
})
