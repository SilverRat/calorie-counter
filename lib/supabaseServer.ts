import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function getSupabaseServer() {
  const cookieStore = cookies()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase URL/Anon key missing')
  // Cast to any to avoid schema generic mismatch across library versions during build
  return createServerClient(url, anon, {
    cookies: {
      async get(name: string) {
        const store = await cookieStore
        return store.get(name)?.value
      },
      async set(name: string, value: string, options: any) {
        const store = await cookieStore
        store.set({ name, value, ...options })
      },
      async remove(name: string, options: any) {
        const store = await cookieStore
        store.set({ name, value: '', ...options })
      }
    }
  }) as any
}
