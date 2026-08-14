'use client'

import s from './admin.module.css'
import { Panel } from './ui.js'

function Stat({ label, value, note }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {note && <div className={s.statNote}>{note}</div>}
    </div>
  )
}

function Row({ state, name, detail }) {
  const cls = state === 'ok' ? s.dotOk : state === 'warn' ? s.dotWarn : s.dotBad
  return (
    <div className={s.healthRow}>
      <span className={`${s.dot} ${cls}`} />
      <span className={s.healthName}>{name}</span>
      <span className={s.healthDetail}>{detail}</span>
    </div>
  )
}

function windowLabel(voting) {
  if (!voting) return { state: 'bad', detail: '알 수 없음' }
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '미정')
  switch (voting.reason) {
    case 'manual':
      return { state: 'warn', detail: '강제 개방 중 (기간 무시)' }
    case 'scheduled':
      return { state: 'ok', detail: `진행 중 · ${fmt(voting.endAt)} 마감` }
    case 'before':
      return { state: 'warn', detail: `${fmt(voting.startAt)} 시작 예정` }
    case 'after':
      return { state: 'warn', detail: `${fmt(voting.endAt)} 마감됨` }
    default:
      return { state: 'bad', detail: '기간 미설정 — 투표가 열리지 않습니다' }
  }
}

export default function Dashboard({ config, bot, participants, votes, onGo }) {
  const summary = votes?.summary
  const visible = participants.filter((p) => !p.hidden)
  const noImages = participants.filter((p) => p.images.length === 0)
  const win = windowLabel(votes?.voting)

  const discordReady = Boolean(config.discord.clientId && config.discord.clientSecret)
  const top = summary?.rows?.filter((r) => !r.hidden).slice(0, 3) ?? []

  return (
    <>
      <Panel title="한눈에 보기" sub={`${config.title} · 데이터는 data/ 폴더에 저장됩니다.`}>
        <div className={s.stats}>
          <Stat label="참가작" value={visible.length} note={participants.length !== visible.length ? `숨김 ${participants.length - visible.length}개 포함 ${participants.length}개` : null} />
          <Stat label="투표한 사람" value={summary?.voterCount ?? 0} note={`총 ${summary?.totalPicks ?? 0}표`} />
          <Stat label="1인당 표" value={config.vote.maxVotes} />
          <Stat label="이번 회차" value={`${config.contest.month}월`} note={`${config.contest.year}년`} />
        </div>
      </Panel>

      <Panel
        title="상태 점검"
        sub="빨간 항목이 남아 있으면 참가자가 끝까지 진행하지 못합니다."
        right={
          <a className="btn btn--outline btn--sm" href="/" target="_blank" rel="noreferrer">
            공모전 페이지 열기 ↗
          </a>
        }
      >
        <div className={s.health}>
          <Row
            state={discordReady ? 'ok' : 'bad'}
            name="디스코드 로그인"
            detail={discordReady ? `Client ID ${config.discord.clientId.slice(0, 8)}…` : 'Client ID / Secret 이 비어 있습니다'}
          />
          <Row
            state={bot?.ready ? 'ok' : bot?.configured ? 'bad' : 'warn'}
            name="디스코드 봇"
            detail={bot?.ready ? `연결됨 · ${bot.tag}` : bot?.configured ? bot.error || '연결 안 됨' : '봇 토큰 없음 — 텔레포트 불가'}
          />
          <Row
            state={config.discord.consoleChannelId ? 'ok' : 'bad'}
            name="콘솔 채널 (텔레포트)"
            detail={config.discord.consoleChannelId || '설정되지 않음'}
          />
          <Row
            state={config.discord.voteChannelId ? 'ok' : 'warn'}
            name="투표 알림 채널"
            detail={config.discord.voteChannelId || '설정하지 않음 (알림 생략)'}
          />
          <Row
            state={!config.link.enabled ? 'warn' : config.link.baseUrl && config.link.adminKey ? 'ok' : 'bad'}
            name="계정 연동 API"
            detail={
              !config.link.enabled
                ? '검사 꺼짐 — 누구나 참여 가능'
                : `${config.link.baseUrl}${config.link.checkPath}${config.link.adminKey ? '' : ' · 관리자 키 없음'}`
            }
          />
          <Row state={visible.length > 0 ? 'ok' : 'bad'} name="참가작" detail={visible.length > 0 ? `${visible.length}개 공개` : '등록된 참가작 없음'} />
          <Row
            state={noImages.length === 0 ? 'ok' : 'warn'}
            name="사진"
            detail={noImages.length === 0 ? '모든 참가작에 사진 있음' : `사진 없는 참가작 ${noImages.length}개`}
          />
          <Row state={win.state} name="투표 기간" detail={win.detail} />
        </div>
      </Panel>

      {top.length > 0 && (
        <Panel
          title="현재 상위 3작품"
          right={
            <button className="btn btn--outline btn--sm" onClick={() => onGo('votes')}>
              전체 보기
            </button>
          }
        >
          <div className={s.stats}>
            {top.map((row, i) => (
              <Stat key={row.id} label={`${i + 1}위`} value={`${row.count}표`} note={row.title} />
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
