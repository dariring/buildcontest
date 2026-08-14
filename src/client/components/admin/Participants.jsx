import { useState } from 'react'
import s from './admin.module.css'
import { Area, Field, Panel, Text, Toggle } from './ui.jsx'
import { isVideo } from '../contest/Carousel.jsx'

const BLANK = {
  title: '',
  description: '',
  builderName: '',
  builderDiscordId: '',
  anonymous: false,
  images: [],
  coords: { world: 'world', x: 0, y: 64, z: 0, yaw: 0, pitch: 0 },
  commandOverride: '',
  hidden: false,
}

/**
 * "world 123 64 -45" / "/cmi tppos 123 64 -45 0 0 world" / "123, 64, -45"
 * 같은 붙여넣기에서 좌표를 뽑아냅니다.
 */
const COMMAND_WORDS = /^(cmi|tppos|tp|teleport|minecraft|execute|in|as|at|run)$/i

function parseCoords(text) {
  const source = String(text)
  const numbers = source.match(/-?\d+(?:\.\d+)?/g)
  if (!numbers || numbers.length < 3) return null
  const [x, y, z, yaw, pitch] = numbers.map(Number)

  const world = source
    .match(/[A-Za-z][A-Za-z0-9_]*/g)
    ?.find((word) => !COMMAND_WORDS.test(word))

  return {
    x,
    y,
    z,
    ...(Number.isFinite(yaw) ? { yaw } : {}),
    ...(Number.isFinite(pitch) ? { pitch } : {}),
    ...(world ? { world } : {}),
  }
}

function Editor({ value, onChange, onSave, onDelete, onPreview, saving, isNew }) {
  const [paste, setPaste] = useState('')
  const set = (key, v) => onChange({ ...value, [key]: v })
  const setCoord = (key, v) => onChange({ ...value, coords: { ...value.coords, [key]: v } })

  const setImage = (i, url) => set('images', value.images.map((old, idx) => (idx === i ? url : old)))
  const moveImage = (i, delta) => {
    const next = [...value.images]
    const j = i + delta
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set('images', next)
  }

  function applyPaste() {
    const parsed = parseCoords(paste)
    if (!parsed) return
    onChange({ ...value, coords: { ...value.coords, ...parsed } })
    setPaste('')
  }

  return (
    <div className={s.pbody}>
      <div className={s.row2}>
        <Text label="건축물 제목" value={value.title} onChange={(v) => set('title', v)} placeholder="예) 구름 위의 도서관" />
        <Text
          label="건축가 이름"
          hint={value.anonymous ? '익명 공개 중 — 이 이름은 어드민에서만 보입니다.' : '공모전 페이지에 그대로 표시됩니다.'}
          value={value.builderName}
          onChange={(v) => set('builderName', v)}
          placeholder="예) Steve"
        />
      </div>

      <Toggle
        label="건축가 익명 공개"
        hint="켜면 공모전 페이지에 '익명' 으로만 보입니다. 실제 이름은 어드민과 CSV 에는 그대로 남습니다."
        checked={value.anonymous}
        onChange={(v) => set('anonymous', v)}
      />

      <Area
        label="건축물 설명"
        value={value.description}
        onChange={(v) => set('description', v)}
        rows={4}
        placeholder="컨셉, 사용한 블록, 감상 포인트 등"
      />

      <Text
        label="건축가 디스코드 ID"
        hint="입력해두면 본인 작품 자기 투표를 막을 수 있습니다. (선택)"
        value={value.builderDiscordId}
        onChange={(v) => set('builderDiscordId', v)}
        mono
      />

      {/* ------------------------------------------------------- 미디어 (사진·영상) */}
      <Field
        label={`미디어 (${value.images.length}개)`}
        hint="이미지 또는 MP4 영상 URL을 순서대로 넣으면 카드에서 넘겨볼 수 있습니다."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {value.images.map((url, i) => (
            <div className={s.imgRow} key={i}>
              {/* 영상이면 video, 아니면 img 로 미리보기 */}
              {isVideo(url) ? (
                <video
                  className={s.imgPreview}
                  src={url || undefined}
                  muted
                  playsInline
                  preload="none"
                  style={{ background: '#111', objectFit: 'cover' }}
                  onError={(e) => (e.currentTarget.style.opacity = 0.25)}
                />
              ) : (
                <img className={s.imgPreview} src={url || undefined} alt="" onError={(e) => (e.currentTarget.style.opacity = 0.25)} />
              )}
              <input
                className="input input--mono"
                value={url}
                onChange={(e) => setImage(i, e.target.value)}
                placeholder="https://... (.png / .jpg / .mp4 등)"
                spellCheck={false}
              />
              <button className={s.iconBtn} onClick={() => moveImage(i, -1)} disabled={i === 0} title="위로">
                ↑
              </button>
              <button className={s.iconBtn} onClick={() => moveImage(i, 1)} disabled={i === value.images.length - 1} title="아래로">
                ↓
              </button>
              <button
                className={`${s.iconBtn} ${s.iconBtnDanger}`}
                onClick={() => set('images', value.images.filter((_, idx) => idx !== i))}
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn--outline btn--sm" onClick={() => set('images', [...value.images, ''])}>
              + 사진 추가
            </button>
            <button className="btn btn--outline btn--sm" onClick={() => set('images', [...value.images, ''])}>
              + 영상 추가
            </button>
          </div>
        </div>
      </Field>

      {/* ------------------------------------------------------- 좌표 */}
      <Field label="텔레포트 좌표" hint="참가자가 이 위치로 이동합니다. yaw 는 바라보는 방향, pitch 는 상하 각도입니다.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 9 }}>
          <input className="input input--mono" value={value.coords.world} onChange={(e) => setCoord('world', e.target.value)} placeholder="world" />
          <input className="input input--mono" type="number" value={value.coords.x} onChange={(e) => setCoord('x', Number(e.target.value))} placeholder="x" />
          <input className="input input--mono" type="number" value={value.coords.y} onChange={(e) => setCoord('y', Number(e.target.value))} placeholder="y" />
          <input className="input input--mono" type="number" value={value.coords.z} onChange={(e) => setCoord('z', Number(e.target.value))} placeholder="z" />
          <input className="input input--mono" type="number" value={value.coords.yaw} onChange={(e) => setCoord('yaw', Number(e.target.value))} placeholder="yaw" />
          <input className="input input--mono" type="number" value={value.coords.pitch} onChange={(e) => setCoord('pitch', Number(e.target.value))} placeholder="pitch" />
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
        <Text
          label="좌표 붙여넣기"
          hint="게임에서 복사한 좌표나 명령어를 그대로 붙여넣으면 위 칸을 채웁니다."
          value={paste}
          onChange={setPaste}
          mono
          placeholder="world 128 72 -340 90 0"
        />
        <button className="btn btn--outline btn--sm" style={{ marginBottom: 22 }} onClick={applyPaste} disabled={!paste}>
          채우기
        </button>
      </div>

      <Text
        label="개별 명령어 (선택)"
        hint="비우면 설정 → 텔레포트의 기본 명령어를 씁니다."
        value={value.commandOverride}
        onChange={(v) => set('commandOverride', v)}
        mono
        placeholder="비어 있으면 기본값 사용"
      />

      <Toggle label="숨기기" hint="공모전 페이지에서 보이지 않고, 투표 대상에서도 빠집니다." checked={value.hidden} onChange={(v) => set('hidden', v)} />

      <div className={s.actions}>
        <button className="btn btn--primary" onClick={onSave} disabled={saving || !value.title.trim()}>
          {saving && <span className="spin" />} {isNew ? '추가' : '저장'}
        </button>
        {!isNew && (
          <>
            <button className="btn btn--outline btn--sm" onClick={onPreview}>
              명령어 미리보기
            </button>
            <button className="btn btn--danger btn--sm" style={{ marginLeft: 'auto' }} onClick={onDelete}>
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Participants({ participants, api, toast, refresh }) {
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [creating, setCreating] = useState(null)
  const [saving, setSaving] = useState(false)

  function open(p) {
    if (openId === p.id) {
      setOpenId(null)
      setDraft(null)
      return
    }
    setCreating(null)
    setOpenId(p.id)
    setDraft({ ...BLANK, ...p, coords: { ...BLANK.coords, ...p.coords }, images: [...p.images] })
  }

  async function save() {
    setSaving(true)
    const res = await api(`/api/admin/participants/${openId}`, { method: 'PATCH', body: draft })
    setSaving(false)
    if (res.ok) {
      toast('저장했습니다.')
      refresh()
    } else toast(res.error, false)
  }

  async function create() {
    setSaving(true)
    const res = await api('/api/admin/participants', { method: 'POST', body: creating })
    setSaving(false)
    if (res.ok) {
      toast('참가작을 추가했습니다.')
      setCreating(null)
      refresh()
    } else toast(res.error, false)
  }

  async function remove(p) {
    if (!confirm(`"${p.title}" 참가작을 삭제할까요? 이 작품에 들어온 표도 함께 정리됩니다.`)) return
    const res = await api(`/api/admin/participants/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setOpenId(null)
      toast('삭제했습니다.')
      refresh()
    } else toast(res.error, false)
  }

  async function move(index, delta) {
    const ids = participants.map((p) => p.id)
    const j = index + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    const res = await api('/api/admin/participants', { method: 'PUT', body: { ids } })
    if (res.ok) refresh()
  }

  async function preview(p) {
    const res = await api('/api/admin/test', { method: 'POST', body: { kind: 'teleport-preview', value: p.id } })
    toast(res.ok ? res.message : res.error, res.ok)
  }

  return (
    <Panel
      title="참가작"
      sub="사진·제목·설명·좌표를 여기서 관리합니다. 순서는 공모전 페이지의 표시 순서와 같습니다."
      right={
        <button
          className="btn btn--primary btn--sm"
          onClick={() => {
            setOpenId(null)
            setCreating(creating ? null : { ...BLANK, images: [''] })
          }}
        >
          {creating ? '취소' : '+ 참가작 추가'}
        </button>
      }
    >
      {creating && (
        <div className={`${s.pitem} ${s.pitemOpen}`} style={{ marginBottom: 16 }}>
          <div className={s.phead}>
            <div className={s.pmeta}>
              <div className={s.pname}>새 참가작</div>
            </div>
          </div>
          <Editor value={creating} onChange={setCreating} onSave={create} saving={saving} isNew />
        </div>
      )}

      {participants.length === 0 && !creating ? (
        <p className="field-hint" style={{ padding: '28px 0', textAlign: 'center' }}>
          아직 참가작이 없습니다. 오른쪽 위 버튼으로 추가해주세요.
        </p>
      ) : (
        <div className={s.plist}>
          {participants.map((p, i) => (
            <div className={`${s.pitem} ${openId === p.id ? s.pitemOpen : ''}`} key={p.id}>
              <div className={s.phead}>
                <div className={s.porder}>
                  <button className={s.porderBtn} onClick={() => move(i, -1)} disabled={i === 0} title="위로">
                    ▲
                  </button>
                  <button className={s.porderBtn} onClick={() => move(i, 1)} disabled={i === participants.length - 1} title="아래로">
                    ▼
                  </button>
                </div>

                {p.images[0] ? (
                  isVideo(p.images[0]) ? (
                    <video
                      className={s.pthumb}
                      src={p.images[0]}
                      muted
                      playsInline
                      preload="none"
                      style={{ objectFit: 'cover', background: '#111' }}
                    />
                  ) : (
                    <img className={s.pthumb} src={p.images[0]} alt="" />
                  )
                ) : (
                  <div className={`${s.pthumb} ${s.pthumbEmpty}`}>🖼️</div>
                )}

                <button className={s.pmeta} style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }} onClick={() => open(p)}>
                  <div className={s.pname}>
                    {p.title || '(제목 없음)'}
                    {p.hidden && <span className="pill">숨김</span>}
                    {p.anonymous && <span className="pill">익명</span>}
                  </div>
                  <div className={s.pcoords}>
                    {p.builderName ? `${p.builderName} · ` : ''}
                    {(() => {
                      const imgs = p.images.filter((u) => !isVideo(u)).length
                      const vids = p.images.filter((u) => isVideo(u)).length
                      const parts = []
                      if (imgs > 0) parts.push(`사진 ${imgs}장`)
                      if (vids > 0) parts.push(`영상 ${vids}개`)
                      return parts.length ? parts.join(' · ') : '미디어 없음'
                    })()}
                  </div>
                </button>

                <button className="btn btn--ghost btn--sm" onClick={() => open(p)}>
                  {openId === p.id ? '닫기' : '편집'}
                </button>
              </div>

              {openId === p.id && draft && (
                <Editor
                  value={draft}
                  onChange={setDraft}
                  onSave={save}
                  onDelete={() => remove(p)}
                  onPreview={() => preview(p)}
                  saving={saving}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
