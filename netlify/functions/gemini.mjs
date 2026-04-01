/**
 * Netlify serverless function — Gemini API proxy
 * - Avoids CORS issues, keeps API key server-side
 * - Supports Google Search grounding for coach chat
 *
 * Body: { model, prompt, systemInstruction, history, maxTokens, enableSearch }
 * Returns: { text, searchUsed }
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const {
    model = 'gemini-2.5-flash',
    prompt,
    systemInstruction,
    history = [],
    maxTokens = 16384,   // enough for full 4-week programme JSON
    enableSearch = false, // Google Search grounding for coach chat
  } = body

  // Build conversation contents
  const contents = []
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const payload = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    // Google Search grounding — model decides autonomously when to search
    ...(enableSearch
      ? { tools: [{ googleSearch: {} }] }
      : {}),
  }

  try {
    const res = await fetch(
      `${API_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`
      return { statusCode: res.status, headers: cors(), body: JSON.stringify({ error: errMsg }) }
    }

    // Collect all text parts (search grounding may add extra parts)
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const text = parts.map(p => p.text ?? '').join('')

    // Detect if Google Search was actually used
    const searchUsed = !!(data?.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length)

    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, searchUsed }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: err.message ?? 'Server error' }),
    }
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
