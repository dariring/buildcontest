import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
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

function verify(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE,
}

// ---------------------------------------------------------------- user

export async function setUserSession(user) {
  const secret = getConfig().sessionSecret
  const jar = await cookies()
  jar.set(
    USER_COOKIE,
    sign({ ...user, exp: Date.now() + MAX_AGE * 1000 }, secret),
    cookieOptions,
  )
}

export async function getUserSession() {
  const jar = await cookies()
  const token = jar.get(USER_COOKIE)?.value
  if (!token) return null
  return verify(token, getConfig().sessionSecret)
}

export async function clearUserSession() {
  const jar = await cookies()
  jar.delete(USER_COOKIE)
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

export async function setAdminSession() {
  const secret = getConfig().sessionSecret
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, sign({ admin: true, exp: Date.now() + MAX_AGE * 1000 }, secret), cookieOptions)
}

export async function isAdmin() {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (!token) return false
  return Boolean(verify(token, getConfig().sessionSecret)?.admin)
}

export async function clearAdminSession() {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
}

// ------------------------------------------------------------ oauth state

export async function setOAuthState(state) {
  const jar = await cookies()
  jar.set(STATE_COOKIE, state, { ...cookieOptions, maxAge: 600 })
}

export async function takeOAuthState() {
  const jar = await cookies()
  const value = jar.get(STATE_COOKIE)?.value ?? null
  jar.delete(STATE_COOKIE)
  return value
}

export function randomState() {
  return randomBytes(16).toString('hex')
}
