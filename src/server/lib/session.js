import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getConfig } from './config.js'

const USER_COOKIE = 'bc_user'
const ADMIN_COOKIE = 'bc_admin'
const STATE_COOKIE = 'bc_oauth_state'
const MAX_AGE = 60 * 60 * 24 * 7 // 7일

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

function sign(payload, secret) {
  const body = b64url(JSON.stringify(payload))
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}

/**
 * @param token 쿠키에 담겨 온 값
 * @param secret 서명 키
 * @param type 이 토큰이 어떤 용도로 발급된 것이어야 하는가.
 *   사용자 세션과 관리자 세션이 같은 키로 서명되므로, 용도를 페이로드에
 *   박아 두고 여기서 확인해야 한 쪽 쿠키를 다른 쪽 자리에 끼워 넣을 수 없습니다.
 */
function verify(token, secret, type) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, mac, extra] = token.split('.')
  if (!body || !mac || extra !== undefined) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (!payload || typeof payload !== 'object') return null
    if (payload.typ !== type) return null
    // 만료 시각이 없는 토큰은 만들지 않습니다. 없으면 위조이거나 옛날 형식입니다.
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/**
 * HTTPS 로 들어온 요청에만 Secure 를 붙입니다.
 * 사내망 http:// 배포에서도 로그인이 되어야 하므로 무조건 켜지는 않습니다.
 * (express 의 'trust proxy' 설정이 x-forwarded-proto 를 req.protocol 에 반영합니다.)
 */
function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE * 1000, // express 는 밀리초를 받습니다.
    secure: req.protocol === 'https',
  }
}

function readCookie(req, name) {
  return req.cookies?.[name] ?? null
}

// ---------------------------------------------------------------- user

export function setUserSession(req, res, user) {
  const secret = getConfig().sessionSecret
  res.cookie(USER_COOKIE, sign({ ...user, typ: 'user', exp: Date.now() + MAX_AGE * 1000 }, secret), cookieOptions(req))
}

export function getUserSession(req) {
  const token = readCookie(req, USER_COOKIE)
  if (!token) return null
  return verify(token, getConfig().sessionSecret, 'user')
}

export function clearUserSession(res) {
  res.clearCookie(USER_COOKIE, { path: '/' })
}

// --------------------------------------------------------------- admin

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function checkPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false
  const hash = scryptSync(password, stored.salt, 64)
  const expected = Buffer.from(stored.hash, 'hex')
  if (hash.length !== expected.length) return false
  return timingSafeEqual(hash, expected)
}

/**
 * 지금 저장된 관리자 비밀번호에서 뽑아낸 짧은 지문.
 * 세션에 함께 넣어두면 비밀번호를 바꾸는 순간 기존 관리자 쿠키가 전부 무효화됩니다.
 * (비밀번호가 샜을 때 바꿔도 남의 세션이 7일 동안 살아 있는 문제를 막습니다.)
 */
function adminEpoch(config) {
  const hash = config.adminPassword?.hash
  if (!hash) return 'unset'
  return createHmac('sha256', config.sessionSecret).update(hash).digest('base64url').slice(0, 16)
}

export function setAdminSession(req, res) {
  const config = getConfig()
  const token = sign({ typ: 'admin', pv: adminEpoch(config), exp: Date.now() + MAX_AGE * 1000 }, config.sessionSecret)
  res.cookie(ADMIN_COOKIE, token, cookieOptions(req))
}

export function isAdmin(req) {
  const token = readCookie(req, ADMIN_COOKIE)
  if (!token) return false
  const config = getConfig()
  const payload = verify(token, config.sessionSecret, 'admin')
  if (!payload) return false
  return payload.pv === adminEpoch(config)
}

export function clearAdminSession(res) {
  res.clearCookie(ADMIN_COOKIE, { path: '/' })
}

// ------------------------------------------------------------ oauth state

export function setOAuthState(req, res, state) {
  res.cookie(STATE_COOKIE, state, { ...cookieOptions(req), maxAge: 600 * 1000 })
}

export function takeOAuthState(req, res) {
  const value = readCookie(req, STATE_COOKIE)
  res.clearCookie(STATE_COOKIE, { path: '/' })
  return value
}

export function randomState() {
  return randomBytes(32).toString('hex')
}

/** 길이가 달라도 새지 않는 문자열 비교. OAuth state 대조에 씁니다. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}
