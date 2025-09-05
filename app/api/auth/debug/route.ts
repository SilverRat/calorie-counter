import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export const runtime = 'edge'

export async function GET() {
  const supabase = getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  const { data: sessionData } = await supabase.auth.getSession()
  return NextResponse.json({
    user: userData.user ? { id: userData.user.id, email: userData.user.email } : null,
    hasSession: !!sessionData.session,
  })
}

