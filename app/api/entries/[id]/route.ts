import { NextRequest } from 'next/server'
import { execute, mysqlDate } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'
import { updateEntrySchema } from '@/lib/validation'

export const runtime = 'nodejs'

const columnMap: Record<string, string> = {
  occurred_at: 'occurred_at',
  meal_type: 'meal_type',
  item_name: 'item_name',
  calories: 'calories',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
  notes: 'notes'
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = updateEntrySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(parsed.data)) {
    const column = columnMap[key]
    if (!column) continue
    sets.push(`${column} = ?`)
    params.push(key === 'occurred_at' && typeof value === 'string' ? mysqlDate(value) : value)
  }
  params.push(id, user.id)

  const result = await execute(
    `update food_entries set ${sets.join(', ')} where id = ? and user_id = ?`,
    params
  )
  return Response.json({ updated: result.affectedRows > 0 })
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  await execute('delete from food_entries where id = ? and user_id = ?', [id, user.id])
  return new Response(null, { status: 204 })
}
