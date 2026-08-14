import { isAdmin, getUserSession } from './session.js'

// 예상 못 한 예외의 메시지에는 파일 경로나 내부 주소가 섞여 나올 수 있어
// 브라우저에는 두루뭉술하게만 알려주고, 자세한 내용은 서버 로그로만 남깁니다.
const GENERIC_ERROR = '서버 오류가 발생했습니다.'

/** 의도한 실패. 이 오류의 메시지만 사용자에게 그대로 보여줍니다. */
export class HttpError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function fail(message, status = 400, extra = {}) {
  return new HttpError(message, status, extra)
}

/**
 * async 핸들러를 감싸 예외를 JSON 응답으로 바꿉니다.
 * express 4 는 async 함수가 reject 해도 잡아주지 않아서 이 래퍼가 필요합니다.
 */
export function route(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (err) {
      if (res.headersSent) return next(err)
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, ...err.extra })
      }
      console.error('[api]', err)
      res.status(500).json({ error: GENERIC_ERROR })
    }
  }
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError('관리자 인증이 필요합니다.', 401)
}

export function requireUser(req) {
  const user = getUserSession(req)
  if (!user) throw new HttpError('로그인이 필요합니다.', 401)
  return user
}

/** 라우터 전체에 관리자 인증을 거는 미들웨어. */
export function adminOnly(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: '관리자 인증이 필요합니다.' })
  next()
}

/** express.json() 이 붙여준 본문. 객체가 아니면 빈 객체로 취급합니다. */
export function body(req) {
  const value = req.body
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
