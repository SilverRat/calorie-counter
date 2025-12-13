import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return new Response(JSON.stringify({ updated: false, id }), { status: 501, headers: { 'content-type': 'application/json' } });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await context.params;
  return new Response(null, { status: 501 });
}
