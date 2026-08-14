import { randomBytes } from 'node:crypto'
import { read, write } from './store.js'

const now = new Date()

export const DEFAULT_CONFIG = {
  setupComplete: false,
  adminPassword: null, // { salt, hash }
  sessionSecret: null, // generated on first boot

  contest: {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    // {month} / {year} are substituted at render time.
    titleTemplate: '{month}월 건축 공모전',
    tagline: '이번 달의 건축물을 둘러보고, 마음에 든 셋을 골라주세요.',
    heroNotice: '',
    serverName: '',
    accent: '#c9873b',
    // 좌측 상단 로고. public/ 에 파일을 넣거나 외부 URL 을 써도 됩니다.
    logoUrl: '/logo.png',
    // 히어로 뒤에 깔 배경. 비우면 깔끔한 흰 바탕. 서버 스크린샷을 넣으면 잘 어울립니다.
    backgroundUrl: '',
    backgroundBlur: 3, // px
    backgroundDim: 0.42, // 0~1
  },

  discord: {
    clientId: '',
    clientSecret: '',
    // Leave blank to derive from the incoming request origin.
    redirectUri: '',
    botToken: '',
    consoleChannelId: '', // DiscordSRV 콘솔 채널 — 여기로 명령어가 전송됩니다.
    voteChannelId: '', // 투표 제출 알림이 올라갈 채널
    guildId: '', // 비우면 서버 가입 검사를 하지 않습니다.
    guildInviteUrl: '',
  },

  link: {
    enabled: true,
    baseUrl: 'http://100.77.77.90:3000',
    // connect.js 기준: /api/connectcheck 는 discordid -> uuid,
    // /api/uuidcheck 는 uuid -> discordid 입니다. 로그인 흐름에서는 전자를 씁니다.
    checkPath: '/api/connectcheck',
    adminKey: '',
    guideText: '먼저 마인크래프트 계정과 디스코드를 연동해주세요.',
    guideUrl: '',
  },

  teleport: {
    // 사용 가능한 치환자: {player} {uuid} {x} {y} {z} {yaw} {pitch} {world}
    commandTemplate: 'cmi tppos {x} {y} {z} {yaw} {pitch} {world} -t:{player}',
    cooldownSeconds: 3,
    requireAllBeforeVote: true,
  },

  vote: {
    maxVotes: 3,
    startAt: '', // ISO 문자열 (로컬 datetime-local 값을 그대로 저장)
    endAt: '',
    manualOpen: false, // 기간과 무관하게 강제로 열기
    allowSelfVote: false,
    allowRevote: true,
    showResultsPublicly: false,
  },
}

// 병합 대상에서 무조건 빼야 하는 키. JSON.parse 는 "__proto__" 를 자기 속성으로
// 만들어 주기 때문에, 걸러내지 않으면 요청 본문으로 객체의 프로토타입을 건드릴 수 있습니다.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (FORBIDDEN_KEYS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof base?.[key] === 'object') {
      out[key] = deepMerge(base[key], value)
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

const HEX_COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

/**
 * 어드민이 적는 주소들은 결국 브라우저에서 <img src> 나 <a href> 가 됩니다.
 * javascript: 같은 스킴이 섞여 들어가면 그 자리가 그대로 스크립트 실행 지점이 되므로,
 * 우리 사이트 안의 상대 경로와 http(s) 주소만 통과시킵니다.
 */
export function safeUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  // "//evil.example" 같은 프로토콜 상대 주소는 상대 경로처럼 보이지만 외부로 나갑니다.
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return /^https?:\/\//i.test(raw) ? raw : ''
}

// 빈 칸을 Number() 에 넣으면 0 이 나옵니다. 그 0 을 그대로 받아들이면
// "칸을 비웠다" 가 "0으로 설정했다" 로 바뀌므로, 값이 없는 경우는 기본값으로 돌립니다.
function num(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function int(value, fallback, min, max) {
  return Math.round(num(value, fallback, min, max))
}

function float(value, fallback, min, max) {
  return num(value, fallback, min, max)
}

/**
 * 숫자 칸을 비운 채 저장하면 '' 이 그대로 들어옵니다. 그 값이 투표 개수 제한이나
 * 쿨다운 계산까지 흘러가면 조용히 이상하게 동작하므로, 저장/조회 양쪽에서 모양을 맞춥니다.
 * 색상 역시 CSS 변수로 그대로 들어가니 hex 형식만 통과시킵니다.
 */
function normalizeConfig(config) {
  const { contest, discord, link, teleport, vote } = config
  return {
    ...config,
    contest: {
      ...contest,
      year: int(contest.year, DEFAULT_CONFIG.contest.year, 2000, 2100),
      month: int(contest.month, DEFAULT_CONFIG.contest.month, 1, 12),
      accent: HEX_COLOR.test(String(contest.accent ?? '')) ? contest.accent : DEFAULT_CONFIG.contest.accent,
      backgroundBlur: int(contest.backgroundBlur, 0, 0, 40),
      backgroundDim: float(contest.backgroundDim, 0, 0, 0.95),
      logoUrl: safeUrl(contest.logoUrl),
      backgroundUrl: safeUrl(contest.backgroundUrl),
    },
    discord: {
      ...discord,
      guildInviteUrl: safeUrl(discord.guildInviteUrl),
    },
    link: {
      ...link,
      guideUrl: safeUrl(link.guideUrl),
    },
    teleport: {
      ...teleport,
      cooldownSeconds: int(teleport.cooldownSeconds, 0, 0, 3600),
    },
    vote: {
      ...vote,
      maxVotes: int(vote.maxVotes, DEFAULT_CONFIG.vote.maxVotes, 1, 50),
    },
  }
}

export function getConfig() {
  const stored = read('config', {})
  const merged = normalizeConfig(deepMerge(DEFAULT_CONFIG, stored))
  if (!merged.sessionSecret) {
    merged.sessionSecret = randomBytes(32).toString('hex')
    write('config', merged)
  }
  return merged
}

export function saveConfig(patch) {
  const next = normalizeConfig(deepMerge(getConfig(), patch))
  write('config', next)
  return next
}

/** "{month}월 건축 공모전" -> "8월 건축 공모전" */
export function contestTitle(config = getConfig()) {
  const { titleTemplate, month, year } = config.contest
  return String(titleTemplate || '{month}월 건축 공모전')
    .replaceAll('{month}', String(month))
    .replaceAll('{year}', String(year))
}

/**
 * The config the browser is allowed to see. Secrets never cross this line.
 */
export function publicConfig(config = getConfig()) {
  return {
    setupComplete: config.setupComplete,
    title: contestTitle(config),
    contest: {
      month: config.contest.month,
      year: config.contest.year,
      tagline: config.contest.tagline,
      heroNotice: config.contest.heroNotice,
      serverName: config.contest.serverName,
      accent: config.contest.accent,
      logoUrl: config.contest.logoUrl,
      backgroundUrl: config.contest.backgroundUrl,
      backgroundBlur: config.contest.backgroundBlur,
      backgroundDim: config.contest.backgroundDim,
    },
    link: {
      enabled: config.link.enabled,
      guideText: config.link.guideText,
      guideUrl: config.link.guideUrl,
    },
    teleport: {
      requireAllBeforeVote: config.teleport.requireAllBeforeVote,
      cooldownSeconds: config.teleport.cooldownSeconds,
    },
    vote: {
      maxVotes: config.vote.maxVotes,
      startAt: config.vote.startAt,
      endAt: config.vote.endAt,
      allowSelfVote: config.vote.allowSelfVote,
      allowRevote: config.vote.allowRevote,
      showResultsPublicly: config.vote.showResultsPublicly,
    },
    discord: {
      guildInviteUrl: config.discord.guildInviteUrl,
      loginReady: Boolean(config.discord.clientId && config.discord.clientSecret),
    },
  }
}
