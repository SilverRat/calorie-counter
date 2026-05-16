"use client";

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.scss'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    }).catch(() => null)
    setPending(false)

    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError(body?.error || 'Sign in failed')
      return
    }

    router.replace('/chat')
    router.refresh()
  }

  return (
    <section className={styles.wrap}>
      <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
        </label>
        {error ? <p className={styles.muted} role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>{pending ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}{' '}
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </section>
  )
}
