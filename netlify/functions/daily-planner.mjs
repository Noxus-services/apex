/**
 * Scheduled Netlify Function — runs every day at 05:00 UTC
 * 1. Reads all athlete snapshots (today or most recent)
 * 2. Calls Gemini 2.5-flash to generate a personalised daily plan
 * 3. Writes the plan to `daily_plans` table
 * 4. Sends a push notification to the user
 *
 * Schedule is declared in netlify.toml:
 *   [functions."daily-planner"]
 *     schedule = "0 5 * * *"
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`
const BASE_URL = process.env.URL || 'https://apex-coach.netlify.app'

// ── Fetch today's snapshots ──────────────────────────────────────────────────
async function getTodaySnapshots() {
  const today = new Date().toISOString().split('T')[0]

  // Try today's snapshots first, fall back to any snapshot per user
  const { data: todaySnaps } = await supabase
    .from('athlete_snapshots')
    .select('*')
    .eq('snapshot_date', today)

  if (todaySnaps && todaySnaps.length > 0) return todaySnaps

  // Fall back: latest snapshot per user (within last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data: recent } = await supabase
    .from('athlete_snapshots')
    .select('*')
    .gte('snapshot_date', weekAgo)
    .order('snapshot_date', { ascending: false })

  if (!recent) return []

  // Deduplicate: keep only the latest snapshot per user
  const byUser = new Map()
  for (const snap of recent) {
    if (!byUser.has(snap.user_id)) byUser.set(snap.user_id, snap)
  }
  return [...byUser.values()]
}

// ── Build Gemini prompt for one athlete ─────────────────────────────────────
function buildPrompt(snap) {
  const { profile_json: p, wellness_json: w, last_sessions_json: sessions, supplements_json: supps, active_program_json: prog } = snap

  const today = new Date()
  const weekday = today.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const sessionsStr = sessions && sessions.length > 0
    ? sessions.map((s, i) => `  Session ${i + 1}: ${s.date} — ${s.programName ?? 'Séance libre'}, ${s.totalVolume ?? '?'}kg volume`).join('\n')
    : '  Aucune session récente'

  const suppStr = supps && supps.length > 0
    ? supps.map(s => `  ${s.name}: ${s.dosage ?? s.dose ?? '?'}`).join('\n')
    : '  Aucun supplément configuré'

  return `Tu es APEX, un coach IA d'élite en musculation. Aujourd'hui c'est ${weekday} ${dateStr}.

PROFIL ATHLÈTE:
- Nom: ${p?.name ?? 'Athlète'}
- Objectif: ${p?.goal ?? 'Prise de masse'}
- Poids: ${p?.weight ?? 80}kg, Taille: ${p?.height ?? 180}cm
- Niveau: ${p?.level ?? 'Intermédiaire'}
- Fréquence entraînement: ${p?.trainingFrequency ?? 4}j/sem

ÉTAT DU JOUR (bien-être):
- Sommeil: ${w?.sleep ?? '?'}/5
- Stress: ${w?.stress ?? '?'}/5
- Courbatures: ${w?.soreness ?? '?'}/5
- Énergie: ${w?.energy ?? '?'}/5
- Notes: ${w?.notes ?? 'Aucune'}

DERNIÈRES SESSIONS:
${sessionsStr}

PROGRAMME ACTIF: ${prog?.name ?? 'Aucun programme actif'}
Semaine: ${prog?.currentWeek ?? '?'}, Jour: ${prog?.currentDay ?? '?'}

SUPPLÉMENTS:
${suppStr}

---

Génère le plan journalier APEX au format JSON strict (sans markdown, sans backticks) :

{
  "day_score": <0-100, score de forme du jour basé sur sommeil/stress/courbatures>,
  "protein_target_g": <objectif protéines en grammes selon poids et objectif>,
  "supplement_timeline": [
    {"time": "HH:MM", "name": "...", "dose": "...", "reason": "..."},
    ...
  ],
  "daily_insights": "<2-3 phrases d'analyse personnalisée de la journée>",
  "program_adjustments": "<suggestion d'ajustement programme si nécessaire, sinon null>",
  "notifications_scheduled": [
    {"time": "HH:MM", "title": "...", "body": "...", "type": "supplement|pre_workout|post_workout|check_in|recovery"},
    ...
  ]
}`
}

// ── Call Gemini ──────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
      thinkingConfig: { thinkingBudget: 0 },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Gemini returned empty content')

  return JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''))
}

// ── Send push notification to a user ────────────────────────────────────────
async function sendPush(userId, title, body) {
  try {
    await fetch(`${BASE_URL}/api/push-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, title, body, tag: 'daily-plan', url: '/?page=journee' }),
    })
  } catch {
    // Push failure is non-fatal
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async () => {
  const today = new Date().toISOString().split('T')[0]
  console.log(`[daily-planner] Starting for ${today}`)

  const snapshots = await getTodaySnapshots()
  console.log(`[daily-planner] Found ${snapshots.length} athlete(s)`)

  for (const snap of snapshots) {
    try {
      const prompt = buildPrompt(snap)
      const plan = await callGemini(prompt)

      await supabase.from('daily_plans').upsert(
        {
          user_id: snap.user_id,
          plan_date: today,
          day_score: plan.day_score ?? 70,
          protein_target_g: plan.protein_target_g ?? 160,
          supplement_timeline: plan.supplement_timeline ?? [],
          daily_insights: plan.daily_insights ?? '',
          program_adjustments: plan.program_adjustments ?? null,
          notifications_scheduled: plan.notifications_scheduled ?? [],
        },
        { onConflict: 'user_id,plan_date' }
      )

      // Push notification
      const profile = snap.profile_json
      const name = profile?.name?.split(' ')[0] ?? 'Athlète'
      await sendPush(
        snap.user_id,
        `Ton plan APEX est prêt, ${name} 💪`,
        plan.daily_insights
          ? plan.daily_insights.substring(0, 100) + '…'
          : 'Ouvre APEX pour voir ton plan du jour.'
      )

      console.log(`[daily-planner] ✓ Plan généré pour ${snap.user_id} (score: ${plan.day_score})`)
    } catch (err) {
      console.error(`[daily-planner] ✗ Erreur pour ${snap.user_id}:`, err)
    }
  }

  return new Response(JSON.stringify({ processed: snapshots.length, date: today }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { schedule: '0 5 * * *' }
