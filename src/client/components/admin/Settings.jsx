import { useState } from 'react'
import s from './admin.module.css'
import { Actions, Area, Field, Num, Panel, Secret, Text, Toggle, useDraft } from './ui.jsx'

/** 저장 버튼 하나를 굴리는 공통 상태. */
function useSaver(save) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const run = async (patch) => {
    setSaving(true)
    setSaved(false)
    const ok = await save(patch)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2400)
    }
  }
  return { saving, saved, run }
}

function useTester(test) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (kind, value) => {
    setBusy(true)
    setResult(null)
    setResult(await test(kind, value))
    setBusy(false)
  }
  return { result, busy, run }
}

// ============================================================== 공모전

export function ContestPanel({ config, save }) {
  const [d, set] = useDraft(config.contest)
  const { saving, saved, run } = useSaver(save)

  const preview = String(d.titleTemplate || '')
    .replaceAll('{month}', String(d.month))
    .replaceAll('{year}', String(d.year))

  return (
    <Panel
      title="공모전"
      sub="매달 이 화면에서 월만 바꾸면 제목·부제가 함께 갱신됩니다."
      right={<span className="pill pill--accent">{preview || '제목 없음'}</span>}
    >
      <div className={s.rows}>
        <div className={s.row3}>
          <Num label="연도" value={d.year} onChange={(v) => set('year', v)} min={2000} max={2100} />
          <Num label="월" value={d.month} onChange={(v) => set('month', v)} min={1} max={12} />
          <Field label="강조 색상" hint="버튼·강조 요소에 쓰입니다.">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="color"
                value={d.accent || '#0071e3'}
                onChange={(e) => set('accent', e.target.value)}
                style={{ width: 46, height: 42, padding: 3, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent' }}
              />
              <input className="input input--mono" value={d.accent || ''} onChange={(e) => set('accent', e.target.value)} />
            </div>
          </Field>
        </div>

        <Text
          label="제목 형식"
          hint="{month} 와 {year} 를 쓸 수 있습니다."
          value={d.titleTemplate}
          onChange={(v) => set('titleTemplate', v)}
        />

        <Text label="서버 이름" hint="비워두면 표시하지 않습니다." value={d.serverName} onChange={(v) => set('serverName', v)} />

        <Area label="한 줄 소개" value={d.tagline} onChange={(v) => set('tagline', v)} rows={2} />

        <Area
          label="공지 배너"
          hint="히어로 아래 노란 배너로 표시됩니다. 비우면 숨겨집니다."
          value={d.heroNotice}
          onChange={(v) => set('heroNotice', v)}
          rows={2}
        />
      </div>

      <Actions onSave={() => run({ contest: d })} saving={saving} saved={saved} />

      <div className={s.panelHead} style={{ marginTop: 30, marginBottom: 18 }}>
        <div>
          <h2 className={s.panelTitle}>로고 · 배경</h2>
          <p className={s.panelSub}>
            배경은 비워두는 게 기본입니다. 서버 스크린샷을 넣으면 맨 위 히어로 뒤에만 깔리고, 나머지 화면은 그대로
            깔끔하게 유지됩니다.
          </p>
        </div>
        {d.logoUrl && (
          <img src={d.logoUrl} alt="" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        )}
      </div>

      <div className={s.rows}>
        <div className={s.row2}>
          <Text
            label="로고 이미지 주소"
            hint="public/ 에 파일을 넣고 /파일명 으로 적습니다. 이미지는 자르지 않고 원본 비율 그대로 높이에만 맞춥니다."
            value={d.logoUrl}
            onChange={(v) => set('logoUrl', v)}
            mono
            placeholder="/logo.png"
          />
          <Text
            label="히어로 배경 이미지 (선택)"
            hint="비우면 배경 없이 흰 바탕으로 나옵니다. 넣으면 아래 슬라이더로 블러와 어둡기를 맞추세요."
            value={d.backgroundUrl}
            onChange={(v) => set('backgroundUrl', v)}
            mono
            placeholder="비워두면 배경 없음"
          />
        </div>

        <div className={s.row2}>
          <Field label={`배경 블러 — ${d.backgroundBlur ?? 0}px`}>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={d.backgroundBlur ?? 0}
              onChange={(e) => set('backgroundBlur', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </Field>
          <Field label={`배경 어둡기 — ${Math.round((d.backgroundDim ?? 0) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={95}
              step={1}
              value={Math.round((d.backgroundDim ?? 0) * 100)}
              onChange={(e) => set('backgroundDim', Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </Field>
        </div>

        {d.backgroundUrl && (
          <Field label="미리보기" hint="저장한 뒤 사이트를 새로고침하면 실제로 반영됩니다.">
            <div
              style={{
                position: 'relative',
                height: 150,
                overflow: 'hidden',
                boxShadow: '0 0 0 2px var(--edge)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: -40,
                  backgroundImage: `url("${d.backgroundUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: `blur(${d.backgroundBlur ?? 0}px)`,
                }}
              />
              <div style={{ position: 'absolute', inset: 0, background: `rgba(14,14,22,${d.backgroundDim ?? 0})` }} />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 18,
                  lineHeight: 1.4,
                  color: '#fff',
                  textShadow: '0 3px 20px rgba(0,0,0,.5)',
                }}
              >
                {preview}
              </span>
            </div>
          </Field>
        )}
      </div>

      <Actions onSave={() => run({ contest: d })} saving={saving} saved={saved} />
    </Panel>
  )
}

// ============================================================== 디스코드

export function DiscordPanel({ config, save, test, bot }) {
  const [d, set] = useDraft(config.discord)
  const { saving, saved, run } = useSaver(save)
  const { result, busy, run: runTest } = useTester(test)
  const [command, setCommand] = useState('say [건축 공모전] 콘솔 연결 테스트')

  return (
    <>
      <Panel
        title="디스코드 로그인"
        sub="Discord Developer Portal → OAuth2 에서 발급받은 값입니다. 리디렉션 URL 은 포털의 Redirects 에도 똑같이 등록해야 합니다."
      >
        <div className={s.rows}>
          <div className={s.row2}>
            <Text label="Client ID" value={d.clientId} onChange={(v) => set('clientId', v)} mono />
            <Secret label="Client Secret" value={d.clientSecret} onChange={(v) => set('clientSecret', v)} />
          </div>
          <Text
            label="리디렉션 URL"
            hint="비워두면 접속한 주소 기준으로 자동 생성합니다. 예: http://localhost:3000/api/auth/callback"
            value={d.redirectUri}
            onChange={(v) => set('redirectUri', v)}
            mono
            placeholder="자동"
          />
          <div className={s.row2}>
            <Text
              label="서버(길드) ID"
              hint="입력하면 이 서버 멤버만 로그인할 수 있습니다. 비우면 제한 없음."
              value={d.guildId}
              onChange={(v) => set('guildId', v)}
              mono
            />
            <Text label="서버 초대 링크" value={d.guildInviteUrl} onChange={(v) => set('guildInviteUrl', v)} mono />
          </div>
        </div>
        <Actions onSave={() => run({ discord: d })} saving={saving} saved={saved} />
      </Panel>

      <Panel
        title="디스코드 봇"
        sub="텔레포트 명령은 DiscordSRV 콘솔 채널로, 투표 알림은 아래 지정한 채널로 전송됩니다. 봇은 두 채널 모두에 메시지 보내기 권한이 있어야 합니다."
        right={
          <span className={`pill ${bot?.ready ? 'pill--ok' : bot?.configured ? 'pill--danger' : ''}`}>
            {bot?.ready ? `연결됨 · ${bot.tag}` : bot?.configured ? `연결 안 됨${bot.error ? ` · ${bot.error}` : ''}` : '토큰 없음'}
          </span>
        }
      >
        <div className={s.rows}>
          <Secret label="봇 토큰" value={d.botToken} onChange={(v) => set('botToken', v)} />
          <div className={s.row2}>
            <Text
              label="콘솔 채널 ID (DiscordSRV)"
              hint="여기에 보낸 메시지가 서버 콘솔 명령으로 실행됩니다."
              value={d.consoleChannelId}
              onChange={(v) => set('consoleChannelId', v)}
              mono
            />
            <Text
              label="투표 알림 채널 ID"
              hint="비우면 알림을 보내지 않습니다."
              value={d.voteChannelId}
              onChange={(v) => set('voteChannelId', v)}
              mono
            />
          </div>
          <Text label="콘솔 테스트 명령어" value={command} onChange={setCommand} mono />
        </div>

        <Actions onSave={() => run({ discord: d })} saving={saving} saved={saved} result={result}>
          <button className="btn btn--outline btn--sm" onClick={() => runTest('bot-restart')} disabled={busy}>
            봇 재접속
          </button>
          <button className="btn btn--outline btn--sm" onClick={() => runTest('console', command)} disabled={busy}>
            콘솔 채널 테스트
          </button>
          <button className="btn btn--outline btn--sm" onClick={() => runTest('vote-channel')} disabled={busy}>
            알림 채널 테스트
          </button>
        </Actions>
      </Panel>
    </>
  )
}

// ============================================================== 연동 API

export function LinkPanel({ config, save, test }) {
  const [d, set] = useDraft(config.link)
  const { saving, saved, run } = useSaver(save)
  const { result, busy, run: runTest } = useTester(test)
  const [probeId, setProbeId] = useState('')

  return (
    <Panel
      title="마인크래프트 연동 확인"
      sub="로그인한 디스코드 ID를 이 API 로 보내 마인크래프트 UUID 를 가져옵니다. connect.js 기준으로 discordid → uuid 방향인 /api/connectcheck 가 기본값이며, x-admin-key 헤더로 인증합니다."
    >
      <div className={s.rows}>
        <Toggle
          label="연동 확인 사용"
          hint="끄면 누구나 투표할 수 있지만, 마인크래프트 계정을 알 수 없어 텔레포트는 동작하지 않습니다. API 점검 중일 때만 사용하세요."
          checked={d.enabled}
          onChange={(v) => set('enabled', v)}
        />
        <div className={s.row2}>
          <Text label="API 주소" value={d.baseUrl} onChange={(v) => set('baseUrl', v)} mono placeholder="http://100.77.77.90:3000" />
          <Text label="확인 경로" value={d.checkPath} onChange={(v) => set('checkPath', v)} mono placeholder="/api/connectcheck" />
        </div>
        <Secret label="x-admin-key" hint="connect.js 의 ADMIN_PASSWORD 와 같은 값." value={d.adminKey} onChange={(v) => set('adminKey', v)} />
        <div className={s.row2}>
          <Text
            label="미연동 안내 문구"
            value={d.guideText}
            onChange={(v) => set('guideText', v)}
            placeholder="먼저 마인크래프트 계정과 디스코드를 연동해주세요."
          />
          <Text label="연동 안내 링크" hint="비우면 '다시 확인' 버튼만 보입니다." value={d.guideUrl} onChange={(v) => set('guideUrl', v)} mono />
        </div>
        <Text
          label="테스트할 디스코드 ID"
          hint="실제 사용자 ID를 넣고 아래 버튼으로 API 응답을 확인해보세요."
          value={probeId}
          onChange={setProbeId}
          mono
        />
      </div>

      <Actions onSave={() => run({ link: d })} saving={saving} saved={saved} result={result}>
        <button className="btn btn--outline btn--sm" onClick={() => runTest('link', probeId)} disabled={busy || !probeId}>
          연결 테스트
        </button>
      </Actions>
    </Panel>
  )
}

// ============================================================== 텔레포트

export function TeleportPanel({ config, save }) {
  const [d, set] = useDraft(config.teleport)
  const { saving, saved, run } = useSaver(save)

  return (
    <Panel
      title="텔레포트"
      sub="참가자가 버튼을 누르면 이 명령어가 DiscordSRV 콘솔 채널로 전송됩니다. 참가작마다 개별 명령어를 덮어쓸 수도 있습니다."
    >
      <div className={s.rows}>
        <Text
          label="명령어 형식"
          hint="치환자: {player} {uuid} {x} {y} {z} {yaw} {pitch} {world} · 예) cmi tppos {x} {y} {z} {yaw} {pitch} {world} -t:{player}"
          value={d.commandTemplate}
          onChange={(v) => set('commandTemplate', v)}
          mono
        />
        <div className={s.row2}>
          <Num label="쿨다운 (초)" value={d.cooldownSeconds} onChange={(v) => set('cooldownSeconds', v)} min={0} max={120} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Toggle
              label="모두 둘러봐야 투표 가능"
              hint="끄면 텔레포트 없이도 바로 투표할 수 있습니다."
              checked={d.requireAllBeforeVote}
              onChange={(v) => set('requireAllBeforeVote', v)}
            />
          </div>
        </div>
      </div>
      <Actions onSave={() => run({ teleport: d })} saving={saving} saved={saved} />
    </Panel>
  )
}

// ================================================================= 투표

export function VotePanel({ config, save }) {
  const [d, set] = useDraft(config.vote)
  const { saving, saved, run } = useSaver(save)

  return (
    <Panel
      title="투표"
      sub="시작·종료 시각은 이 서버의 시간대를 기준으로 판단합니다. 둘 다 비워두면 투표가 열리지 않습니다."
    >
      <div className={s.rows}>
        <div className={s.row3}>
          <Num label="1인당 투표 수" value={d.maxVotes} onChange={(v) => set('maxVotes', v)} min={1} max={10} />
          <Field label="투표 시작">
            <input className="input" type="datetime-local" value={d.startAt || ''} onChange={(e) => set('startAt', e.target.value)} />
          </Field>
          <Field label="투표 종료">
            <input className="input" type="datetime-local" value={d.endAt || ''} onChange={(e) => set('endAt', e.target.value)} />
          </Field>
        </div>

        <Toggle
          label="기간 무시하고 지금 열기"
          hint="급하게 열거나 연장할 때 사용합니다. 켜져 있으면 시작·종료 시각을 무시합니다."
          checked={d.manualOpen}
          onChange={(v) => set('manualOpen', v)}
        />
        <Toggle label="본인 작품에도 투표 허용" checked={d.allowSelfVote} onChange={(v) => set('allowSelfVote', v)} />
        <Toggle
          label="제출 후 수정 허용"
          hint="끄면 한 번 제출하면 바꿀 수 없습니다."
          checked={d.allowRevote}
          onChange={(v) => set('allowRevote', v)}
        />
        <Toggle
          label="득표 현황 공개"
          hint="켜면 공모전 페이지 하단에 실시간 득표가 표시됩니다."
          checked={d.showResultsPublicly}
          onChange={(v) => set('showResultsPublicly', v)}
        />
      </div>
      <Actions onSave={() => run({ vote: d })} saving={saving} saved={saved} />
    </Panel>
  )
}

// =============================================================== 비밀번호

export function SecurityPanel({ save }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)
  const { saving, saved, run } = useSaver(save)

  async function submit() {
    setError(null)
    if (pw.length < 8) return setError('8자 이상으로 설정해주세요.')
    if (pw !== pw2) return setError('두 비밀번호가 일치하지 않습니다.')
    await run({ newAdminPassword: pw })
    setPw('')
    setPw2('')
  }

  return (
    <Panel title="관리자 비밀번호" sub="이 패널에 접근하는 비밀번호를 바꿉니다.">
      <div className={s.rows}>
        <div className={s.row2}>
          <Secret label="새 비밀번호" value={pw} onChange={setPw} />
          <Secret label="새 비밀번호 확인" value={pw2} onChange={setPw2} />
        </div>
      </div>
      <Actions onSave={submit} saving={saving} saved={saved} result={error ? { ok: false, message: error } : null} />
    </Panel>
  )
}
