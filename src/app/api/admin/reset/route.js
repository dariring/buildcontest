import { requireAdmin, guarded, json, body } from '@/lib/http.js'
import { archiveCurrent, listArchives, resetContest } from '@/lib/contest.js'
import { getConfig, saveConfig } from '@/lib/config.js'

export const dynamic = 'force-dynamic'

export const GET = guarded(async () => {
  await requireAdmin()
  return json({ archives: listArchives() })
})

export const POST = guarded(async (req) => {
  await requireAdmin()
  const {
    archive = true,
    clearVotes = true,
    clearProgress = true,
    clearParticipants = false,
    advanceMonth = true,
    clearSchedule = true,
  } = await body(req)

  const snapshot = archive ? archiveCurrent() : null
  resetContest({ clearVotes, clearProgress, clearParticipants })

  const patch = {}
  if (advanceMonth) {
    const { month, year } = getConfig().contest
    patch.contest = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
  }
  if (clearSchedule) {
    patch.vote = { startAt: '', endAt: '', manualOpen: false }
  }
  const config = Object.keys(patch).length ? saveConfig(patch) : getConfig()

  return json({
    ok: true,
    archivedId: snapshot?.id ?? null,
    contest: config.contest,
    archives: listArchives(),
  })
})
