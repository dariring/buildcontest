'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import s from '@/components/contest/contest.module.css'
import ParticipantRow from '@/components/contest/ParticipantRow.js'
import { ArrowDown, Check, Discord, Link as LinkIcon, Vote } from '@/components/contest/icons.js'

const LOGIN_ERRORS = {
  discord_not_configured: '디스코드 로그인이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.',
  discord_denied: '디스코드 로그인을 취소했습니다.',
  bad_state: '로그인 세션이 만료되었습니다. 다시 시도해주세요.',
  missing_code: '로그인에 실패했습니다. 다시 시도해주세요.',
  not_in_guild: '먼저 디스코드 서버에 참여해주세요.',
  oauth_failed: '디스코드 인증에 실패했습니다. 잠시 후 다시 시도해주세요.',
}

function useCountdown(iso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [iso])

  if (!iso) return null
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const sec = Math.floor((diff % 60000) / 1000)
  if (d > 0) return `${d}일 ${h}시간`
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분 ${sec}초`
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Home() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [picks, setPicks] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)

  const flash = useCallback((message, kind = 'info') => {
    setToast({ message, kind })
    setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 4200)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/state', { cache: 'no-store' })
    const data = await res.json()
    setState(data)
    setPicks((prev) => (prev.length ? prev : (data.myVote?.picks ?? [])))
    setLoading(false)
    return data
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 로그인 콜백이 붙여준 오류 코드를 한 번만 보여주고 주소에서 지웁니다.
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error')
    if (!error) return
    flash(LOGIN_ERRORS[error] ?? '알 수 없는 오류가 발생했습니다.', 'error')
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [flash])

  const config = state?.config
  const participants = state?.participants ?? []
  const visited = useMemo(() => new Set(state?.progress?.visited ?? []), [state])
  const maxVotes = config?.vote?.maxVotes ?? 3

  const loggedIn = Boolean(state?.user)
  const linked = Boolean(state?.link?.linked)
  const unlocked = Boolean(state?.progress?.unlocked)
  const votingOpen = Boolean(state?.voting?.open)
  const submitted = Boolean(state?.myVote)
  const showBallot = (!submitted || editing) && unlocked && votingOpen && linked

  const countdown = useCountdown(votingOpen ? state?.voting?.endAt : state?.voting?.startAt)

  // ------------------------------------------------------------- actions

  const teleport = useCallback(
    async (participantId) => {
      const res = await fetch('/api/teleport', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ participantId }),
      })
      const data = await res.json()
      if (!res.ok) return data.error ?? '텔레포트에 실패했습니다.'

      const wasLocked = !state?.progress?.unlocked
      const next = await load()
      if (wasLocked && next.progress.unlocked) flash('전부 둘러봤어요. 이제 투표할 수 있습니다 ✨')
      else flash('게임 안에서 이동했어요.')
      return null
    },
    [flash, load, state],
  )

  function togglePick(id) {
    setPicks((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id)
      if (current.length >= maxVotes) return current
      return [...current, id]
    })
  }

  async function submitVote() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ picks }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash(data.error ?? '투표에 실패했습니다.', 'error')
        return
      }
      setEditing(false)
      await load()
      flash(data.notified === false ? '투표는 접수됐지만 알림 전송에 실패했습니다.' : '투표가 제출되었습니다. 감사합니다 🧱')
    } finally {
      setSubmitting(false)
    }
  }

  // --------------------------------------------------------------- render

  if (loading) {
    return (
      <main>
        <div className="shell" style={{ paddingTop: 150, display: 'grid', gap: 18, placeItems: 'center' }}>
          <div className={s.skeleton} style={{ height: 52, width: 'min(440px, 84%)' }} />
          <div className={s.skeleton} style={{ height: 22, width: 'min(300px, 62%)' }} />
        </div>
      </main>
    )
  }

  const total = participants.length
  const visitedCount = participants.filter((p) => visited.has(p.id)).length

  const steps = [
    {
      key: 'login',
      icon: <Discord size={13} />,
      title: '디스코드로 로그인',
      desc: loggedIn ? `${state.user.displayName} 님으로 로그인됨` : '참여하려면 먼저 로그인해주세요.',
      done: loggedIn,
      action: !loggedIn && (
        <a className="btn btn--primary btn--sm" href="/api/auth/login">
          로그인
        </a>
      ),
    },
    {
      key: 'link',
      icon: <LinkIcon size={13} />,
      title: '마인크래프트 계정 연동',
      desc: !loggedIn
        ? '로그인 후 자동으로 확인합니다.'
        : state.link?.error
          ? state.link.error
          : !linked
            ? config.link.guideText || '먼저 계정을 연동한 뒤 참여해주세요.'
            : state.link.mcName || state.link.uuid
              ? `${state.link.mcName ?? state.link.uuid} 로 연동되어 있습니다.`
              : '연동 확인을 건너뛰는 중입니다.',
      done: loggedIn && linked,
      action:
        loggedIn && !linked && config.link.guideUrl ? (
          <a className="btn btn--outline btn--sm" href={config.link.guideUrl} target="_blank" rel="noreferrer">
            연동하러 가기
          </a>
        ) : loggedIn && !linked ? (
          <button className="btn btn--outline btn--sm" onClick={() => load()}>
            다시 확인
          </button>
        ) : null,
    },
    {
      key: 'tour',
      icon: <ArrowDown size={13} />,
      title: '모든 참가작 둘러보기',
      desc: config.teleport.requireAllBeforeVote
        ? `텔레포트로 ${total}개 작품을 모두 방문하면 투표가 열려요. (${visitedCount}/${total})`
        : '텔레포트로 자유롭게 둘러보세요.',
      done: loggedIn && linked && unlocked,
      slots: config.teleport.requireAllBeforeVote && total > 0 ? { done: visitedCount, total } : null,
    },
    {
      key: 'vote',
      icon: <Vote size={13} />,
      title: `마음에 드는 ${maxVotes}작품에 투표`,
      desc: submitted
        ? '투표를 완료했습니다. 감사합니다!'
        : !votingOpen
          ? state.voting.reason === 'before'
            ? `${formatDate(state.voting.startAt)}에 투표가 시작됩니다.`
            : state.voting.reason === 'after'
              ? '투표가 마감되었습니다.'
              : '투표 기간이 아직 공지되지 않았습니다.'
          : state.voting.endAt
            ? `${formatDate(state.voting.endAt)}까지 투표할 수 있습니다.`
            : '지금 투표할 수 있습니다.',
      done: submitted,
    },
  ]

  const activeIndex = steps.findIndex((step) => !step.done)

  const teleportBlockReason = !loggedIn
    ? '먼저 디스코드로 로그인해주세요.'
    : !linked
      ? '마인크래프트 계정 연동이 필요합니다.'
      : null

  const results = state.results
  const heroBg = config.contest.backgroundUrl?.trim() || null

  return (
    <>
      {toast && <div className={`${s.toast} ${toast.kind === 'error' ? s.toastError : ''}`}>{toast.message}</div>}

      <nav className={s.nav}>
        <div className={`shell ${s.navInner}`}>
          <a className={s.navBrand} href="#top">
            {config.contest.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className={s.navLogo} src={config.contest.logoUrl} alt="" />
            )}
            <span className={s.navBrandLabel}>{config.contest.serverName || config.title}</span>
          </a>
          <div className={s.navRight}>
            {loggedIn ? (
              <>
                <span className={s.userChip}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.user.avatar} alt="" />
                  <span className={s.userChipName}>{state.link?.mcName || state.user.displayName}</span>
                </span>
                <a className="btn btn--ghost btn--sm" href="/api/auth/logout">
                  로그아웃
                </a>
              </>
            ) : (
              <a className="btn btn--primary btn--sm" href="/api/auth/login">
                <Discord size={14} /> 디스코드 로그인
              </a>
            )}
          </div>
        </div>
      </nav>

      <main id="top">
        {/* ------------------------------------------------------- hero */}
        <header className={`${s.hero} ${heroBg ? s.heroOnImage : ''}`}>
          {heroBg && (
            <>
              <div
                className={s.heroBg}
                style={{
                  backgroundImage: `url("${heroBg}")`,
                  filter: `blur(${Math.max(0, Number(config.contest.backgroundBlur) || 0)}px)`,
                }}
              />
              <div
                className={s.heroScrim}
                style={{
                  background: `rgba(14, 14, 22, ${Math.min(0.95, Math.max(0, Number(config.contest.backgroundDim) || 0))})`,
                }}
              />
            </>
          )}
          <div className={`shell ${s.heroInner}`}>
            <span className={`${s.eyebrow} rise`}>
              <span className={s.brick}>🧱</span>
              {config.contest.serverName ? `${config.contest.serverName} · ` : ''}
              {config.contest.year}년 {config.contest.month}월
            </span>

            <h1 className={`${s.heroTitle} rise`} style={{ animationDelay: '60ms' }}>
              {config.title}
            </h1>

            {config.contest.tagline && (
              <p className={`${s.heroTagline} rise`} style={{ animationDelay: '120ms' }}>
                {config.contest.tagline}
              </p>
            )}

            {config.contest.heroNotice && <div className={s.heroNotice}>{config.contest.heroNotice}</div>}

            <div className={`${s.heroActions} rise`} style={{ animationDelay: '180ms' }}>
              {!loggedIn ? (
                <a className="btn btn--primary btn--lg" href="/api/auth/login">
                  <Discord /> 디스코드로 시작하기
                </a>
              ) : (
                <a className="btn btn--primary btn--lg" href="#participants">
                  참가작 보러 가기 <ArrowDown />
                </a>
              )}
              {countdown && (
                <span className="pill pill--accent" style={{ padding: '9px 16px', fontSize: 13.5 }}>
                  {votingOpen ? '투표 마감까지' : '투표 시작까지'} {countdown}
                </span>
              )}
            </div>

            <div className={`${s.status} rise`} style={{ animationDelay: '240ms' }}>
              <div className={s.steps}>
                {steps.map((step, i) => (
                  <div className={s.step} key={step.key}>
                    <span
                      className={`${s.stepMark} ${step.done ? s.stepMarkDone : i === activeIndex ? s.stepMarkActive : ''}`}
                    >
                      {step.done ? <Check size={14} /> : step.icon}
                    </span>
                    <div className={s.stepBody}>
                      <div className={s.stepTitle}>{step.title}</div>
                      <div className={s.stepDesc}>{step.desc}</div>
                      {step.slots && (
                        <div className={s.slots} aria-label={`${step.slots.done} / ${step.slots.total} 방문`}>
                          {Array.from({ length: step.slots.total }).map((_, n) => (
                            <span key={n} className={`${s.slot} ${n < step.slots.done ? s.slotOn : ''}`} />
                          ))}
                        </div>
                      )}
                    </div>
                    {step.action && <div className={s.stepAction}>{step.action}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------ participants */}
        <section className={s.section} id="participants">
          <div className="shell">
            <div className={s.sectionHead}>
              <div>
                <h2 className={s.sectionTitle}>참가작</h2>
                <p className={s.sectionSub}>
                  {total}개의 건축물
                  {loggedIn && linked && config.teleport.requireAllBeforeVote && ` · ${visitedCount}개 방문함`}
                </p>
              </div>
              {submitted && !editing && (
                <span className="pill pill--ok">
                  <Check size={13} /> 투표 완료
                </span>
              )}
            </div>

            {total === 0 ? (
              <div className={s.empty}>
                <span className={s.emptyEmoji}>🏗️</span>
                아직 등록된 참가작이 없어요. 곧 채워집니다.
              </div>
            ) : (
              <ul className={s.list}>
                {participants.map((p, i) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    index={i}
                    visited={visited.has(p.id)}
                    canTeleport={loggedIn && linked}
                    teleportDisabledReason={teleportBlockReason}
                    selectable={showBallot}
                    selected={picks.includes(p.id)}
                    selectDisabled={picks.length >= maxVotes}
                    onTeleport={teleport}
                    onToggleSelect={togglePick}
                  />
                ))}
              </ul>
            )}

            {results && total > 0 && (
              <div className={s.results}>
                <h3 className={s.resultsTitle}>현재 득표</h3>
                {results.rows
                  .filter((row) => !row.hidden)
                  .map((row) => {
                    const max = Math.max(1, ...results.rows.map((r) => r.count))
                    return (
                      <div className={s.resultRow} key={row.id}>
                        <span className={s.resultName}>{row.title}</span>
                        <span className={s.resultBar}>
                          <span className={s.resultBarFill} style={{ width: `${(row.count / max) * 100}%` }} />
                        </span>
                        <span className={s.resultCount}>{row.count}표</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </section>

        <footer className={s.footer}>
          <div className={`shell ${s.footerInner}`}>
            <span>
              {config.title}
              {config.contest.serverName ? ` · ${config.contest.serverName}` : ''}
            </span>
            <a href="/admin" style={{ color: 'inherit' }}>
              관리자
            </a>
          </div>
        </footer>
      </main>

      {/* ---------------------------------------------------------- dock */}
      {showBallot && total > 0 && (
        <div className={s.dock}>
          <div className={s.dockText}>
            <div className={s.dockTitle}>
              <span className={s.dockCount}>
                {Array.from({ length: maxVotes }).map((_, i) => (
                  <span key={i} className={`${s.dockPip} ${i < picks.length ? s.dockPipOn : ''}`} />
                ))}
              </span>
              {picks.length} / {maxVotes} 선택
            </div>
            <div className={s.dockSub}>
              {picks.length === 0
                ? '목록 오른쪽 끝의 체크 칸을 눌러 선택하세요.'
                : picks.map((id) => participants.find((p) => p.id === id)?.title).join(' · ')}
            </div>
          </div>
          {editing && (
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
              취소
            </button>
          )}
          <button className="btn btn--primary" onClick={submitVote} disabled={picks.length === 0 || submitting}>
            {submitting ? <span className="spin" /> : <Vote size={15} />}
            제출하기
          </button>
        </div>
      )}

      {submitted && !editing && votingOpen && config.vote.allowRevote && (
        <div className={s.dock}>
          <div className={s.dockText}>
            <div className={s.dockTitle}>
              <Check size={16} /> 투표 완료
            </div>
            <div className={s.dockSub}>
              {state.myVote.picks.map((id) => participants.find((p) => p.id === id)?.title ?? '(삭제됨)').join(' · ')}
            </div>
          </div>
          <button
            className="btn btn--outline btn--sm"
            onClick={() => {
              setPicks(state.myVote.picks)
              setEditing(true)
            }}
          >
            수정하기
          </button>
        </div>
      )}
    </>
  )
}
