import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export const runtime = 'edge'

export async function POST() {
  const supabase = getSupabaseServer()
  await supabase.auth.signOut()
  return NextResponse.json({ signedOut: true })
}

