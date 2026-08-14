// UUID -> 마인크래프트 닉네임. CMI 명령어는 플레이어 이름을 받으므로 필요합니다.
import { read, write } from './store.js'

const TTL = 1000 * 60 * 60 * 12 // 12시간

function normalize(uuid) {
  return String(uuid).replace(/-/g, '').toLowerCase()
}

export async function resolveName(uuid) {
  if (!uuid) return null
  const key = normalize(uuid)
  const cache = read('namecache', {})
  const hit = cache[key]
  if (hit && Date.now() - hit.at < TTL) return hit.name

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${key}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return hit?.name ?? null
    const data = await res.json()
    if (!data?.name) return hit?.name ?? null
    write('namecache', { ...cache, [key]: { name: data.name, at: Date.now() } })
    return data.name
  } catch {
    // 오프라인/화이트리스트 서버라면 조회가 실패할 수 있습니다.
    // 이 경우 캐시된 값이 있으면 쓰고, 없으면 UUID 로 텔레포트를 시도합니다.
    return hit?.name ?? null
  } finally {
    clearTimeout(timer)
  }
}

/** 어드민에서 직접 닉네임을 박아 넣을 때 사용. */
export function setName(uuid, name) {
  const cache = read('namecache', {})
  write('namecache', { ...cache, [normalize(uuid)]: { name, at: Date.now() } })
}
