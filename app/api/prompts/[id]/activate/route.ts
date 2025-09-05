export const runtime = 'nodejs';

export async function POST() {
  return new Response(JSON.stringify({ activated: false }), { status: 501, headers: { 'content-type': 'application/json' } });
}

