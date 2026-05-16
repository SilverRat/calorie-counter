import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = ['/chat', '/dashboard', '/test']

export function middleware(req: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) => req.nextUrl.pathname.startsWith(prefix))
  if (!isProtected) return NextResponse.next()
  if (req.cookies.get('cc_session')?.value) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'
  ]
}
