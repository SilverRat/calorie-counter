"use client";
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.scss'

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), [])
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    // Clear any stale session on page load to avoid accidental auto-login
    supabase.auth.signOut().finally(async () => {
      if (!active) return
      const { data } = await supabase.auth.getSession()
      if (data.session) router.replace('/chat')
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/chat')
      }
    })

    return () => {
      active = false
      listener?.subscription.unsubscribe()
    }
  }, [router, supabase])

  return (
    <section className={styles.wrap}>
      <h1>Sign in</h1>
      {ready ? (
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          onlyThirdPartyProviders={false}
          showLinks={true}
        />
      ) : (
        <p className={styles.muted}>Preparing sign-in…</p>
      )}
      <p style={{ marginTop: 12 }}>After signing in, you will be redirected to <a href="/chat">Chat</a>.</p>
    </section>
  )
}
