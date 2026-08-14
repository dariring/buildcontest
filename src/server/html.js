// index.html 의 __BC_* 자리를 현재 설정으로 채웁니다.
//
// SPA 라서 제목·설명은 자바스크립트가 뜬 뒤에 넣어도 되지만, 그러면 탭 제목이
// 한 박자 늦게 바뀌고 공유 링크 미리보기에도 아무것도 안 잡힙니다. 첫 응답에
// 실어 보내는 편이 낫습니다.
import { contestTitle, getConfig } from './lib/config.js'

// 여기에 들어가는 값은 전부 어드민이 자유롭게 적는 문자열입니다.
// HTML 안으로 들어가기 전에 반드시 이스케이프해야 합니다.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const HEX_COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

/**
 * 아이콘 주소는 <link href> 로 들어갑니다.
 * javascript: 같은 스킴이 끼어들지 못하게 상대 경로와 http(s) 만 허용합니다.
 */
function safeIcon(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return '/logo.png'
  if (raw.startsWith('/') && !raw.startsWith('//')) return escapeHtml(raw)
  if (/^https?:\/\//i.test(raw)) return escapeHtml(raw)
  return '/logo.png'
}

export function renderHtml(template) {
  const config = getConfig()
  const accent = HEX_COLOR.test(String(config.contest.accent ?? '')) ? config.contest.accent : '#c9873b'

  return template
    .replaceAll('__BC_TITLE__', escapeHtml(contestTitle(config)))
    .replaceAll('__BC_DESCRIPTION__', escapeHtml(config.contest.tagline))
    .replaceAll('__BC_ICON__', safeIcon(config.contest.logoUrl))
    .replaceAll('__BC_ACCENT__', accent)
}
