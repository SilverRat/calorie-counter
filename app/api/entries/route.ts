import { NextRequest } from 'next/server'
import { execute, mysqlDate, query, uuid, type DbRow } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'
import { addEntrySchema, rangeSchema } from '@/lib/validation'

export const runtime = 'nodejs'

interface EntryRow extends DbRow {
  id: string
  occurred_at: Date
  meal_type: string
  item_name: string
  calories: number
  protein: number | null
  carbs: number | null
  fat: number | null
  source: string
  confidence: number | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

function serializeEntry(row: EntryRow) {
  return {
    ...row,
    occurred_at: new Date(row.occurred_at).toISOString(),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString()
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const parse = rangeSchema.safeParse({ from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined })
  if (!parse.success) return Response.json({ error: 'invalid_range' }, { status: 400 })

  const where = ['user_id = ?']
  const params: unknown[] = [user.id]
  if (parse.data.from) {
    where.push('occurred_at >= ?')
    params.push(mysqlDate(parse.data.from))
  }
  if (parse.data.to) {
    where.push('occurred_at <= ?')
    params.push(mysqlDate(parse.data.to))
  }

  const rows = await query<EntryRow[]>(
    `select * from food_entries where ${where.join(' and ')} order by occurred_at desc`,
    params
  )
  return Response.json({ entries: rows.map(serializeEntry) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = addEntrySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const id = uuid()
  await execute(
    `insert into food_entries
      (id, user_id, occurred_at, meal_type, item_name, calories, protein, carbs, fat, source, confidence, notes)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, ?)`,
    [
      id,
      user.id,
      mysqlDate(parsed.data.occurred_at),
      parsed.data.meal_type,
      parsed.data.item_name,
      parsed.data.calories,
      parsed.data.protein ?? null,
      parsed.data.carbs ?? null,
      parsed.data.fat ?? null,
      parsed.data.confidence ?? null,
      parsed.data.notes ?? null
    ]
  )
  return Response.json({ id }, { status: 201 })
}
