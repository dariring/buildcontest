import { useEffect, useState } from 'react'
import s from './admin.module.css'

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export function Text({ label, hint, value, onChange, mono, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={`input ${mono ? 'input--mono' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </Field>
  )
}

export function Num({ label, hint, value, onChange, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input
        className="input"
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        {...rest}
      />
    </Field>
  )
}

export function Area({ label, hint, value, onChange, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className="textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  )
}

/** 토큰·비밀번호처럼 어깨너머로 보이면 곤란한 값. */
export function Secret({ label, hint, value, onChange, ...rest }) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input input--mono"
          type={shown ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          {...rest}
        />
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setShown((v) => !v)}>
          {shown ? '숨기기' : '보기'}
        </button>
      </div>
    </Field>
  )
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="field-hint" style={{ display: 'block', marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  )
}

export function Panel({ title, sub, right, children, danger }) {
  return (
    <section className={`${s.panel} ${danger ? s.danger : ''}`}>
      {(title || right) && (
        <div className={s.panelHead}>
          <div>
            {title && <h2 className={s.panelTitle}>{title}</h2>}
            {sub && <p className={s.panelSub}>{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Actions({ onSave, saving, saved, result, children }) {
  return (
    <div className={s.actions}>
      {onSave && (
        <button className="btn btn--primary" onClick={onSave} disabled={saving}>
          {saving && <span className="spin" />} 저장
        </button>
      )}
      {children}
      {saved && <span className={s.saved}>✓ 저장됨</span>}
      {result && <span className={`${s.result} ${result.ok === false ? s.resultBad : ''}`}>{result.message}</span>}
    </div>
  )
}

/** 서버 값에서 초기화되고, 서버 값이 바뀌면 다시 맞춰지는 로컬 드래프트. */
export function useDraft(source) {
  const [draft, setDraft] = useState(source)
  useEffect(() => {
    setDraft(source)
  }, [source])
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  return [draft ?? {}, set, setDraft]
}
