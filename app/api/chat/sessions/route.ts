import { NextRequest } from 'next/server'
import { execute, query, uuid, type DbRow } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

interface SessionRow extends DbRow {
  id: string
  title: string
  created_at: Date
  updated_at: Date
  archived_at: Date | null
}

function serialize(row: SessionRow) {
  return {
    ...row,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    archived_at: row.archived_at ? new Date(row.archived_at).toISOString() : null
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await query<SessionRow[]>(
    'select id, title, created_at, updated_at, archived_at from chat_sessions where user_id = ? and archived_at is null order by updated_at desc limit 50',
    [user.id]
  )
  return Response.json(rows.map(serialize))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'New chat'
  const id = uuid()
  await execute('insert into chat_sessions (id, user_id, title) values (?, ?, ?)', [id, user.id, title])
  return Response.json({ id }, { status: 201 })
}
