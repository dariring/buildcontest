// 아주 작은 인메모리 레이트 리미터.
//
// 단일 프로세스 자체 호스팅을 전제로 합니다. 여러 인스턴스를 띄우면
// 인스턴스마다 따로 세므로, 그때는 앞단(리버스 프록시)에서 한 번 더 막아주세요.
const buckets = new Map()

function prune(hits, windowMs, now) {
  // 창 밖으로 나간 기록은 버립니다.
  let i = 0
  while (i < hits.length && now - hits[i] >= windowMs) i += 1
  return i ? hits.slice(i) : hits
}

/**
 * 시도를 한 번 기록하고 남은 허용량을 알려줍니다.
 * @returns {{ ok: boolean, retryAfter: number }} retryAfter 는 초 단위.
 */
export function hit(bucket, key, { limit, windowMs }) {
  const now = Date.now()
  const map = buckets.get(bucket) ?? new Map()
  buckets.set(bucket, map)

  const hits = prune(map.get(key) ?? [], windowMs, now)

  if (hits.length >= limit) {
    map.set(key, hits)
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) }
  }

  hits.push(now)
  map.set(key, hits)

  // 오래 켜둔 서버에서 키가 무한히 쌓이지 않도록 가끔 청소합니다.
  if (map.size > 1000) {
    for (const [k, v] of map) if (prune(v, windowMs, now).length === 0) map.delete(k)
  }

  return { ok: true, retryAfter: 0 }
}

/** 성공했을 때 그 키의 실패 기록을 지웁니다. */
export function reset(bucket, key) {
  buckets.get(bucket)?.delete(key)
}

/**
 * 요청자 식별용 키.
 * express 의 'trust proxy' 를 켜 두었을 때만 req.ip 가 x-forwarded-for 를 따라갑니다.
 * 프록시 없이 노출된 서버에서 이 헤더를 그대로 믿으면 헤더만 바꿔가며 제한을 우회할 수 있으므로,
 * 신뢰 설정은 BUILDCONTEST_TRUST_PROXY 로 명시할 때만 켭니다. (src/server/index.js)
 */
export function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}
