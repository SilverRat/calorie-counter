import { clearSession, getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function HeaderAuth() {
  const user = await getCurrentUser()
  async function signOut() {
    'use server'
    await clearSession()
    redirect('/login')
  }
  return (
    <div>
      {user ? (
        <form action={signOut}><button type="submit">Sign out ({user.email})</button></form>
      ) : (
        <a href="/login">Sign in</a>
      )}
    </div>
  )
}
