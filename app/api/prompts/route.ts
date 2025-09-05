import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  // Admin-only in future; stubbed for now
  return new Response(JSON.stringify({ created: false }), { status: 501, headers: { 'content-type': 'application/json' } });
}

