import { useCallback, useEffect, useState } from 'react'
import s from '@/components/admin/admin.module.css'
import Dashboard from '@/components/admin/Dashboard.jsx'
import Participants from '@/components/admin/Participants.jsx'
import Votes from '@/components/admin/Votes.jsx'
import Reset from '@/components/admin/Reset.jsx'
import { ContestPanel, DiscordPanel, LinkPanel, SecurityPanel, TeleportPanel, VotePanel } from '@/components/admin/Settings.jsx'

const TABS = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'participants', label: '참가작' },
  { id: 'contest', label: '공모전' },
  { id: 'discord', label: '디스코드' },
  { id: 'link', label: '계정 연동' },
  { id: 'teleport', label: '텔레포트' },
  { id: 'voteSettings', label: '투표 설정' },
  { id: 'votes', label: '투표 현황' },
  { id: 'reset', label: '초기화' },
  { id: 'security', label: '보안' },
]

async function call(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

// ==================================================================== gate

function Gate({ setupComplete, onIn, logoUrl }) {
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const firstRun = !setupComplete

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (firstRun && password !== confirmPw) return setError('두 비밀번호가 일치하지 않습니다.')
    setBusy(true)
    const res = await call('/api/admin/login', { method: 'POST', body: { password } })
    setBusy(false)
    if (res.ok) onIn()
    else setError(res.error ?? '로그인에 실패했습니다.')
  }

  return (
    <div className={s.gate}>
      <form className={s.gateCard} onSubmit={submit}>
        <img className={s.gateLogo} src={logoUrl || '/logo.png'} alt="" />
        <h1 className={s.gateTitle}>{firstRun ? '처음 오셨네요' : '관리자'}</h1>
        <p className={s.gateSub}>
          {firstRun
            ? '사용할 관리자 비밀번호를 정해주세요. 이후 모든 설정은 이 패널에서 하시면 됩니다.'
            : '관리자 비밀번호를 입력해주세요.'}
        </p>

        <div className={s.gateForm}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={firstRun ? '새 비밀번호 (8자 이상)' : '비밀번호'}
            autoFocus
            autoComplete={firstRun ? 'new-password' : 'current-password'}
          />
          {firstRun && (
            <input
              className="input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
            />
          )}
          {error && <span className="field-hint" style={{ color: '#d70015' }}>{error}</span>}
          <button className="btn btn--primary btn--block" type="submit" disabled={busy || !password}>
            {busy && <span className="spin" />} {firstRun ? '시작하기' : '로그인'}
          </button>
        </div>
      </form>
    </div>
  )
}

// =================================================================== admin

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const [bot, setBot] = useState(null)
  const [participants, setParticipants] = useState([])
  const [votes, setVotes] = useState(null)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, ok = true) => {
    setToast({ message, ok })
    setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 4000)
  }, [])

  const api = useCallback(call, [])

  const refresh = useCallback(async () => {
    const [cfg, plist, vlist] = await Promise.all([
      call('/api/admin/config'),
      call('/api/admin/participants'),
      call('/api/admin/votes'),
    ])
    if (cfg.status === 401) {
      setSession({ authenticated: false, setupComplete: true })
      return
    }
    if (cfg.ok !== false && cfg.config) {
      setConfig(cfg.config)
      setBot(cfg.bot)
    }
    if (plist.participants) setParticipants(plist.participants)
    if (vlist.votes) setVotes(vlist)
  }, [])

  useEffect(() => {
    call('/api/admin/session').then(setSession)
  }, [])

  useEffect(() => {
    if (session?.authenticated) refresh()
  }, [session, refresh])

  // 봇 상태는 조금씩 변하니 대시보드에 있을 때만 가볍게 갱신합니다.
  useEffect(() => {
    if (!session?.authenticated || tab !== 'dashboard') return
    const id = setInterval(() => {
      call('/api/admin/config').then((res) => res.bot && setBot(res.bot))
    }, 10000)
    return () => clearInterval(id)
  }, [session, tab])

  const save = useCallback(
    async (patch) => {
      const res = await call('/api/admin/config', { method: 'PATCH', body: patch })
      if (res.ok && res.config) {
        setConfig(res.config)
        setBot(res.bot)
        return true
      }
      notify(res.error ?? '저장에 실패했습니다.', false)
      return false
    },
    [notify],
  )

  const test = useCallback(async (kind, value) => {
    const res = await call('/api/admin/test', { method: 'POST', body: { kind, value } })
    if (res.bot) setBot(res.bot)
    return { ok: res.ok, message: res.message ?? res.error ?? '' }
  }, [])

  async function logout() {
    await call('/api/admin/login', { method: 'DELETE' })
    setSession({ authenticated: false, setupComplete: true })
    setConfig(null)
  }

  if (!session) {
    return (
      <div className={s.gate}>
        <span className="spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  if (!session.authenticated) {
    return (
      <Gate
        setupComplete={session.setupComplete}
        logoUrl={config?.contest?.logoUrl}
        onIn={() => setSession({ authenticated: true, setupComplete: true })}
      />
    )
  }

  if (!config) {
    return (
      <div className={s.gate}>
        <span className="spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  return (
    <div className={s.page} style={{ '--accent': config.contest.accent || '#0071e3' }}>
      <div className={s.top}>
        <div className={`shell ${s.topInner}`}>
          <span className={s.topTitle}>
            <img className={s.topLogo} src={config.contest.logoUrl || '/logo.png'} alt="" />
            <span className={s.topName}>{config.title}</span>
            <span className="pill">관리자</span>
          </span>
          <div className={s.topRight}>
            <a className="btn btn--ghost btn--sm" href="/" target="_blank" rel="noreferrer">
              사이트 보기 ↗
            </a>
            <button className="btn btn--outline btn--sm" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
        <div className="shell">
          <div className={s.tabs}>
            {TABS.map((t) => (
              <button key={t.id} className={`${s.tab} ${tab === t.id ? s.tabOn : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className={s.main}>
        <div className="shell">
          {tab === 'dashboard' && <Dashboard config={config} bot={bot} participants={participants} votes={votes} onGo={setTab} />}
          {tab === 'participants' && <Participants participants={participants} api={api} toast={notify} refresh={refresh} />}
          {tab === 'contest' && <ContestPanel config={config} save={save} />}
          {tab === 'discord' && <DiscordPanel config={config} save={save} test={test} bot={bot} />}
          {tab === 'link' && <LinkPanel config={config} save={save} test={test} />}
          {tab === 'teleport' && <TeleportPanel config={config} save={save} />}
          {tab === 'voteSettings' && <VotePanel config={config} save={save} />}
          {tab === 'votes' && <Votes votes={votes} api={api} toast={notify} refresh={refresh} />}
          {tab === 'reset' && <Reset config={config} api={api} toast={notify} refresh={refresh} />}
          {tab === 'security' && <SecurityPanel save={save} />}
        </div>
      </main>

      {toast && <div className={`${s.toast} ${toast.ok ? '' : s.toastBad}`}>{toast.message}</div>}
    </div>
  )
}
