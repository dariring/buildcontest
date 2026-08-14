// Discord <-> Minecraft 연동 확인.
//
// 참고한 connect.js 의 라우터는 x-admin-key 헤더를 요구하고,
//   POST /api/connectcheck  { discordid }  -> { uuid }
//   POST /api/uuidcheck     { uuid }       -> { discordid }
// 두 방향을 모두 제공합니다. 디스코드 로그인으로 시작하므로 기본값은
// connectcheck 이지만, 어드민에서 경로를 바꿀 수 있게 열어두었습니다.
import { getConfig } from './config.js'

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`
}

// 연동에 성공한 결과만 잠깐 캐시합니다. 실패/미연동은 캐시하지 않아야
// "연동하고 왔어요, 다시 확인" 이 바로 반영됩니다.
const HIT_TTL = 60_000
const hits = (globalThis.__bcLinkCache ??= new Map())

export function clearLinkCache(discordId) {
  if (discordId) hits.delete(String(discordId))
  else hits.clear()
}

/**
 * @returns {Promise<{ linked: boolean, uuid: string|null, error: string|null }>}
 */
export async function checkLink(discordId) {
  const { link } = getConfig()
  if (!link.enabled) return { linked: true, uuid: null, error: null }
  if (!link.baseUrl) return { linked: false, uuid: null, error: '연동 API 주소가 설정되지 않았습니다.' }

  const key = String(discordId)
  const cached = hits.get(key)
  if (cached && Date.now() - cached.at < HIT_TTL) return cached.result

  const url = joinUrl(link.baseUrl, link.checkPath || '/api/connectcheck')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': link.adminKey || '',
      },
      // uuidcheck 경로를 쓰는 설정도 있을 수 있으니 두 키를 함께 보냅니다.
      body: JSON.stringify({ discordid: String(discordId), discordId: String(discordId) }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (res.status === 404) return { linked: false, uuid: null, error: null }
    if (res.status === 401) return { linked: false, uuid: null, error: '연동 API 관리자 키가 올바르지 않습니다.' }
    if (!res.ok) return { linked: false, uuid: null, error: `연동 API 오류 (${res.status})` }

    const data = await res.json().catch(() => ({}))
    const uuid = data.uuid ?? data.UUID ?? data.minecraftUuid ?? null
    if (!uuid) return { linked: false, uuid: null, error: null }

    const result = { linked: true, uuid: String(uuid), error: null }
    hits.set(key, { result, at: Date.now() })
    return result
  } catch (err) {
    const reason = err.name === 'AbortError' ? '연동 API 응답 시간 초과' : `연동 API 연결 실패: ${err.message}`
    return { linked: false, uuid: null, error: reason }
  } finally {
    clearTimeout(timer)
  }
}

/** 어드민 "연결 테스트" 버튼용. */
export async function probeLinkApi(discordId) {
  clearLinkCache(discordId)
  const result = await checkLink(discordId)
  if (result.error) return { ok: false, message: result.error }
  if (!result.linked) return { ok: true, message: 'API 응답 정상 — 이 디스코드 ID는 연동되어 있지 않습니다.' }
  return { ok: true, message: `API 응답 정상 — UUID: ${result.uuid}` }
}
