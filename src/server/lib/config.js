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

function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof base?.[key] === 'object') {
      out[key] = deepMerge(base[key], value)
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

export function getConfig() {
  const stored = read('config', {})
  const merged = deepMerge(DEFAULT_CONFIG, stored)
  if (!merged.sessionSecret) {
    merged.sessionSecret = randomBytes(32).toString('hex')
    write('config', merged)
  }
  return merged
}

export function saveConfig(patch) {
  const next = deepMerge(getConfig(), patch)
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
