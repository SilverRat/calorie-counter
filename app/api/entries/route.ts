import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { addEntrySchema, rangeSchema } from '@/lib/validation'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })

  const url = new URL(req.url)
  const parse = rangeSchema.safeParse({ from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined })
  if (!parse.success) return new Response(JSON.stringify({ error: 'invalid_range' }), { status: 400 })

  const from = parse.data.from
  const to = parse.data.to
  let query = supabase.from('food_entries').select('*').eq('user_id', userId).order('occurred_at', { ascending: false })
  if (from) query = query.gte('occurred_at', from)
  if (to) query = query.lte('occurred_at', to)
  const { data, error } = await query
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify({ entries: data }), { status: 200, headers: { 'content-type': 'application/json' } })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 }) }
  const parsed = addEntrySchema.safeParse(body)
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 })
  const { data, error } = await supabase.from('food_entries').insert([{ ...parsed.data, user_id: userId }]).select('id').single()
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify({ id: data?.id }), { status: 201, headers: { 'content-type': 'application/json' } })
}
