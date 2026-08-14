'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './contest.module.css'
import { ChevronLeft, ChevronRight, Close } from './icons.js'

/**
 * 사진 크게 보기. 배경·닫기 버튼·ESC 로 닫히고 ←/→ 로 넘깁니다.
 */
export default function Lightbox({ images, index, onIndex, onClose, title }) {
  const [loaded, setLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef(null)
  const touch = useRef(null)
  const count = images.length

  useEffect(() => setMounted(true), [])

  // 화살표를 빠르게 두 번 누르면 두 호출이 같은 index 를 읽어 한 칸만 움직입니다.
  // 최신 값을 ref 로 들고 있어야 연타해도 제대로 넘어갑니다.
  const latest = useRef(index)
  useEffect(() => {
    latest.current = index
  }, [index])

  const go = useCallback(
    (delta) => {
      const next = (latest.current + delta + count) % count
      latest.current = next
      setLoaded(false)
      onIndex(next)
    },
    [count, onIndex],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) go(-1)
      else if (e.key === 'ArrowRight' && count > 1) go(1)
    }
    window.addEventListener('keydown', onKey)

    // 뒤 페이지가 같이 스크롤되지 않게 잠급니다.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [count, go, onClose])

  const onTouchStart = (e) => {
    touch.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touch.current === null || count < 2) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
    touch.current = null
  }

  if (!mounted) return null

  // 카드가 overflow:hidden + hover transform 이라 그 안에 두면 잘립니다.
  // body 로 옮겨야 화면 전체를 덮을 수 있습니다.
  return createPortal(
    <div
      className={s.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 사진 크게 보기`}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button ref={closeRef} type="button" className={s.lbClose} onClick={onClose} aria-label="닫기">
        <Close size={18} />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${s.lbArrow} ${s.lbArrowLeft}`}
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="이전 사진"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className={`${s.lbArrow} ${s.lbArrowRight}`}
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="다음 사진"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* 클릭이 배경으로 새어나가지 않도록 사진 영역은 이벤트를 막습니다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={images[index]}
        className={`${s.lbImage} ${loaded ? s.lbImageIn : ''}`}
        src={images[index]}
        alt={`${title} ${index + 1}번째 사진`}
        onClick={(e) => e.stopPropagation()}
        onLoad={() => setLoaded(true)}
        draggable={false}
      />

      <div className={s.lbBar} onClick={(e) => e.stopPropagation()}>
        <span className={s.lbTitle}>{title}</span>
        {count > 1 && (
          <span className={s.lbCounter}>
            {index + 1} / {count}
          </span>
        )}
      </div>
    </div>,
    document.body,
  )
}
