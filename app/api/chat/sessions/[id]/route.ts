import { NextRequest } from 'next/server'
import { execute, mysqlDate } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : ''
  if (!title) return Response.json({ error: 'title_required' }, { status: 400 })

  const result = await execute('update chat_sessions set title = ? where id = ? and user_id = ?', [title, id, user.id])
  return Response.json({ updated: result.affectedRows > 0, id })
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  await execute('update chat_sessions set archived_at = ? where id = ? and user_id = ?', [mysqlDate(new Date()), id, user.id])
  return new Response(null, { status: 204 })
}
