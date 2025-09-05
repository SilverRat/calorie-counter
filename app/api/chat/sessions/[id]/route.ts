import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  return new Response(JSON.stringify({ updated: false, id: params.id }), { status: 501, headers: { 'content-type': 'application/json' } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return new Response(null, { status: 501 });
}

