export const config = { runtime: 'edge' }

/**
 * Vercel Edge Function — Gemini API proxy
 *
 * KEY DESIGN: returns a ReadableStream immediately so the edge function
 * satisfies Vercel's "time to first byte" timeout. The actual Gemini
 * streaming work runs asynchronously and writes the final JSON to the
 * stream when complete. The client calls response.json() which naturally
 * waits for the stream to close — no client changes needed.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors() })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500, headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  }

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
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  }

  const {
    model = 'gemini-2.5-flash',
    prompt = '',
    systemInstruction,
    history = [],
    maxTokens = 16384,
    enableSearch = false,
  } = body

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
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] }
  }
  if (enableSearch) {
    payload.tools = [{ googleSearch: {} }]
  }

  // ── Streaming pattern ─────────────────────────────────────────────────────
  // We return a ReadableStream IMMEDIATELY so Vercel's "time to first byte"
  // timeout is never hit. Gemini work runs async and writes the JSON result
  // to the writable end. The client's response.json() waits for stream close.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  ;(async () => {
    try {
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
        await writer.write(encoder.encode(JSON.stringify({ error: errMsg })))
        await writer.close()
        return
      }

      const reader = geminiRes.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let fullText = ''
      let searchUsed = false

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
              if (part.thought) continue
              if (typeof part.text === 'string' && part.text) fullText += part.text
            }
            if (chunk?.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length) {
              searchUsed = true
            }
          } catch { /* skip malformed */ }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })

        while (true) {
          const crlfIdx = buf.indexOf('\r\n\r\n')
          const lfIdx = buf.indexOf('\n\n')
          if (crlfIdx === -1 && lfIdx === -1) break

          if (crlfIdx !== -1 && (lfIdx === -1 || crlfIdx <= lfIdx)) {
            processEvent(buf.slice(0, crlfIdx))
            buf = buf.slice(crlfIdx + 4)
          } else {
            processEvent(buf.slice(0, lfIdx))
            buf = buf.slice(lfIdx + 2)
          }
        }
      }

      if (buf.trim()) processEvent(buf)

      await writer.write(encoder.encode(JSON.stringify({ text: fullText, searchUsed })))
      await writer.close()
    } catch (err) {
      try {
        const msg = err instanceof Error ? err.message : String(err)
        await writer.write(encoder.encode(JSON.stringify({ error: msg })))
        await writer.close()
      } catch { /* stream already closed */ }
    }
  })()

  return new Response(readable, {
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
