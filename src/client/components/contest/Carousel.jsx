import { useEffect, useRef, useState } from 'react'
import s from './contest.module.css'
import Lightbox from './Lightbox.jsx'
import { ChevronLeft, ChevronRight, Expand, Photo } from './icons.jsx'

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

  // 깨진 사진은 확대해봐야 소용없으니 성한 것만 넘겨줍니다.
  // 원래 인덱스를 함께 들고 다녀야 라이트박스에서 넘길 때 캐러셀과 어긋나지 않습니다.
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
        aria-label={`${alt} 사진`}
      >
        <div className={s.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {images.map((url, i) => (
            <div className={s.slide} key={`${url}-${i}`}>
              {broken[i] ? (
                <div className={s.carouselEmpty}>
                  <Photo />
                  <span>이미지를 불러올 수 없어요</span>
                </div>
              ) : (
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
            <button type="button" className={`${s.arrow} ${s.arrowLeft}`} onClick={() => go(-1)} aria-label="이전 사진">
              <ChevronLeft />
            </button>
            <button type="button" className={`${s.arrow} ${s.arrowRight}`} onClick={() => go(1)} aria-label="다음 사진">
              <ChevronRight />
            </button>
            <div className={s.counter}>
              {index + 1} / {count}
            </div>
            <div className={s.dots}>
              {images.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`${s.dot} ${i === index ? s.dotOn : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번째 사진 보기`}
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
