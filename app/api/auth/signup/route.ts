import { NextRequest } from 'next/server'
import { createUser, setSession } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  try {
    const user = await createUser(email, password)
    await setSession(user.id)
    return Response.json({ user: { id: user.id, email: user.email } }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return Response.json({ error: 'That email is already registered' }, { status: 409 })
    throw err
  }
}
