import { cookies } from 'next/headers'
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { execute, query, uuid, type DbRow } from './mysql'

const cookieName = 'cc_session'
const maxAgeSeconds = 60 * 60 * 24 * 30

export interface CurrentUser {
  id: string
  email: string
  role: string
}

interface UserRow extends DbRow {
  id: string
  email: string
  password_hash: string
  role: string
}

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function verifySigned(value: string) {
  const [payload, sig] = value.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return payload
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url')
  const hash = pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('base64url')
  return `pbkdf2_sha256$210000$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, iterationsRaw, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2_sha256' || !iterationsRaw || !salt || !hash) return false
  const iterations = Number(iterationsRaw)
  const candidate = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url')
  const a = Buffer.from(candidate)
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function createUser(email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  const id = uuid()
  await execute(
    'insert into users (id, email, password_hash) values (?, ?, ?)',
    [id, normalized, hashPassword(password)]
  )
  return { id, email: normalized, role: 'user' }
}

export async function authenticateUser(email: string, password: string) {
  const rows = await query<UserRow[]>(
    'select id, email, password_hash, role from users where email = ? limit 1',
    [email.trim().toLowerCase()]
  )
  const user = rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) return null
  return { id: user.id, email: user.email, role: user.role }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies()
  const raw = store.get(cookieName)?.value
  if (!raw) return null
  const payload = verifySigned(raw)
  if (!payload) return null

  let parsed: { id?: string; exp?: number }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!parsed.id || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null

  const rows = await query<UserRow[]>(
    'select id, email, password_hash, role from users where id = ? limit 1',
    [parsed.id]
  )
  const user = rows[0]
  return user ? { id: user.id, email: user.email, role: user.role } : null
}

export async function setSession(userId: string) {
  const store = await cookies()
  const payload = Buffer.from(JSON.stringify({
    id: userId,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  })).toString('base64url')
  store.set(cookieName, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds
  })
}

export async function clearSession() {
  const store = await cookies()
  store.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  })
}
