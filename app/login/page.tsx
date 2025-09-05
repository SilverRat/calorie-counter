"use client";
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useMemo } from 'react'
import styles from './page.module.scss'

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), [])
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
      <p style={{ marginTop: 12 }}>After signing in, go to <a href="/dashboard">Dashboard</a>.</p>
    </section>
  )
}
