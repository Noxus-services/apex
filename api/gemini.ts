export const config = { runtime: 'edge' }

/**
 * Vercel Edge Function — Gemini API proxy
 * Reads Gemini streaming response, returns full JSON when complete.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export default async function handler(request: Request): Promise<Response> {
  // Always return JSON — wrap everything so Vercel never serves its own error page
  try {
    return await handleRequest(request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: `Edge function crashed: ${msg}` }, 500)
  }
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors() })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Try both env var names — VITE_ prefix works in Vercel dashboard
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured (check Vercel env vars)' }, 500)

  let body: {
    model?: string
    prompt?: string
    systemInstruction?: string
    history?: Array<{ role: string; content: string }>
    maxTokens?: number
    enableSearch?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    model = 'gemini-2.5-flash',
    prompt = '',
    systemInstruction,
    history = [],
    maxTokens = 16384,
    enableSearch = false,
  } = body

  // Build conversation
  const contents: unknown[] = []
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      // Disable chain-of-thought thinking — thinking tokens eat into the budget
      // and slow down responses. Coaching tasks don't need deep reasoning chains.
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] }
  }
  if (enableSearch) {
    payload.tools = [{ googleSearch: {} }]
  }

  // Use streaming endpoint to avoid timeout — read all chunks, return full text
  const geminiRes = await fetch(
    `${API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  if (!geminiRes.ok || !geminiRes.body) {
    let errMsg = `HTTP ${geminiRes.status}`
    try {
      const errData = await geminiRes.json()
      errMsg = errData?.error?.message ?? errMsg
    } catch { /* ignore */ }
    return json({ error: errMsg }, geminiRes.status)
  }

  // Read entire SSE stream, collect text from all chunks
  const reader = geminiRes.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let fullText = ''
  let searchUsed = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })

    // Process complete SSE events (separated by \r\n\r\n or \n\n)
    let sepIdx: number
    while (true) {
      // Try both separators
      const crlfIdx = buf.indexOf('\r\n\r\n')
      const lfIdx = buf.indexOf('\n\n')
      if (crlfIdx === -1 && lfIdx === -1) break

      if (crlfIdx !== -1 && (lfIdx === -1 || crlfIdx <= lfIdx)) {
        sepIdx = crlfIdx
        const event = buf.slice(0, sepIdx)
        buf = buf.slice(sepIdx + 4)
        processEvent(event)
      } else {
        sepIdx = lfIdx
        const event = buf.slice(0, sepIdx)
        buf = buf.slice(sepIdx + 2)
        processEvent(event)
      }
    }
  }

  // Process any remaining data
  if (buf.trim()) processEvent(buf)

  return json({ text: fullText, searchUsed })

  function processEvent(event: string) {
    const lines = event.split(/\r?\n/)
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const jsonStr = line.slice(5).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue
      try {
        const chunk = JSON.parse(jsonStr)
        const parts = chunk?.candidates?.[0]?.content?.parts ?? []
        for (const part of parts) {
          // Skip internal thinking parts
          if (part.thought) continue
          if (typeof part.text === 'string' && part.text) {
            fullText += part.text
          }
        }
        if (chunk?.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length) {
          searchUsed = true
        }
      } catch { /* skip malformed */ }
    }
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  })
}

function cors(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
