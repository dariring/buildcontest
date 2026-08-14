import { useEffect, useRef, useState } from 'react'
import s from './contest.module.css'
import Lightbox from './Lightbox.jsx'
import { ChevronLeft, ChevronRight, Expand, Photo, Video, PlayCircle } from './icons.jsx'

/** URL 확장자를 보고 동영상 여부를 판단합니다. */
export function isVideo(url) {
  if (!url) return false
  try {
    const path = new URL(url).pathname.toLowerCase()
    return /\.(mp4|webm|mov|ogg|m4v)$/.test(path)
  } catch {
    return /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url)
  }
}

export default function Carousel({ images = [], alt = '', badge = null }) {
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState({})
  const [zoomed, setZoomed] = useState(false)
  const touch = useRef(null)

  const count = images.length

  useEffect(() => {
    if (index > count - 1) setIndex(0)
  }, [count, index])

  if (count === 0) {
    return (
      <div className={s.carousel}>
        {badge}
        <div className={s.carouselEmpty}>
          <Photo />
          <span>사진이 아직 없어요</span>
        </div>
      </div>
    )
  }

  const go = (delta) => setIndex((i) => (i + delta + count) % count)

  const onTouchStart = (e) => {
    touch.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1)
    touch.current = null
  }

  // 깨진 미디어는 확대해봐야 소용없으니 성한 것만 넘겨줍니다.
  const openable = images.map((url, i) => ({ url, i })).filter(({ i }) => !broken[i])
  const openIndex = Math.max(
    0,
    openable.findIndex(({ i }) => i === index),
  )

  return (
    <>
      <div
        className={s.carousel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${alt} 미디어`}
      >
        <div className={s.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {images.map((url, i) => (
            <div className={s.slide} key={`${url}-${i}`}>
              {broken[i] ? (
                <div className={s.carouselEmpty}>
                  {isVideo(url) ? <Video /> : <Photo />}
                  <span>미디어를 불러올 수 없어요</span>
                </div>
              ) : isVideo(url) ? (
                /* ── 동영상 슬라이드: 클릭하면 라이트박스에서 소리 있는 풀스크린 재생 ── */
                <button
                  type="button"
                  className={s.slideBtn}
                  onClick={() => setZoomed(true)}
                  aria-label={`${alt} ${i + 1}번째 동영상 크게 보기`}
                  tabIndex={i === index ? 0 : -1}
                >
                  <video
                    className={s.slideVideo}
                    src={url}
                    muted
                    loop
                    playsInline
                    preload="none"
                    onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                  />
                  <span className={`${s.zoomHint} ${s.videoPlayHint}`}>
                    <PlayCircle size={28} />
                  </span>
                </button>
              ) : (
                /* ── 이미지 슬라이드 ── */
                <button
                  type="button"
                  className={s.slideBtn}
                  onClick={() => setZoomed(true)}
                  aria-label={`${alt} ${i + 1}번째 사진 크게 보기`}
                  tabIndex={i === index ? 0 : -1}
                >
                  {/* 참가자가 넣는 임의 URL이라 최적화 없이 그대로 씁니다. */}
                  <img
                    src={url}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                    draggable={false}
                  />
                  <span className={s.zoomHint}>
                    <Expand />
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

        {badge}

        {count > 1 && (
          <>
            <button type="button" className={`${s.arrow} ${s.arrowLeft}`} onClick={() => go(-1)} aria-label="이전 미디어">
              <ChevronLeft />
            </button>
            <button type="button" className={`${s.arrow} ${s.arrowRight}`} onClick={() => go(1)} aria-label="다음 미디어">
              <ChevronRight />
            </button>
            <div className={s.counter}>
              {index + 1} / {count}
            </div>
            <div className={s.dots}>
              {images.map((url, i) => (
                <button
                  type="button"
                  key={i}
                  className={`${s.dot} ${i === index ? s.dotOn : ''} ${isVideo(url) ? s.dotVideo : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번째 ${isVideo(url) ? '동영상' : '사진'} 보기`}
                  aria-current={i === index}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {zoomed && openable.length > 0 && (
        <Lightbox
          images={openable.map((o) => o.url)}
          index={openIndex}
          onIndex={(k) => setIndex(openable[k].i)}
          onClose={() => setZoomed(false)}
          title={alt}
        />
      )}
    </>
  )
}
