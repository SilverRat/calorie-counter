import { query, type DbRow } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

interface MessageRow extends DbRow {
  id: string
  session_id: string
  role: string
  content: string
  has_image: number
  tool_name: string | null
  tool_args_json: any
  tool_result_json: any
  created_at: Date
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await query<MessageRow[]>(
    `select m.*
     from chat_messages m
     inner join chat_sessions s on s.id = m.session_id
     where m.session_id = ? and s.user_id = ?
     order by m.created_at asc
     limit 100`,
    [id, user.id]
  )

  return Response.json({
    messages: rows.map((row) => ({
      ...row,
      has_image: !!row.has_image,
      tool_args_json: typeof row.tool_args_json === 'string' ? JSON.parse(row.tool_args_json) : row.tool_args_json,
      tool_result_json: typeof row.tool_result_json === 'string' ? JSON.parse(row.tool_result_json) : row.tool_result_json,
      created_at: new Date(row.created_at).toISOString()
    })),
    nextCursor: null
  })
}
