import { getSupabaseServer } from '@/lib/supabaseServer'

export default async function HeaderAuth() {
  const supabase = getSupabaseServer()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  async function signOut() {
    'use server'
    const supa = getSupabaseServer()
    await supa.auth.signOut()
  }
  return (
    <div>
      {email ? (
        <form action={signOut}><button type="submit">Sign out ({email})</button></form>
      ) : (
        <a href="/login">Sign in</a>
      )}
    </div>
  )
}

