import { clearSession } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST() {
  await clearSession()
  return Response.json({ signedOut: true })
}
