import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { addEntrySchema, rangeSchema, updateEntryToolSchema } from '@/lib/validation'

export const runtime = 'edge'

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

async function getActivePrompt(supabase: ReturnType<typeof getSupabaseServer>) {
  const { data, error } = await supabase.from('prompts').select('*').eq('is_active', true).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data
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
        const supabase = getSupabaseServer()
        const { data: userData } = await supabase.auth.getUser()
        const user = userData.user
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
          const { data: srow } = await supabase.from('chat_sessions').select('id').eq('id', payload.session_id).eq('user_id', user.id).maybeSingle()
          if (srow?.id) sessionId = srow.id
        }
        if (!sessionId) {
          const title = (text || 'New chat').slice(0, 80)
          const { data: created, error: cErr } = await supabase.from('chat_sessions').insert({ user_id: user.id, title }).select('id').single()
          if (cErr) throw new Error(cErr.message)
          sessionId = created.id
        }

        // Persist user message
        const { data: umsg, error: umErr } = await supabase.from('chat_messages').insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'user',
          content: text || '',
          has_image: files.length > 0
        }).select('id, created_at').single()
        if (umErr) throw new Error(umErr.message)

        // Build system prompt
        const activePrompt = await getActivePrompt(supabase)
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

        // Build OpenAI messages
        const userParts: any[] = []
        if (text) userParts.push({ type: 'text', text })
        for (const f of files.slice(0, 2)) {
          const mime = f.type
          if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue
          const ab = await f.arrayBuffer()
          const b64 = b64FromArrayBuffer(ab)
          userParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
        }

        const messages: any[] = [
          { role: 'system', content: systemText },
          { role: 'user', content: userParts.length ? userParts : text }
        ]

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) { out.error('llm_not_configured', 'OPENAI_API_KEY not set'); out.done({ finish_reason: 'error' }); controller.close(); return }

        // First call: allow tool calls
        const tools = openAiToolSchemas()
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
        const forceTool = files.length > 0 || /\b(log|add|save|record|track)\b/i.test(text) || /\b(kcal|calorie|calories|\d{2,4})\b/i.test(text)
        const r1 = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, tools, tool_choice: forceTool ? 'required' : 'auto' })
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
                const { data: ins, error: iErr } = await supabase.from('food_entries').insert([row]).select('id').single()
                result = iErr ? { error: iErr.message } : { id: ins?.id, occurred_at: occurredAtISO, meal_type: row.meal_type, item_name: row.item_name, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat }
                // Persist tool message
                await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: user.id, role: 'tool', content: '', tool_name: name, tool_args_json: parsed.data, tool_result_json: result })
              }
            } else if (name === 'update_food_entry') {
              const parsed = updateEntryToolSchema.safeParse(args)
              if (!parsed.success) { result = { error: 'invalid_args', details: parsed.error.flatten() } }
              else {
                const { error: uErr } = await supabase.from('food_entries').update(parsed.data.fields).eq('id', parsed.data.id).eq('user_id', user.id)
                result = uErr ? { error: uErr.message } : { updated: true }
                await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: user.id, role: 'tool', content: '', tool_name: name, tool_args_json: parsed.data, tool_result_json: result })
              }
            } else if (name === 'list_entries') {
              const parsed = rangeSchema.safeParse(args)
              if (!parsed.success) { result = { error: 'invalid_args', details: parsed.error.flatten() } }
              else {
                let q = supabase.from('food_entries').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false })
                if (parsed.data.from) q = q.gte('occurred_at', parsed.data.from)
                if (parsed.data.to) q = q.lte('occurred_at', parsed.data.to)
                const { data: rows, error: qErr } = await q
                result = qErr ? { error: qErr.message } : { entries: rows }
                await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: user.id, role: 'tool', content: '', tool_name: name, tool_args_json: parsed.data, tool_result_json: result })
              }
            } else if (name === 'delete_food_entry') {
              if (!args?.id) { result = { error: 'invalid_args' } }
              else {
                const { error: dErr } = await supabase.from('food_entries').delete().eq('id', args.id).eq('user_id', user.id)
                result = dErr ? { error: dErr.message } : { deleted: true }
                await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: user.id, role: 'tool', content: '', tool_name: name, tool_args_json: args, tool_result_json: result })
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
        const { data: amsg, error: amErr } = await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: user.id, role: 'assistant', content: finalAssistantText }).select('id, created_at').single()
        if (amErr) throw new Error(amErr.message)

        out.message({ id: amsg.id, session_id: sessionId, role: 'assistant', content: finalAssistantText, created_at: amsg.created_at })
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
