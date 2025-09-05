import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export const runtime = 'edge'

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d }
function toISO(d: Date) { return new Date(d).toISOString() }

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })

  const now = new Date()
  const todayStart = startOfDay(now)
  const d7 = new Date(now); d7.setDate(now.getDate() - 6); const last7Start = startOfDay(d7) // include today => 7 days
  const d30 = new Date(now); d30.setDate(now.getDate() - 29); const last30Start = startOfDay(d30)

  const { data, error } = await supabase
    .from('food_entries')
    .select('occurred_at, calories, protein, carbs, fat, meal_type')
    .eq('user_id', userId)
    .gte('occurred_at', toISO(last30Start))
    .lte('occurred_at', toISO(now))
    .order('occurred_at', { ascending: true })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const today = { totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, byMeal: [] as { meal_type: string; calories: number }[] }
  const byDay = new Map<string, number>()
  const byDayMacros = new Map<string, { protein: number; carbs: number; fat: number }>()

  for (const row of data || []) {
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

  // Fill last 7 and last 30 series (daily calories)
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

  const payload = {
    today,
    last7d: series(7),
    last30d: series(30)
  }

  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
}
