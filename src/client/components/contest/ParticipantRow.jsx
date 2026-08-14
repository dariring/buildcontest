'use client'

import { useState } from 'react'
import s from './contest.module.css'
import Carousel from './Carousel.js'
import { Check, Teleport } from './icons.js'

export default function ParticipantRow({
  participant,
  index,
  visited,
  canTeleport,
  teleportDisabledReason,
  selectable,
  selected,
  selectDisabled,
  onTeleport,
  onToggleSelect,
}) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function teleport() {
    setSending(true)
    setError(null)
    try {
      const message = await onTeleport(participant.id)
      if (message) setError(message)
    } finally {
      setSending(false)
    }
  }

  const showAside = selectable || selected
  const builder = participant.anonymous ? '익명' : participant.builderName

  return (
    <li className={`${s.row} ${selected ? s.rowSelected : ''}`}>
      <div className={s.rowMedia}>
        <Carousel
          images={participant.images}
          alt={participant.title}
          badge={<span className={s.rowIndex}>{String(index + 1).padStart(2, '0')}</span>}
        />
      </div>

      <div className={s.rowBody}>
        <div className={s.rowHead}>
          <h3 className={s.rowTitle}>{participant.title}</h3>
          {builder && (
            <p className={`${s.rowBuilder} ${participant.anonymous ? s.rowBuilderAnon : ''}`}>{builder}</p>
          )}
        </div>

        {participant.description && <p className={s.rowDesc}>{participant.description}</p>}

        {error && <p className={s.rowError}>{error}</p>}

        <div className={s.rowFoot}>
          <button
            type="button"
            className={`btn ${visited ? 'btn--outline' : 'btn--primary'} btn--sm`}
            onClick={teleport}
            disabled={!canTeleport || sending}
            title={teleportDisabledReason || undefined}
          >
            {sending ? <span className="spin" /> : <Teleport size={14} />}
            {sending ? '이동 중' : visited ? '다시 이동' : '텔레포트'}
          </button>

          {visited && (
            <span className={s.visitedTag}>
              <Check size={13} /> 둘러봤어요
            </span>
          )}
        </div>
      </div>

      {showAside && (
        <div className={s.rowAside}>
          <div className={s.asideStack}>
            <button
              type="button"
              className={`${s.pickBtn} ${selected ? s.pickBtnOn : ''}`}
              onClick={() => onToggleSelect(participant.id)}
              disabled={!selectable || (selectDisabled && !selected)}
              aria-pressed={selected}
              aria-label={`${participant.title} ${selected ? '선택 해제' : '투표 선택'}`}
              title={selectDisabled && !selected ? '선택 가능한 수를 모두 채웠어요' : undefined}
            >
              <Check size={20} />
            </button>
            <span className={s.pickLabel}>{selected ? '선택함' : '투표'}</span>
          </div>
        </div>
      )}
    </li>
  )
}
