import './globals.css'
import { getConfig, contestTitle } from '@/lib/config.js'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const config = getConfig()
  return {
    title: contestTitle(config),
    description: config.contest.tagline,
    icons: { icon: config.contest.logoUrl || '/logo.png' },
  }
}

export default function RootLayout({ children }) {
  const { contest } = getConfig()
  return (
    <html lang="ko">
      <body style={{ '--accent': contest.accent || '#c9873b' }}>{children}</body>
    </html>
  )
}
