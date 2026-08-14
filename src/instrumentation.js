// 주의: Next 는 이 파일을 Node 런타임과 edge 런타임 양쪽으로 컴파일합니다.
// process.env.NEXT_RUNTIME 검사 안쪽에 있어도 번들러는 import 를 따라가므로,
// Node 전용 패키지(discord.js 등)를 여기서 불러오면 edge 컴파일이 깨집니다.
// 봇 기동은 src/lib/warm.js 가 첫 API 요청 때 대신 처리합니다.
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const port = process.env.PORT || 3000
  console.log(`[buildcontest] http://localhost:${port}/admin 에서 설정하세요.`)
}
