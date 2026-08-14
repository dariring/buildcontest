import { requireAdmin, guarded, json, fail, body } from '@/lib/http.js'
import { createParticipant, listParticipants, reorderParticipants } from '@/lib/contest.js'

export const dynamic = 'force-dynamic'

export const GET = guarded(async () => {
  await requireAdmin()
  return json({ participants: listParticipants({ includeHidden: true }) })
})

export const POST = guarded(async (req) => {
  await requireAdmin()
  const input = await body(req)
  if (!String(input.title ?? '').trim()) return fail('건축물 제목을 입력해주세요.')
  const participant = createParticipant(input)
  return json({ ok: true, participant, participants: listParticipants({ includeHidden: true }) })
})

// 순서 변경
export const PUT = guarded(async (req) => {
  await requireAdmin()
  const { ids } = await body(req)
  if (!Array.isArray(ids)) return fail('ids 배열이 필요합니다.')
  return json({ ok: true, participants: reorderParticipants(ids.map(String)) })
})
