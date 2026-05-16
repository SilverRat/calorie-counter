import { query, type DbRow } from '@/lib/mysql'

export const runtime = 'nodejs'

interface PromptRow extends DbRow {
  id: string
  name: string
  version: number
  system_text: string
  metadata_json: any
}

export async function GET() {
  const rows = await query<PromptRow[]>('select id, name, version, system_text, metadata_json from prompts where is_active = true limit 1')
  const prompt = rows[0]
  if (!prompt) {
    return Response.json({ id: null, name: process.env.PROMPT_NAME ?? 'main', version: Number(process.env.PROMPT_VERSION ?? 1), system_text: null })
  }
  if (typeof prompt.metadata_json === 'string') prompt.metadata_json = JSON.parse(prompt.metadata_json)
  return Response.json(prompt)
}
