"use client";
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.scss'

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), [])
  const router = useRouter()

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) router.replace('/chat')
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
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        onlyThirdPartyProviders={false}
        showLinks={true}
      />
      <p style={{ marginTop: 12 }}>After signing in, you will be redirected to <a href="/chat">Chat</a>.</p>
    </section>
  )
}
