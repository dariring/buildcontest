import s from './admin.module.css'
import { Panel } from './ui.jsx'

function when(ts) {
  return new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Votes({ votes, api, toast, refresh }) {
  const rows = votes?.summary?.rows?.filter((r) => !r.hidden) ?? []
  const list = votes?.votes ?? []
  const max = Math.max(1, ...rows.map((r) => r.count))

  async function removeVote(v) {
    if (!confirm(`${v.displayName} 님의 투표를 삭제할까요?`)) return
    const res = await api('/api/admin/votes', { method: 'DELETE', body: { discordId: v.discordId } })
    if (res.ok) {
      toast('투표를 삭제했습니다.')
      refresh()
    } else toast(res.error, false)
  }

  return (
    <>
      <Panel
        title="득표 현황"
        sub={`${votes?.summary?.voterCount ?? 0}명 참여 · 총 ${votes?.summary?.totalPicks ?? 0}표`}
        right={
          <a className="btn btn--outline btn--sm" href="/api/admin/votes?format=csv" download>
            CSV 내려받기
          </a>
        }
      >
        {rows.length === 0 ? (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            아직 집계할 참가작이 없습니다.
          </p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 52 }}>순위</th>
                  <th>건축물</th>
                  <th>건축가</th>
                  <th style={{ width: '34%' }}>득표</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`${s.rank} ${i === 0 && row.count > 0 ? s.rank1 : i === 1 && row.count > 0 ? s.rank2 : i === 2 && row.count > 0 ? s.rank3 : ''}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{row.title}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.builderName || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={s.bar} style={{ width: `${(row.count / max) * 100}%` }} />
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontSize: 13 }}>
                          {row.count}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="투표자" sub="가장 최근 제출이 위에 옵니다.">
        {list.length === 0 ? (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            아직 제출된 투표가 없습니다.
          </p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>디스코드</th>
                  <th>마인크래프트</th>
                  <th>선택</th>
                  <th style={{ width: 120 }}>제출</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.discordId}>
                    <td>
                      <div className={s.voterCell}>
                        {v.avatar && <img src={v.avatar} alt="" />}
                        <div>
                          <div style={{ fontWeight: 500 }}>{v.displayName}</div>
                          <div className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>
                            {v.discordId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{v.mcName || v.uuid || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>{v.pickTitles.join(' · ')}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {when(v.submittedAt)}
                      {v.revised && ' (수정)'}
                    </td>
                    <td>
                      <button className="btn btn--ghost btn--sm" onClick={() => removeVote(v)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
