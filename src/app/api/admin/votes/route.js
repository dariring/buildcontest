import { requireAdmin, guarded, json, body } from '@/lib/http.js'
import { getVotes, tally, deleteVote, listParticipants, votingWindow } from '@/lib/contest.js'
import { getConfig } from '@/lib/config.js'

export const dynamic = 'force-dynamic'

export const GET = guarded(async (req) => {
  await requireAdmin()
  const url = new URL(req.url)

  const votes = Object.values(getVotes()).sort((a, b) => b.submittedAt - a.submittedAt)
  const participants = listParticipants({ includeHidden: true })
  const titles = new Map(participants.map((p) => [p.id, p.title]))
  const summary = tally()

  if (url.searchParams.get('format') === 'csv') {
    const header = ['디스코드ID', '디스코드이름', '마인크래프트', '선택1', '선택2', '선택3', '제출시각']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [header.map(escape).join(',')]
    for (const v of votes) {
      lines.push(
        [
          v.discordId,
          v.displayName,
          v.mcName || v.uuid || '',
          ...[0, 1, 2].map((i) => titles.get(v.picks[i]) ?? ''),
          new Date(v.submittedAt).toLocaleString('ko-KR'),
        ]
          .map(escape)
          .join(','),
      )
    }
    return new Response('﻿' + lines.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="votes-${Date.now()}.csv"`,
      },
    })
  }

  return json({
    votes: votes.map((v) => ({ ...v, pickTitles: v.picks.map((id) => titles.get(id) ?? '(삭제됨)') })),
    summary,
    voting: votingWindow(getConfig()),
  })
})

export const DELETE = guarded(async (req) => {
  await requireAdmin()
  const { discordId } = await body(req)
  deleteVote(String(discordId))
  return json({ ok: true, summary: tally() })
})
