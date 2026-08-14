import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import express from 'express'

import adminRouter from './routes/admin.js'
import authRouter from './routes/auth.js'
import stateRouter from './routes/state.js'
import teleportRouter from './routes/teleport.js'
import voteRouter from './routes/vote.js'
import { renderHtml } from './html.js'
import { ensureBot } from './lib/bot.js'
import { getConfig } from './lib/config.js'
import { DATA_DIR } from './lib/store.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEV = process.env.NODE_ENV === 'development'
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

/**
 * 밖에서 보이는 실제 주소. 예) https://contest.example.com
 *
 * 보통은 Host 헤더로 알아낼 수 있어 비워두면 됩니다. 다만 터널이나 프록시가
 * Host 를 origin 주소로 바꿔서 넘기도록 설정된 경우(cloudflared 의 httpHostHeader 등),
 * 브라우저가 보낸 Origin 과 Host 가 서로 달라져 아래 출처 검사가 전부 막힙니다.
 * 그럴 때 이 값을 지정하면 Host 대신 이 주소를 기준으로 판단합니다.
 */
const PUBLIC_ORIGIN = (() => {
  const raw = process.env.BUILDCONTEST_PUBLIC_ORIGIN?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return { host: url.host, origin: url.origin }
  } catch {
    console.error(`[buildcontest] BUILDCONTEST_PUBLIC_ORIGIN 형식이 올바르지 않습니다: ${raw}`)
    return null
  }
})()

const app = express()

// 리버스 프록시(nginx, Cloudflare 등) 뒤에 있을 때만 켜세요.
// 켜면 x-forwarded-for / x-forwarded-proto 를 신뢰합니다. 프록시가 없는데 켜면
// 클라이언트가 헤더만 바꿔서 접속 IP 를 속이고 로그인 시도 제한을 우회할 수 있습니다.
//
// express 는 이 값이 문자열이면 "신뢰할 IP 목록" 으로 읽습니다.
// BUILDCONTEST_TRUST_PROXY=1 을 그대로 넘기면 1 이라는 이름의 주소를 찾다가
// 아무것도 신뢰하지 않게 되므로, 숫자로 보이는 값은 홉 수로 바꿔서 넘깁니다.
const trustProxy = process.env.BUILDCONTEST_TRUST_PROXY?.trim()
if (trustProxy) {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)
}
app.disable('x-powered-by')

// 압축은 HTML·CSS·JS 에서 효과를 봅니다. 반대로 봇 토큰 같은 비밀이 실려 나가는
// 어드민 응답은 압축하지 않습니다. 압축된 응답은 크기 변화만으로 내용이 새어 나갈 수
// 있고(BREACH), 그 몇 백 바이트를 아껴서 얻을 것도 없습니다.
app.use(
  compression({
    filter: (req, res) => {
      if (req.path.startsWith('/api/admin')) return false
      return compression.filter(req, res)
    },
  }),
)
app.use(cookieParser())

// 폰트는 jsdelivr 에서, 참가작 사진은 아무 주소나 올 수 있어 그만큼만 열어둡니다.
//
// 개발 중에는 vite 가 HMR 용 인라인 스크립트를 심고 웹소켓을 열기 때문에 그만큼만 풀어줍니다.
// 실제로 배포되는 건 아래 else 쪽 정책입니다.
const CSP = [
  "default-src 'self'",
  DEV ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  'img-src * data: blob:',
  'media-src *',
  DEV ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

app.use((req, res, next) => {
  res.set('Content-Security-Policy', CSP)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// ------------------------------------------------------------------- api

// 본문 크기를 제한해 둡니다. 참가작 하나가 이보다 커질 일은 없습니다.
app.use('/api', express.json({ limit: '256kb' }))

// express.json() 은 본문이 깨졌거나 너무 클 때 예외를 던집니다. 그대로 두면
// "서버 오류" 500 으로 뭉뚱그려져서, 어드민이 무엇이 잘못됐는지 알 수 없습니다.
app.use('/api', (err, req, res, next) => {
  if (!err) return next()
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '보내신 내용이 너무 큽니다. (최대 256KB)' })
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
  }
  next(err)
})

// 세션 쿠키가 SameSite=lax 라 다른 사이트에서 온 POST 에는 쿠키가 실리지 않습니다.
// 그래도 브라우저가 오래됐거나 설정이 다를 때를 대비해, 상태를 바꾸는 요청은
// Origin 이 우리 호스트인지 한 번 더 확인합니다.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.get('origin')
  if (!origin) return next() // 브라우저가 아닌 클라이언트(curl 등)

  const expected = PUBLIC_ORIGIN?.host ?? req.get('host')
  try {
    if (new URL(origin).host === expected) return next()
  } catch {
    /* 형식이 깨진 Origin 은 아래에서 막습니다. */
  }

  // 설정이 어긋나 정상 요청이 막히는 경우가 제일 헷갈리므로 단서를 로그에 남깁니다.
  console.warn(`[api] 출처 불일치로 차단: origin=${origin} 기준=${expected}`)
  res.status(403).json({ error: '요청 출처를 확인할 수 없습니다.' })
})

// API 응답은 어디에도 캐시되면 안 됩니다. (투표 명단 CSV 같은 것들)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, max-age=0')
  next()
})

app.use('/api/admin', adminRouter)
app.use('/api/auth', authRouter)
app.use('/api/state', stateRouter)
app.use('/api/teleport', teleportRouter)
app.use('/api/vote', voteRouter)

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API 주소입니다.' }))

// --------------------------------------------------------------- frontend

const startServer = async () => {
  let renderIndex

  // /index.html 로 직접 들어오면 아래 정적 미들웨어가 가공 전 원본을 그대로 내줍니다.
  // (제목이 __BC_TITLE__ 로 보이는 페이지) 항상 / 로 보내 렌더러를 거치게 합니다.
  app.use((req, res, next) => {
    if (req.path === '/index.html') return res.redirect(301, '/')
    next()
  })

  if (DEV) {
    // 개발: vite 를 미들웨어로 물고 돌아 HMR 을 그대로 씁니다. 포트도 하나로 끝납니다.
    //
    // configFile: false 가 중요합니다. vite 가 설정 파일을 직접 읽으면 프로젝트 폴더에
    // vite.config.js.timestamp-*.mjs 임시 파일을 만들었다 지우는데, 그 생성·삭제를
    // `node --watch` 가 코드 변경으로 오해해서 서버가 무한히 재시작합니다.
    // 설정 객체를 직접 넘겨 그 왕복 자체를 없앱니다.
    const { createServer } = await import('vite')
    const { default: viteConfig } = await import('../../vite.config.js')
    const vite = await createServer({
      ...viteConfig,
      configFile: false,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    renderIndex = async (url) => {
      const template = await readFile(path.join(ROOT, 'index.html'), 'utf-8')
      return renderHtml(await vite.transformIndexHtml(url, template))
    }
  } else {
    const dist = path.join(ROOT, 'dist')
    // 파일명에 해시가 붙는 번들만 오래 캐시합니다. index.html 은 아래에서 따로 처리합니다.
    app.use(
      '/assets',
      express.static(path.join(dist, 'assets'), {
        immutable: true,
        maxAge: '1y',
        index: false,
      }),
    )
    app.use(express.static(dist, { index: false, maxAge: '1h' }))

    const template = await readFile(path.join(dist, 'index.html'), 'utf-8')
    renderIndex = async () => renderHtml(template)
  }

  // 나머지 주소는 전부 SPA 로 넘깁니다.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    try {
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.send(await renderIndex(req.originalUrl))
    } catch (err) {
      next(err)
    }
  })

  app.use((err, req, res, next) => {
    console.error('[server]', err)
    if (res.headersSent) return next(err)
    res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  })

  app.listen(PORT, HOST, () => {
    console.log(`[buildcontest] ${DEV ? '개발' : '운영'} 서버 http://${HOST}:${PORT}`)
    console.log(`[buildcontest] 데이터 폴더: ${DATA_DIR}`)
    if (PUBLIC_ORIGIN) console.log(`[buildcontest] 공개 주소: ${PUBLIC_ORIGIN.origin}`)
    if (!trustProxy && PUBLIC_ORIGIN?.origin.startsWith('https://')) {
      console.warn(
        '[buildcontest] 주의: HTTPS 로 서비스하는데 BUILDCONTEST_TRUST_PROXY 가 꺼져 있습니다.\n' +
          '              세션 쿠키에 Secure 가 붙지 않고, 로그인 시도 제한이 접속자별로 계산되지 않습니다.',
      )
    }
    if (!getConfig().setupComplete) {
      console.log(`[buildcontest] http://localhost:${PORT}/admin 에서 관리자 비밀번호를 정해주세요.`)
    }
    // 첫 텔레포트가 봇 로그인 시간을 기다리지 않도록 미리 붙여둡니다.
    ensureBot().catch((err) => console.error('[bot] 초기 로그인 실패:', err.message))
  })
}

startServer().catch((err) => {
  console.error('[buildcontest] 서버를 시작하지 못했습니다:', err)
  process.exit(1)
})
