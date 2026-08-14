'use client'

import { useEffect, useState } from 'react'
import s from './admin.module.css'
import { Panel, Toggle } from './ui.js'

const DEFAULTS = {
  archive: true,
  clearVotes: true,
  clearProgress: true,
  clearParticipants: false,
  advanceMonth: true,
  clearSchedule: true,
}

export default function Reset({ config, api, toast, refresh }) {
  const [opts, setOpts] = useState(DEFAULTS)
  const [archives, setArchives] = useState([])
  const [busy, setBusy] = useState(false)

  const set = (key, value) => setOpts((o) => ({ ...o, [key]: value }))

  useEffect(() => {
    api('/api/admin/reset').then((res) => res.archives && setArchives(res.archives))
  }, [api])

  const nextMonth = config.contest.month === 12 ? 1 : config.contest.month + 1

  async function run() {
    const lines = [
      opts.clearVotes && '• 모든 투표 기록',
      opts.clearProgress && '• 모든 참가자의 텔레포트 진행 상황',
      opts.clearParticipants && '• 등록된 참가작 전체',
    ].filter(Boolean)

    const message = [
      '아래 항목을 삭제합니다.',
      ...lines,
      '',
      opts.archive ? '삭제 전 현재 결과는 보관함에 저장됩니다.' : '⚠️ 보관하지 않으므로 되돌릴 수 없습니다.',
      opts.advanceMonth ? `공모전은 ${nextMonth}월로 넘어갑니다.` : '',
      '',
      '계속할까요?',
    ]
      .filter((line) => line !== undefined)
      .join('\n')

    if (!confirm(message)) return

    setBusy(true)
    const res = await api('/api/admin/reset', { method: 'POST', body: opts })
    setBusy(false)
    if (res.ok) {
      setArchives(res.archives ?? [])
      toast(`초기화 완료 — 이제 ${res.contest.month}월 공모전입니다.`)
      refresh()
    } else toast(res.error, false)
  }

  return (
    <>
      <Panel
        title="다음 회차 준비"
        sub="이번 달 결과를 보관하고, 다음 달 공모전을 위해 데이터를 비웁니다."
        danger
      >
        <div className={s.dangerNote}>
          설정(디스코드 토큰, 연동 API, 명령어 형식 등)은 그대로 남습니다. 아래에서 고른 항목만 지워집니다.
        </div>

        <div className={s.rows} style={{ marginTop: 18, gap: 13 }}>
          <Toggle label="초기화 전에 현재 결과 보관" hint="참가작과 득표를 스냅샷으로 남깁니다. (최근 24개 유지)" checked={opts.archive} onChange={(v) => set('archive', v)} />
          <Toggle label="투표 기록 삭제" checked={opts.clearVotes} onChange={(v) => set('clearVotes', v)} />
          <Toggle label="텔레포트 진행 상황 삭제" hint="다음 회차에 다시 전부 둘러보도록 합니다." checked={opts.clearProgress} onChange={(v) => set('clearProgress', v)} />
          <Toggle label="참가작 전체 삭제" hint="새 참가작을 처음부터 등록할 때 켜세요." checked={opts.clearParticipants} onChange={(v) => set('clearParticipants', v)} />
          <Toggle label={`다음 달로 넘기기 (${config.contest.month}월 → ${nextMonth}월)`} checked={opts.advanceMonth} onChange={(v) => set('advanceMonth', v)} />
          <Toggle label="투표 기간 설정 비우기" hint="새 기간을 다시 정할 수 있도록 시작·종료 시각과 강제 개방을 초기화합니다." checked={opts.clearSchedule} onChange={(v) => set('clearSchedule', v)} />
        </div>

        <div className={s.actions}>
          <button className="btn btn--danger" onClick={run} disabled={busy}>
            {busy && <span className="spin" />} 초기화 실행
          </button>
        </div>
      </Panel>

      <Panel title="보관함" sub="초기화할 때 남긴 지난 회차 스냅샷입니다.">
        {archives.length === 0 ? (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            아직 보관된 회차가 없습니다.
          </p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>회차</th>
                  <th>참가작</th>
                  <th>참여자</th>
                  <th>1위</th>
                  <th>보관 시각</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((a) => {
                  const top = a.tally?.rows?.[0]
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>
                        {a.year}년 {a.month}월
                      </td>
                      <td>{a.participantCount}개</td>
                      <td>{a.voterCount}명</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{top && top.count > 0 ? `${top.title} (${top.count}표)` : '—'}</td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 12.5 }}>{new Date(a.archivedAt).toLocaleString('ko-KR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
