import { NextResponse } from 'next/server'
import { isAdmin, getUserSession } from './session.js'

export function json(data, init) {
  return NextResponse.json(data, { status: 200, ...init })
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/** 라우트 핸들러를 감싸 예외를 500 JSON 으로 바꿉니다. */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      console.error('[api]', err)
      return fail(err.message || '서버 오류가 발생했습니다.', 500)
    }
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw Object.assign(new Error('관리자 인증이 필요합니다.'), { status: 401 })
}

export async function requireUser() {
  const user = await getUserSession()
  if (!user) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 })
  return user
}

/** requireAdmin/requireUser 가 던진 상태 코드를 살려주는 래퍼. */
export function guarded(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err.status) return fail(err.message, err.status)
      console.error('[api]', err)
      return fail(err.message || '서버 오류가 발생했습니다.', 500)
    }
  }
}

export async function body(req) {
  try {
    return (await req.json()) ?? {}
  } catch {
    return {}
  }
}
