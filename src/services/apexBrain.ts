/**
 * apexBrain.ts — Autonomous intelligence layer
 *
 * Detects patterns in athlete data and generates proactive coaching insights
 * without waiting for the user to ask. Acts like a human coach who's always
 * watching your data.
 */

import { generateText } from '../api/gemini'
import type { UserProfile, WorkoutSession, Program, DailyWellness } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StagnationAlert {
  exerciseName: string
  sessionCount: number
  currentWeight: number
  suggestedWeight: number
  reason: string
}

export interface PatternInsight {
  type: 'stagnation' | 'volume_decline' | 'absence' | 'progression' | 'overtraining_risk' | 'goal_drift'
  message: string
  severity: 'good' | 'info' | 'warning' | 'critical'
  data?: Record<string, unknown>
}

export interface AdaptationNote {
  exerciseName: string
  action: 'increase' | 'maintain' | 'decrease' | 'deload'
  oldWeight: number
  newWeight: number
  reason: string
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function todayKey(suffix: string): string {
  return `apex_brain_${new Date().toISOString().slice(0, 10)}_${suffix}`
}

// ─── Pattern Detection (pure JS, no AI needed) ────────────────────────────────

// Simple 2-minute cache for stagnation detection (called from multiple pages)
const _stagnationCache: {
  key: string
  result: StagnationAlert[]
  ts: number
} = { key: '', result: [], ts: 0 }

/** Detect exercises that have been stuck at the same weight for N+ sessions */
export function detectStagnations(sessions: WorkoutSession[], minSessions = 3): StagnationAlert[] {
  const cacheKey = `${sessions.length}_${minSessions}`
  const now = Date.now()
  if (_stagnationCache.key === cacheKey && now - _stagnationCache.ts < 120_000) {
    return _stagnationCache.result
  }

  // Build per-exercise history (weight of last work set)
  const history: Map<string, { weight: number; reps: number; date: Date }[]> = new Map()

  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  for (const session of sorted) {
    for (const ex of session.exercises) {
      const workSets = ex.sets.filter(s => s.completed && !s.isWarmup)
      if (workSets.length === 0) continue
      const lastSet = workSets[workSets.length - 1]
      const existing = history.get(ex.name) ?? []
      history.set(ex.name, [...existing, {
        weight: lastSet.weight,
        reps: lastSet.reps,
        date: new Date(session.date),
      }])
    }
  }

  const alerts: StagnationAlert[] = []

  history.forEach((entries, name) => {
    if (entries.length < minSessions) return
    const recent = entries.slice(-minSessions)
    const weights = recent.map(e => e.weight)
    if (weights.every(w => w === weights[0])) {
      alerts.push({
        exerciseName: name,
        sessionCount: minSessions,
        currentWeight: weights[0],
        suggestedWeight: Math.round((weights[0] + 2.5) * 100) / 100,
        reason: `${weights[0]}kg inchangé sur ${minSessions} séances`,
      })
    }
  })

  _stagnationCache.key = cacheKey
  _stagnationCache.ts = Date.now()
  _stagnationCache.result = alerts

  return alerts
}

/** Detect high-level patterns in training data */
export function detectPatterns(sessions: WorkoutSession[], _profile: UserProfile): PatternInsight[] {
  const insights: PatternInsight[] = []
  const now = new Date()

  // Sort sessions newest first
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // ── Days since last session ──────────────────────────────────────
  if (sorted.length > 0) {
    const lastDate = new Date(sorted[0].date)
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince >= 6) {
      insights.push({
        type: 'absence',
        message: `${daysSince} jours sans séance`,
        severity: 'critical',
        data: { daysSince },
      })
    } else if (daysSince >= 4) {
      insights.push({
        type: 'absence',
        message: `${daysSince} jours sans entraînement`,
        severity: 'warning',
        data: { daysSince },
      })
    }
  }

  // ── Week volume comparison ────────────────────────────────────────
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
  weekStart.setHours(0, 0, 0, 0)
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setDate(weekStart.getDate() - 7)

  const thisWeek = sessions.filter(s => new Date(s.date) >= weekStart)
  const lastWeek = sessions.filter(s => {
    const d = new Date(s.date)
    return d >= prevWeekStart && d < weekStart
  })

  const thisVol = thisWeek.reduce((a, s) => a + s.totalVolume, 0)
  const lastVol = lastWeek.reduce((a, s) => a + s.totalVolume, 0)

  if (lastVol > 0 && thisVol < lastVol * 0.65) {
    insights.push({
      type: 'volume_decline',
      message: `Volume -${Math.round((1 - thisVol / lastVol) * 100)}% vs semaine dernière`,
      severity: 'warning',
      data: { thisVol, lastVol },
    })
  }

  // ── Overtraining risk: 3+ consecutive days of energy ≤ 2 ─────────
  const last5 = sorted.slice(0, 5)
  const lowEnergyRun = last5.filter(s => s.energy <= 2).length
  if (lowEnergyRun >= 3) {
    insights.push({
      type: 'overtraining_risk',
      message: `Énergie basse sur ${lowEnergyRun} séances consécutives`,
      severity: 'critical',
      data: { lowEnergyRun },
    })
  }

  // ── Stagnation count ─────────────────────────────────────────────
  const stagnations = detectStagnations(sessions)
  if (stagnations.length >= 2) {
    insights.push({
      type: 'stagnation',
      message: `${stagnations.length} exercices en plateau`,
      severity: 'warning',
      data: { stagnations },
    })
  }

  // ── Positive: PRs this week ───────────────────────────────────────
  const weekPRs = thisWeek.flatMap(s => s.prsAchieved ?? [])
  if (weekPRs.length >= 2) {
    insights.push({
      type: 'progression',
      message: `${weekPRs.length} PRs cette semaine`,
      severity: 'good',
      data: { prs: weekPRs.map(p => p.exerciseName) },
    })
  }

  return insights
}

/** For a specific program day, get stagnation alerts for its exercises */
export function getSessionStagnations(
  exercises: { name: string }[],
  sessions: WorkoutSession[]
): StagnationAlert[] {
  const all = detectStagnations(sessions, 3)
  return all.filter(alert =>
    exercises.some(ex => ex.name.toLowerCase() === alert.exerciseName.toLowerCase())
  )
}

/** Compute what APEX should adjust after a session */
export function computeAdaptations(
  session: WorkoutSession,
  plannedDay: { exercises: { name: string; repsMax: number }[] } | null
): AdaptationNote[] {
  if (!plannedDay) return []
  const notes: AdaptationNote[] = []

  for (const ex of session.exercises) {
    const planned = plannedDay.exercises.find(p => p.name.toLowerCase() === ex.name.toLowerCase())
    if (!planned) continue

    const workSets = ex.sets.filter(s => s.completed && !s.isWarmup)
    if (workSets.length === 0) continue

    const lastSet = workSets[workSets.length - 1]
    const avgReps = workSets.reduce((a, s) => a + s.reps, 0) / workSets.length

    if (avgReps >= planned.repsMax) {
      notes.push({
        exerciseName: ex.name,
        action: 'increase',
        oldWeight: lastSet.weight,
        newWeight: Math.round((lastSet.weight + 2.5) * 100) / 100,
        reason: `${Math.round(avgReps)} reps en moyenne ≥ ${planned.repsMax} — progression`,
      })
    } else if (avgReps >= planned.repsMax - 1) {
      notes.push({
        exerciseName: ex.name,
        action: 'maintain',
        oldWeight: lastSet.weight,
        newWeight: lastSet.weight,
        reason: `Proche du plafond (${Math.round(avgReps)}/${planned.repsMax} reps) — maintien`,
      })
    }
  }

  return notes
}

// ─── Morning Brief (AI-generated, cached daily) ───────────────────────────────

const BRIEF_SYSTEM = `Tu es APEX, coach d'élite personnel. Tu génères le message de coaching du matin.

RÈGLES ABSOLUES :
- 2-3 phrases MAXIMUM — jamais plus
- Ultra-spécifique : cite des CHIFFRES RÉELS issus des données fournies
- Zéro généralité ("continue comme ça", "reste motivé" = interdit)
- Tutoiement direct, ton d'un coach qui t'a vu t'entraîner hier
- Si problème → nomme-le précisément + une action concrète
- Si progression → quantifie-la + ce que ça signifie pour l'objectif
- Si tout va bien → dit ce qu'il faut surveiller aujourd'hui
- Texte brut uniquement. Pas de markdown, pas d'emojis.`

export async function getMorningBrief(
  profile: UserProfile,
  sessions: WorkoutSession[],
  wellness: DailyWellness | null,
  program: Program | null
): Promise<string> {
  // Return cached brief if already generated today
  const cached = localStorage.getItem(todayKey('brief'))
  if (cached) return cached

  const patterns = detectPatterns(sessions, profile)
  const stagnations = detectStagnations(sessions)
  const recent = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4)

  // Compute week volume
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekVol = sessions.filter(s => new Date(s.date) >= weekStart).reduce((a, s) => a + s.totalVolume, 0)
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7)
  const prevVol = sessions.filter(s => {
    const d = new Date(s.date); return d >= prevWeekStart && d < weekStart
  }).reduce((a, s) => a + s.totalVolume, 0)

  const prompt = `
ATHLÈTE : ${profile.name}, ${profile.weight}kg
OBJECTIF : ${profile.goalDescription || profile.goal}
PROGRAMME : ${program?.name ?? 'Aucun'}
SEMAINE EN COURS : ${weekVol}kg de volume (semaine précédente : ${prevVol > 0 ? `${prevVol}kg` : 'aucune donnée'})

DERNIÈRES SÉANCES :
${recent.length > 0
  ? recent.map(s =>
      `• ${new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} — ${s.dayName} : ${s.totalVolume}kg, humeur ${s.mood}/5, énergie ${s.energy}/5${s.prsAchieved.length > 0 ? `, PRs: ${s.prsAchieved.map(p => `${p.exerciseName} ${p.value}kg`).join(', ')}` : ''}`
    ).join('\n')
  : '• Aucune séance enregistrée'}

PROBLÈMES DÉTECTÉS :
${patterns.filter(p => p.severity === 'warning' || p.severity === 'critical').map(p => `• ${p.message}`).join('\n') || '• Aucun'}

EXERCICES EN PLATEAU :
${stagnations.length > 0 ? stagnations.slice(0, 3).map(s => `• ${s.exerciseName} : ${s.reason}`).join('\n') : '• Aucun'}

BIEN-ÊTRE DU MATIN :
${wellness ? `Stress ${wellness.stressLevel}/5, courbatures ${wellness.soreness}/5, motivation ${wellness.motivation}/5` : 'Non renseigné'}

Génère le message de coaching du matin pour ${profile.name.split(' ')[0]}. 2-3 phrases max.`

  const brief = await generateText(prompt, BRIEF_SYSTEM, 200)
  if (brief) {
    localStorage.setItem(todayKey('brief'), brief)
  }
  return brief || `Prêt pour la séance, ${profile.name.split(' ')[0]} ?`
}

// ─── Sleep → Session Intensity Coupling ──────────────────────────────────────

/** Compute how much to adjust today's session based on last night's sleep */
export interface SleepAdjustment {
  factor: number       // 0.75 = -25%, 1.0 = normal, 1.1 = push
  banner: string       // message to show user
  severity: 'rest' | 'reduce' | 'normal' | 'push'
}

export function computeSleepAdjustment(
  sleepLog: { hoursSlept: number; quality: 1|2|3|4|5 } | null,
  wellness: { stressLevel: number; soreness: number; motivation: number } | null
): SleepAdjustment {
  // No data → normal
  if (!sleepLog && !wellness) return { factor: 1.0, banner: '', severity: 'normal' }

  const hours = sleepLog?.hoursSlept ?? 7
  const quality = sleepLog?.quality ?? 3
  const stress = wellness?.stressLevel ?? 3
  const soreness = wellness?.soreness ?? 2

  // Critical: very little sleep + high stress/soreness
  if (hours < 5 || (hours < 6 && (stress >= 4 || soreness >= 4))) {
    return {
      factor: 0.70,
      banner: `😴 ${hours}h de sommeil détectées. Volume réduit de 30%, RPE ≤ 6. Récupération prioritaire.`,
      severity: 'rest'
    }
  }

  // Poor sleep
  if (hours < 6.5 || quality <= 2) {
    return {
      factor: 0.80,
      banner: `😕 Sommeil court (${hours}h). Volume réduit de 20%, RPE ≤ 7. Écoute ton corps.`,
      severity: 'reduce'
    }
  }

  // Great sleep + low stress
  if (hours >= 8 && quality >= 4 && stress <= 2 && soreness <= 2) {
    return {
      factor: 1.0,
      banner: `⚡ ${hours}h de sommeil — condition optimale. C'est le bon moment pour pousser fort.`,
      severity: 'push'
    }
  }

  return { factor: 1.0, banner: '', severity: 'normal' }
}

// ─── Auto-Deload Detection ────────────────────────────────────────────────────

/** Returns a deload suggestion if multiple fatigue signals are present */
export interface DeloadSuggestion {
  shouldDeload: boolean
  reason: string
  details: string[]
}

export function checkDeloadNeeded(
  patterns: PatternInsight[],
  sessions: WorkoutSession[],
  wellness: { stressLevel: number; soreness: number } | null
): DeloadSuggestion {
  const details: string[] = []
  let score = 0

  // Signal 1: multiple stagnations
  const stagnations = detectStagnations(sessions, 3)
  if (stagnations.length >= 3) { score += 3; details.push(`${stagnations.length} exercices en plateau`) }
  else if (stagnations.length >= 2) { score += 1; details.push(`${stagnations.length} exercices en plateau`) }

  // Signal 2: high stress/soreness
  if (wellness && wellness.stressLevel >= 4 && wellness.soreness >= 4) {
    score += 2; details.push('Stress et courbatures élevés')
  }

  // Signal 3: overtraining risk pattern
  const overtraining = patterns.find(p => p.type === 'overtraining_risk')
  if (overtraining) { score += 2; details.push(overtraining.message) }

  // Signal 4: volume decline
  const volDecline = patterns.find(p => p.type === 'volume_decline')
  if (volDecline) { score += 1; details.push(volDecline.message) }

  // Signal 5: long absence (deload on return)
  const absence = patterns.find(p => p.type === 'absence' && p.severity === 'critical')
  if (absence) { score += 2; details.push(absence.message) }

  if (score >= 3) {
    return {
      shouldDeload: true,
      reason: `${score} signaux de fatigue détectés`,
      details
    }
  }
  return { shouldDeload: false, reason: '', details: [] }
}

/** Force-regenerate the brief (ignores cache) */
export async function refreshMorningBrief(
  profile: UserProfile,
  sessions: WorkoutSession[],
  wellness: DailyWellness | null,
  program: Program | null
): Promise<string> {
  localStorage.removeItem(todayKey('brief'))
  return getMorningBrief(profile, sessions, wellness, program)
}

// ─── Proactive Coach Outreach ─────────────────────────────────────────────────

/** Generate a proactive coaching message for a critical pattern (cached daily per pattern type) */
export async function generateProactiveCoachMessage(
  pattern: PatternInsight,
  profile: UserProfile,
  sessions: WorkoutSession[]
): Promise<string | null> {
  // Only for warning/critical patterns
  if (pattern.severity === 'info' || pattern.severity === 'good') return null

  // Cache: one proactive message per pattern type per day
  const cacheKey = `apex_proactive_${new Date().toISOString().slice(0, 10)}_${pattern.type}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) return null // already generated today for this pattern

  const recentStr = sessions.slice(0, 5).map(s =>
    `${new Date(s.date).toLocaleDateString('fr-FR')}: ${s.dayName}, ${Math.round(s.totalVolume)}kg volume, humeur ${s.mood}/5`
  ).join('\n')

  const systemInstruction = `Tu es APEX, le coach IA de ${profile.name}. Tu détectes un problème et tu l'abordes DIRECTEMENT, comme un coach humain qui remarque quelque chose. 2-3 phrases maximum. Cite des chiffres réels. Propose une action concrète. Pas de formule de politesse.`

  const prompt = `Données athlète:
- Objectif: ${profile.goal}, ${profile.experience}
- Dernières séances: ${recentStr}

Problème détecté: ${pattern.message} (sévérité: ${pattern.severity})

Génère un message proactif court (2-3 phrases) qui adresse CE problème spécifique avec une recommandation concrète.`

  try {
    const msg = await generateText(prompt, systemInstruction, 150)
    if (msg) {
      localStorage.setItem(cacheKey, '1')
      return msg
    }
  } catch { /* silently fail */ }
  return null
}
