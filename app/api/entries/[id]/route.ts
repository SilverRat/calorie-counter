import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { updateEntrySchema } from '@/lib/validation'

export const runtime = 'edge'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 }) }
  const parsed = updateEntrySchema.safeParse(body)
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 })
  const { error } = await supabase.from('food_entries').update(parsed.data).eq('id', id).eq('user_id', userId)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify({ updated: true }), { status: 200, headers: { 'content-type': 'application/json' } })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  const { error } = await supabase.from('food_entries').delete().eq('id', id).eq('user_id', userId)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(null, { status: 204 })
}
