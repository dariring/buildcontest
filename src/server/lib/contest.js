import { randomUUID } from 'node:crypto'
import { read, write, update } from './store.js'
import { getConfig, safeUrl } from './config.js'

// ------------------------------------------------------------ participants

export const EMPTY_PARTICIPANT = {
  title: '',
  description: '',
  builderName: '',
  builderDiscordId: '',
  // true 면 공개 페이지에서 건축가를 "익명" 으로만 보여줍니다.
  // 어드민과 자기 투표 방지에는 실제 값이 그대로 쓰입니다.
  anonymous: false,
  images: [],
  coords: { world: 'world', x: 0, y: 64, z: 0, yaw: 0, pitch: 0 },
  commandOverride: '',
  hidden: false,
}

/**
 * 월드 이름도 결국 콘솔 명령 한복판에 들어갑니다.
 * 마인크래프트에서 쓸 수 있는 글자만 남기고, 남는 게 없으면 'world' 로 되돌립니다.
 */
export function safeWorld(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_\-.]/g, '')
    .slice(0, 64)
  return cleaned || 'world'
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeParticipant(input, existing = null) {
  const base = existing ?? { ...EMPTY_PARTICIPANT, id: randomUUID(), createdAt: Date.now() }
  // 어드민이 보낸 JSON 이라도 형태가 어긋나면 500 이 나므로 여기서 모양을 잡아둡니다.
  const patch = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const rawCoords = patch.coords && typeof patch.coords === 'object' && !Array.isArray(patch.coords) ? patch.coords : {}
  const coords = { ...base.coords, ...rawCoords }
  const images = patch.images === undefined ? toArray(base.images) : toArray(patch.images)

  return {
    ...base,
    title: String(patch.title ?? base.title ?? '').trim(),
    description: String(patch.description ?? base.description ?? ''),
    builderName: String(patch.builderName ?? base.builderName ?? '').trim(),
    builderDiscordId: String(patch.builderDiscordId ?? base.builderDiscordId ?? '').trim(),
    anonymous: Boolean(patch.anonymous ?? base.anonymous ?? false),
    // 사진 주소도 그대로 <img src> 가 됩니다. 설정값과 같은 기준으로 걸러냅니다.
    images: images.map((url) => safeUrl(url)).filter(Boolean),
    coords: {
      world: safeWorld(coords.world),
      x: Number(coords.x) || 0,
      y: Number(coords.y) || 0,
      z: Number(coords.z) || 0,
      yaw: Number(coords.yaw) || 0,
      pitch: Number(coords.pitch) || 0,
    },
    commandOverride: String(patch.commandOverride ?? base.commandOverride ?? '').trim(),
    hidden: Boolean(patch.hidden ?? base.hidden ?? false),
    updatedAt: Date.now(),
  }
}

export function listParticipants({ includeHidden = false } = {}) {
  const all = read('participants', [])
  return includeHidden ? all : all.filter((p) => !p.hidden)
}

export function getParticipant(id) {
  return read('participants', []).find((p) => p.id === id) ?? null
}

export function createParticipant(input) {
  const participant = normalizeParticipant(input)
  update('participants', [], (list) => [...list, participant])
  return participant
}

export function updateParticipant(id, input) {
  let result = null
  update('participants', [], (list) =>
    list.map((p) => {
      if (p.id !== id) return p
      result = normalizeParticipant(input, p)
      return result
    }),
  )
  return result
}

export function deleteParticipant(id) {
  update('participants', [], (list) => list.filter((p) => p.id !== id))
  // 이미 들어온 표에서도 제거해 집계가 어긋나지 않게 합니다.
  // 고른 게 하나도 남지 않은 투표는 통째로 지웁니다. 남겨두면 참여자 수에는
  // 잡히는데 표는 0인 유령 투표가 되고, 그 사람은 다시 투표할 수도 없습니다.
  update('votes', {}, (votes) => {
    const next = {}
    for (const [key, entry] of Object.entries(votes)) {
      const picks = (entry.picks ?? []).filter((pid) => pid !== id)
      if (picks.length === 0) continue
      next[key] = { ...entry, picks }
    }
    return next
  })
  update('progress', {}, (progress) => {
    const next = {}
    for (const [key, entry] of Object.entries(progress)) {
      next[key] = { ...entry, visited: (entry.visited ?? []).filter((pid) => pid !== id) }
    }
    return next
  })
}

export function reorderParticipants(ids) {
  update('participants', [], (list) => {
    const map = new Map(list.map((p) => [p.id, p]))
    const ordered = ids.map((id) => map.get(id)).filter(Boolean)
    const rest = list.filter((p) => !ids.includes(p.id))
    return [...ordered, ...rest]
  })
  return read('participants', [])
}

// ---------------------------------------------------------------- progress

export function getProgress(discordId) {
  return read('progress', {})[discordId] ?? { visited: [], lastTeleportAt: 0 }
}

export function markVisited(discordId, participantId) {
  let result
  update('progress', {}, (all) => {
    const current = all[discordId] ?? { visited: [], lastTeleportAt: 0 }
    const visited = current.visited.includes(participantId)
      ? current.visited
      : [...current.visited, participantId]
    result = { visited, lastTeleportAt: Date.now() }
    return { ...all, [discordId]: result }
  })
  return result
}

/** 투표 잠금 해제 여부 — 공개된 참가자를 전부 돌아봤는가. */
export function hasVisitedAll(discordId) {
  const config = getConfig()
  if (!config.teleport.requireAllBeforeVote) return true
  const participants = listParticipants()
  if (participants.length === 0) return false
  const visited = new Set(getProgress(discordId).visited)
  return participants.every((p) => visited.has(p.id))
}

// ------------------------------------------------------------------- votes

export function getVotes() {
  return read('votes', {})
}

export function getVote(discordId) {
  return getVotes()[discordId] ?? null
}

export function saveVote(discordId, entry) {
  update('votes', {}, (all) => ({ ...all, [discordId]: entry }))
  return entry
}

export function deleteVote(discordId) {
  update('votes', {}, (all) => {
    const next = { ...all }
    delete next[discordId]
    return next
  })
}

export function tally() {
  const votes = Object.values(getVotes())
  const counts = new Map()
  for (const vote of votes) {
    for (const id of vote.picks) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const participants = listParticipants({ includeHidden: true })
  const rows = participants
    .map((p) => ({
      id: p.id,
      title: p.title,
      builderName: p.builderName,
      hidden: p.hidden,
      count: counts.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ko'))

  return { rows, voterCount: votes.length, totalPicks: votes.reduce((n, v) => n + v.picks.length, 0) }
}

// ----------------------------------------------------------- voting window

function parseLocal(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function votingWindow(config = getConfig()) {
  const start = parseLocal(config.vote.startAt)
  const end = parseLocal(config.vote.endAt)
  const now = new Date()

  if (config.vote.manualOpen) {
    return { open: true, reason: 'manual', startAt: start?.toISOString() ?? null, endAt: end?.toISOString() ?? null }
  }
  if (start && now < start) {
    return { open: false, reason: 'before', startAt: start.toISOString(), endAt: end?.toISOString() ?? null }
  }
  if (end && now > end) {
    return { open: false, reason: 'after', startAt: start?.toISOString() ?? null, endAt: end.toISOString() }
  }
  if (!start && !end) {
    return { open: false, reason: 'unscheduled', startAt: null, endAt: null }
  }
  return { open: true, reason: 'scheduled', startAt: start?.toISOString() ?? null, endAt: end?.toISOString() ?? null }
}

// -------------------------------------------------------- teleport command

const SAFE_PLAYER = /^[A-Za-z0-9_]{1,16}$/
const SAFE_UUID = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/

/** 명령어에 끼워 넣어도 안전한 UUID 만 통과시킵니다. 아니면 null. */
export function safeUuid(value) {
  const raw = String(value ?? '').trim()
  return SAFE_UUID.test(raw) ? raw : null
}

export function buildTeleportCommand(participant, playerName, uuid) {
  const config = getConfig()
  const template = participant.commandOverride?.trim() || config.teleport.commandTemplate
  const { coords } = participant

  // 이 문자열은 DiscordSRV 콘솔 채널로 그대로 흘러가 서버 명령으로 실행됩니다.
  // 그러니 바깥에서 들어온 값(마인크래프트 닉네임, 연동 API 가 준 UUID)은
  // 하나도 빠짐없이 형식 검사를 통과한 것만 씁니다. 공백 하나만 새어 들어가도
  // 뒤에 인자를 덧붙여 다른 명령을 실행시킬 수 있습니다.
  const player = SAFE_PLAYER.test(playerName ?? '') ? playerName : null
  const id = safeUuid(uuid)
  if (!player && !id) throw new Error('플레이어 이름 또는 UUID를 확인할 수 없습니다.')

  const num = (n) => {
    const value = Number(n)
    if (!Number.isFinite(value)) return '0'
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
  }

  return template
    .replaceAll('{player}', player ?? id)
    .replaceAll('{uuid}', id ?? '')
    .replaceAll('{world}', safeWorld(coords.world))
    .replaceAll('{x}', num(coords.x))
    .replaceAll('{y}', num(coords.y))
    .replaceAll('{z}', num(coords.z))
    .replaceAll('{yaw}', num(coords.yaw))
    .replaceAll('{pitch}', num(coords.pitch))
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

// ------------------------------------------------------------------- reset

export function resetContest({ clearVotes = true, clearProgress = true, clearParticipants = false } = {}) {
  if (clearVotes) write('votes', {})
  if (clearProgress) write('progress', {})
  if (clearParticipants) write('participants', [])
  return { ok: true }
}

/** 초기화 전에 이번 달 결과를 보관해 둡니다. */
export function archiveCurrent() {
  const config = getConfig()
  const snapshot = {
    id: randomUUID(),
    archivedAt: Date.now(),
    month: config.contest.month,
    year: config.contest.year,
    participants: read('participants', []),
    votes: read('votes', {}),
    tally: tally(),
  }
  update('archives', [], (list) => [snapshot, ...list].slice(0, 24))
  return snapshot
}

export function listArchives() {
  return read('archives', []).map(({ participants, votes, ...rest }) => ({
    ...rest,
    participantCount: participants.length,
    voterCount: Object.keys(votes).length,
  }))
}

export function getArchive(id) {
  return read('archives', []).find((a) => a.id === id) ?? null
}
