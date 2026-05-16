import { mysqlDate, query, type DbRow } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

interface SummaryRow extends DbRow {
  occurred_at: Date
  calories: number
  protein: number | null
  carbs: number | null
  fat: number | null
  meal_type: string
}

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d }

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStart = startOfDay(now)
  const d30 = new Date(now); d30.setDate(now.getDate() - 29); const last30Start = startOfDay(d30)

  const data = await query<SummaryRow[]>(
    `select occurred_at, calories, protein, carbs, fat, meal_type
     from food_entries
     where user_id = ? and occurred_at >= ? and occurred_at <= ?
     order by occurred_at asc`,
    [user.id, mysqlDate(last30Start), mysqlDate(now)]
  )

  const today = { totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, byMeal: [] as { meal_type: string; calories: number }[] }
  const byDay = new Map<string, number>()
  const byDayMacros = new Map<string, { protein: number; carbs: number; fat: number }>()

  for (const row of data) {
    const dt = new Date(row.occurred_at)
    const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toISOString()
    byDay.set(key, (byDay.get(key) || 0) + (row.calories || 0))
    byDayMacros.set(key, {
      protein: (byDayMacros.get(key)?.protein || 0) + (row.protein || 0),
      carbs: (byDayMacros.get(key)?.carbs || 0) + (row.carbs || 0),
      fat: (byDayMacros.get(key)?.fat || 0) + (row.fat || 0)
    })
    if (dt >= todayStart) {
      today.totals.calories += row.calories || 0
      today.totals.protein += row.protein || 0
      today.totals.carbs += row.carbs || 0
      today.totals.fat += row.fat || 0
    }
  }

  const series = (days: number) => {
    const arr: { date: string; calories: number }[] = []
    const start = new Date(now); start.setDate(now.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
      arr.push({ date: key, calories: byDay.get(key) || 0 })
    }
    return arr
  }

  return Response.json({ today, last7d: series(7), last30d: series(30) })
}
