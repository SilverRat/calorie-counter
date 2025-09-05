import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  // TODO: return real sessions for the user
  return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function POST(_req: NextRequest) {
  // TODO: create a new session
  return new Response(JSON.stringify({ id: 'not-implemented' }), { status: 501, headers: { 'content-type': 'application/json' } });
}

