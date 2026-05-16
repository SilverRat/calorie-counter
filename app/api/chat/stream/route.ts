import { NextRequest } from 'next/server'
import { execute, jsonParam, mysqlDate, query, uuid, type DbRow } from '@/lib/mysql'
import { getCurrentUser } from '@/lib/session'
import { addEntrySchema, rangeSchema, updateEntryToolSchema } from '@/lib/validation'

export const runtime = 'nodejs'

function sse(send: (event: string, data: unknown) => void) {
  return {
    token: (content: string) => send('token', { content }),
    toolCall: (name: string, args: unknown) => send('tool_call', { name, arguments: args }),
    toolResult: (name: string, result: unknown) => send('tool_result', { name, result }),
    message: (payload: any) => send('message', payload),
    done: (payload: any) => send('done', payload),
    error: (code: string, message: string) => send('error', { code, message })
  }
}

function b64FromArrayBuffer(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
  // Edge provides btoa
  // @ts-ignore
  return btoa(binary)
}

function normalizeDateTime(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let v = input.trim()
  if (!v) return null
  // If missing seconds (YYYY-MM-DDTHH:mm), add :00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += ':00'
  // If missing timezone info, default to Z (UTC) for MVP
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(v)) v += 'Z'
  return v
}

function hasExplicitDateTime(userText: string): boolean {
  if (!userText) return false
  const re = /(\b(yesterday|today|tomorrow)\b|\b(on\s+)?(mon|tue|wed|thu|fri|sat|sun)(day)?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?\b|\b\d{1,2}:\d{2}\s?(am|pm)\b|\b(at)\s+\d{1,2}(:\d{2})?\s?(am|pm)?\b)/i
  return re.test(userText)
}

function roundInt(x: number) { return Math.max(0, Math.round(x)) }

function estimateMacroProfile(itemName: string): { p: number; c: number; f: number } {
  const s = (itemName || '').toLowerCase()
  // Protein-leaning keywords
  if (/(chicken|turkey|beef|steak|pork|fish|salmon|tuna|egg|shrimp|yogurt|greek)/.test(s)) return { p: 0.30, c: 0.30, f: 0.40 }
  // Carb-leaning
  if (/(rice|pasta|noodles|bread|toast|bagel|oatmeal|cereal|banana|potato|fries|tortilla|pizza)/.test(s)) return { p: 0.15, c: 0.60, f: 0.25 }
  // Fat-leaning
  if (/(avocado|nuts|almond|peanut|walnut|cheese|bacon|butter|oil|dressing)/.test(s)) return { p: 0.20, c: 0.25, f: 0.55 }
  // Balanced default
  return { p: 0.25, c: 0.50, f: 0.25 }
}

function deriveMacrosIfMissing(calories: number, itemName: string, macros: { protein?: number; carbs?: number; fat?: number }) {
  const cal = Math.max(0, Number(calories) || 0)
  let { protein, carbs, fat } = macros
  const haveP = typeof protein === 'number' && protein >= 0
  const haveC = typeof carbs === 'number' && carbs >= 0
  const haveF = typeof fat === 'number' && fat >= 0
  if (haveP && haveC && haveF) return { protein, carbs, fat }
  // Use profile for missing ones
  const prof = estimateMacroProfile(itemName)
  let pCal = haveP ? (protein as number) * 4 : cal * prof.p
  let cCal = haveC ? (carbs as number) * 4 : cal * prof.c
  let fCal = haveF ? (fat as number) * 9 : cal * prof.f
  // Normalize to target calories
  const totalCal = Math.max(1, pCal + cCal + fCal)
  const scale = cal / totalCal
  pCal *= scale; cCal *= scale; fCal *= scale
  let pG = haveP ? (protein as number) : pCal / 4
  let cG = haveC ? (carbs as number) : cCal / 4
  let fG = haveF ? (fat as number) : fCal / 9
  // Round and fix small energy drift by adjusting carbs
  let P = roundInt(pG), C = roundInt(cG), F = roundInt(fG)
  const drift = cal - (P * 4 + C * 4 + F * 9)
  if (Math.abs(drift) >= 4) {
    C = roundInt(C + drift / 4)
  }
  return { protein: P, carbs: Math.max(0, C), fat: F }
}

interface PromptRow extends DbRow {
  system_text: string
  metadata_json: any
}

interface MessageRow extends DbRow {
  id: string
  role: string
  content: string
  created_at: Date
}

async function getActivePrompt() {
  const rows = await query<PromptRow[]>('select * from prompts where is_active = true limit 1')
  const prompt = rows[0]
  if (prompt && typeof prompt.metadata_json === 'string') prompt.metadata_json = JSON.parse(prompt.metadata_json)
  return prompt
}

function fillPrompt(system_text: string, vars: Record<string, string | number | boolean>) {
  return system_text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(vars[k] ?? ''))
}

function openAiToolSchemas() {
  return [
    {
      type: 'function',
      function: {
        name: 'add_food_entry',
        description: 'Create a new food entry',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['occurred_at', 'meal_type', 'item_name', 'calories'],
          properties: {
            occurred_at: { type: 'string', format: 'date-time' },
            meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] },
            item_name: { type: 'string', minLength: 1, maxLength: 160 },
            calories: { type: 'integer', minimum: 0, maximum: 5000 },
            protein: { type: 'integer', minimum: 0, maximum: 500 },
            carbs: { type: 'integer', minimum: 0, maximum: 1000 },
            fat: { type: 'integer', minimum: 0, maximum: 500 },
            notes: { type: 'string', maxLength: 500 },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_food_entry',
        description: 'Update an existing food entry by id',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['id','fields'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            fields: {
              type: 'object',
              additionalProperties: false,
              properties: {
                occurred_at: { type: 'string', format: 'date-time' },
                meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] },
                item_name: { type: 'string', minLength: 1, maxLength: 160 },
                calories: { type: 'integer', minimum: 0, maximum: 5000 },
                protein: { type: 'integer', minimum: 0, maximum: 500 },
                carbs: { type: 'integer', minimum: 0, maximum: 1000 },
                fat: { type: 'integer', minimum: 0, maximum: 500 },
                notes: { type: 'string', maxLength: 500 }
              }
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_entries',
        description: 'List entries in a date range',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_food_entry',
        description: 'Delete an entry by id',
        parameters: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }
      }
    }
  ]
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const out = sse(send)
      try {
        const user = await getCurrentUser()
        if (!user) { out.error('unauthorized', 'Sign in required'); controller.close(); return }

        const form = await req.formData().catch(() => null)
        if (!form) { out.error('bad_request', 'Expected multipart/form-data'); controller.close(); return }
        const payloadStr = form.get('payload') as string | null
        if (!payloadStr) { out.error('bad_request', 'Missing payload'); controller.close(); return }
        let payload: any
        try { payload = JSON.parse(payloadStr) } catch { out.error('bad_request', 'Invalid payload JSON'); controller.close(); return }

        const text = payload?.message?.content?.toString?.() || ''
        const files: File[] = []
        for (const [key, val] of form.entries()) {
          if (key !== 'payload' && val instanceof File && val.size > 0) files.push(val)
        }

        // Ensure/resolve session
        let sessionId: string | null = null
        if (payload.session_id) {
          const rows = await query<DbRow[]>('select id from chat_sessions where id = ? and user_id = ? limit 1', [payload.session_id, user.id])
          if (rows[0]?.id) sessionId = rows[0].id
        }
        if (!sessionId) {
          const title = (text || 'New chat').slice(0, 80)
          sessionId = uuid()
          await execute('insert into chat_sessions (id, user_id, title) values (?, ?, ?)', [sessionId, user.id, title])
        }

        // Persist user message
        const userMessageId = uuid()
        await execute(
          'insert into chat_messages (id, session_id, user_id, role, content, has_image) values (?, ?, ?, ?, ?, ?)',
          [userMessageId, sessionId, user.id, 'user', text || '', files.length > 0]
        )
        const [umsg] = await query<MessageRow[]>('select id, created_at from chat_messages where id = ? limit 1', [userMessageId])

        // Fetch brief history (prior to this user message) to maintain context for confirmations
        const historyRows = await query<MessageRow[]>(
          `select role, content, created_at
           from chat_messages
           where session_id = ? and created_at < ?
           order by created_at asc
           limit 20`,
          [sessionId, umsg.created_at]
        )

        // Build system prompt
        const activePrompt = await getActivePrompt()
        const nowUtc = new Date()
        const tzName = (payload?.context?.timezone || '') as string
        // Compute a YYYY-MM-DD string in the user's timezone (best-effort)
        let todayUserDate = ''
        try {
          if (tzName) {
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tzName, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(nowUtc)
            const y = parts.find(p => p.type === 'year')?.value
            const m = parts.find(p => p.type === 'month')?.value
            const d = parts.find(p => p.type === 'day')?.value
            if (y && m && d) todayUserDate = `${y}-${m}-${d}`
          }
        } catch {}
        const systemText = activePrompt ? fillPrompt(activePrompt.system_text, {
          app_name: 'Calorie Counter',
          units_pref: payload?.context?.units || 'metric',
          clarification_threshold: (activePrompt.metadata_json?.clarification_threshold ?? 0.7),
          now_utc: nowUtc.toISOString(),
          user_timezone: tzName || 'UTC',
          today_user_date: todayUserDate
        }) : 'You are a calorie-tracking assistant.'

        // Build OpenAI messages with short history to preserve context for confirmations
        const userParts: any[] = []
        if (text) userParts.push({ type: 'text', text })
        for (const f of files.slice(0, 2)) {
          const mime = f.type
          if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue
          const ab = await f.arrayBuffer()
          const b64 = b64FromArrayBuffer(ab)
          userParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
        }

        const historyMessages = (historyRows || []).map((h: { role: string; content?: string }) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content || ''
        }))

        const messages: any[] = [
          { role: 'system', content: systemText },
          ...historyMessages,
          { role: 'user', content: userParts.length ? userParts : text }
        ]

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) { out.error('llm_not_configured', 'OPENAI_API_KEY not set'); out.done({ finish_reason: 'error' }); controller.close(); return }

        // First call: only allow tools when the user explicitly confirms saving
        const tools = openAiToolSchemas()
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
        const allowTools = /\b(save|log it|add it|record it|confirm(ed)?|looks good|ok(ay)?|yes)\b/i.test(text)
        const r1 = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, tools, tool_choice: allowTools ? 'auto' : 'none' })
        })
        if (!r1.ok) {
          const err = await r1.text()
          out.error('llm_error', err.slice(0, 500))
          out.done({ finish_reason: 'error' })
          controller.close()
          return
        }
        const j1 = await r1.json()
        const m1 = j1.choices?.[0]?.message

        // Handle tool call if any
        let finalAssistantText = ''
        if (m1?.tool_calls && Array.isArray(m1.tool_calls) && m1.tool_calls.length > 0) {
          for (const tc of m1.tool_calls) {
            const name = tc.function?.name
            let args: any = {}
            try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}
            out.toolCall(name, args)
            // Execute tool
            let result: any = null
            if (name === 'add_food_entry') {
              // Normalize occurred_at to RFC3339 with timezone if missing
              const normArgs = { ...args }
              if (!normArgs.occurred_at) normArgs.occurred_at = new Date().toISOString()
              else {
                const n = normalizeDateTime(normArgs.occurred_at)
                if (n) normArgs.occurred_at = n
              }
              const parsed = addEntrySchema.safeParse(normArgs)
              if (!parsed.success) { result = { error: 'invalid_args', details: parsed.error.flatten() } }
              else {
                // Sanity check: if LLM proposed a far past/future date without explicit date/time in user text, default to now
                let occurredAtISO = parsed.data.occurred_at
                try {
                  const d = new Date(occurredAtISO)
                  const now = new Date()
                  const ageDays = (now.getTime() - d.getTime()) / 86400000
                  const futureDays = (d.getTime() - now.getTime()) / 86400000
                  const explicit = hasExplicitDateTime(text)
                  if (!explicit && (ageDays > 7 || futureDays > 1)) {
                    occurredAtISO = now.toISOString()
                  }
                } catch {}

                // Derive macros if missing
                const withMacros = deriveMacrosIfMissing(parsed.data.calories, parsed.data.item_name, {
                  protein: parsed.data.protein,
                  carbs: parsed.data.carbs,
                  fat: parsed.data.fat
                })
                const row = { ...parsed.data, ...withMacros, occurred_at: occurredAtISO, user_id: user.id, source: files.length ? 'llm_image' : 'llm_text' }
                const entryId = uuid()
                await execute(
                  `insert into food_entries
                    (id, user_id, occurred_at, meal_type, item_name, calories, protein, carbs, fat, source, confidence, notes)
                   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [entryId, user.id, mysqlDate(row.occurred_at), row.meal_type, row.item_name, row.calories, row.protein, row.carbs, row.fat, row.source, row.confidence ?? null, row.notes ?? null]
                )
                result = { id: entryId, occurred_at: occurredAtISO, meal_type: row.meal_type, item_name: row.item_name, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat }
                // Persist tool message
                await execute(
                  'insert into chat_messages (id, session_id, user_id, role, content, tool_name, tool_args_json, tool_result_json) values (?, ?, ?, ?, ?, ?, ?, ?)',
                  [uuid(), sessionId, user.id, 'tool', '', name, jsonParam(parsed.data), jsonParam(result)]
                )
              }
            } else if (name === 'update_food_entry') {
              const parsed = updateEntryToolSchema.safeParse(args)
              if (!parsed.success) { result = { error: 'invalid_args', details: parsed.error.flatten() } }
              else {
                const sets: string[] = []
                const params: unknown[] = []
                for (const [key, value] of Object.entries(parsed.data.fields)) {
                  sets.push(`${key} = ?`)
                  params.push(key === 'occurred_at' && typeof value === 'string' ? mysqlDate(value) : value)
                }
                params.push(parsed.data.id, user.id)
                await execute(`update food_entries set ${sets.join(', ')} where id = ? and user_id = ?`, params)
                result = { updated: true }
                await execute(
                  'insert into chat_messages (id, session_id, user_id, role, content, tool_name, tool_args_json, tool_result_json) values (?, ?, ?, ?, ?, ?, ?, ?)',
                  [uuid(), sessionId, user.id, 'tool', '', name, jsonParam(parsed.data), jsonParam(result)]
                )
              }
            } else if (name === 'list_entries') {
              const parsed = rangeSchema.safeParse(args)
              if (!parsed.success) { result = { error: 'invalid_args', details: parsed.error.flatten() } }
              else {
                const where = ['user_id = ?']
                const params: unknown[] = [user.id]
                if (parsed.data.from) { where.push('occurred_at >= ?'); params.push(mysqlDate(parsed.data.from)) }
                if (parsed.data.to) { where.push('occurred_at <= ?'); params.push(mysqlDate(parsed.data.to)) }
                const rows = await query<DbRow[]>(`select * from food_entries where ${where.join(' and ')} order by occurred_at desc`, params)
                result = { entries: rows.map((row: any) => ({ ...row, occurred_at: new Date(row.occurred_at).toISOString(), created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString() })) }
                await execute(
                  'insert into chat_messages (id, session_id, user_id, role, content, tool_name, tool_args_json, tool_result_json) values (?, ?, ?, ?, ?, ?, ?, ?)',
                  [uuid(), sessionId, user.id, 'tool', '', name, jsonParam(parsed.data), jsonParam(result)]
                )
              }
            } else if (name === 'delete_food_entry') {
              if (!args?.id) { result = { error: 'invalid_args' } }
              else {
                await execute('delete from food_entries where id = ? and user_id = ?', [args.id, user.id])
                result = { deleted: true }
                await execute(
                  'insert into chat_messages (id, session_id, user_id, role, content, tool_name, tool_args_json, tool_result_json) values (?, ?, ?, ?, ?, ?, ?, ?)',
                  [uuid(), sessionId, user.id, 'tool', '', name, jsonParam(args), jsonParam(result)]
                )
              }
            } else {
              result = { error: 'unknown_tool' }
            }
            out.toolResult(name, result)
          }

          // Second call with tool results to get final assistant text
          const toolMessages = (m1.tool_calls as any[]).map(tc => ({ role: 'tool', tool_call_id: tc.id, name: tc.function?.name, content: 'OK' }))
          const r2 = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [...messages, m1, ...toolMessages] })
          })
          const j2 = await r2.json().catch(() => ({}))
          finalAssistantText = j2?.choices?.[0]?.message?.content || 'Done.'
        } else {
          finalAssistantText = m1?.content || ''
        }

        // Persist assistant message
        const assistantMessageId = uuid()
        await execute(
          'insert into chat_messages (id, session_id, user_id, role, content) values (?, ?, ?, ?, ?)',
          [assistantMessageId, sessionId, user.id, 'assistant', finalAssistantText]
        )
        const [amsg] = await query<MessageRow[]>('select id, created_at from chat_messages where id = ? limit 1', [assistantMessageId])

        out.message({ id: amsg.id, session_id: sessionId, role: 'assistant', content: finalAssistantText, created_at: new Date(amsg.created_at).toISOString() })
        out.done({ finish_reason: 'stop' })
        controller.close()
      } catch (e: any) {
        const msg = e?.message || String(e)
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`event: error\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ code: 'server_error', message: msg })}\n\n`))
        controller.enqueue(enc.encode(`event: done\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ finish_reason: 'error' })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
