import { getConfig } from '@/lib/config.js'
import { isAdmin } from '@/lib/session.js'
import { json, handler } from '@/lib/http.js'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const config = getConfig()
  return json({ setupComplete: config.setupComplete, authenticated: await isAdmin() })
})
