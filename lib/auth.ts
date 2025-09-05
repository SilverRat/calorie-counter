import { NextRequest } from 'next/server'

// TEMP: until Supabase Auth is wired in the UI, we support X-User-Id header for development.
// In production with Supabase Auth, extract from a verified JWT or use @supabase/auth-helpers.
export function getUserId(req: NextRequest): string | null {
  const headerId = req.headers.get('x-user-id')
  if (headerId) {
    if (headerId === 'dev-user') {
      return process.env.DEV_USER_ID || null
    }
    return headerId
  }
  // Optional: decode JWT sub if Authorization is provided (no signature verify here)
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    try {
      const part = token.split('.')[1]
      const norm = part.replace(/-/g, '+').replace(/_/g, '/')
      const json = typeof atob === 'function' ? atob(norm) : Buffer.from(norm, 'base64').toString('utf8')
      const payload = JSON.parse(json)
      return payload.sub || payload.user_id || null
    } catch {}
  }
  return null
}
