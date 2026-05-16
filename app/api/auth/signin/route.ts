import { NextRequest } from 'next/server'
import { authenticateUser, setSession } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 400 })

  const user = await authenticateUser(email, password)
  if (!user) return Response.json({ error: 'Invalid email or password' }, { status: 401 })

  await setSession(user.id)
  return Response.json({ user: { id: user.id, email: user.email } })
}
