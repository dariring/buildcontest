import { requireAdmin, guarded, json, fail, body } from '@/lib/http.js'
import { deleteParticipant, listParticipants, updateParticipant } from '@/lib/contest.js'

export const dynamic = 'force-dynamic'

export const PATCH = guarded(async (req, { params }) => {
  await requireAdmin()
  const { id } = await params
  const updated = updateParticipant(id, await body(req))
  if (!updated) return fail('참가작을 찾을 수 없습니다.', 404)
  return json({ ok: true, participant: updated, participants: listParticipants({ includeHidden: true }) })
})

export const DELETE = guarded(async (req, { params }) => {
  await requireAdmin()
  const { id } = await params
  deleteParticipant(id)
  return json({ ok: true, participants: listParticipants({ includeHidden: true }) })
})
