export const runtime = 'edge';

export async function GET() {
  // TODO: fetch active prompt from Supabase
  return new Response(
    JSON.stringify({ id: null, name: process.env.PROMPT_NAME ?? 'main', version: Number(process.env.PROMPT_VERSION ?? 1), system_text: null }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

