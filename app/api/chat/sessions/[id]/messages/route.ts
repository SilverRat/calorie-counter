export const runtime = 'edge';

export async function GET() {
  return new Response(JSON.stringify({ messages: [], nextCursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
}

