import { useState, useEffect, useCallback } from 'react'
import { useUserStore } from '../store/userStore'
import { db } from '../db/database'
import { getSupplementInfo } from '../utils/supplementScheduler'
import type { DailyWellness, SupplementSchedule } from '../types'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface SupplementEntry {
  name: string
  dose: string
  time: string
  reason: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}
function todayEnd(): Date {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d
}
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}
function getTakenIds(): number[] {
  try { return JSON.parse(localStorage.getItem(`apex_taken_${todayKey()}`) ?? '[]') } catch { return [] }
}
function getProteinStored(): number {
  try { return Number(localStorage.getItem(`apex_protein_${todayKey()}`) ?? '0') } catch { return 0 }
}

function computeDayScore(wellness: DailyWellness | null): number {
  if (!wellness) return 70
  let score = 80
  if (wellness.stressLevel >= 4) score -= 20
  else if (wellness.stressLevel === 3) score -= 8
  if (wellness.soreness >= 4) score -= 15
  else if (wellness.soreness === 3) score -= 6
  if (wellness.motivation <= 2) score -= 10
  else if (wellness.motivation >= 4) score += 8
  return Math.max(10, Math.min(100, score))
}

function buildDailyInsights(wellness: DailyWellness | null, supplements: SupplementSchedule[]): string | null {
  if (!wellness) return null
  const parts: string[] = []

  if (wellness.stressLevel >= 4 && wellness.soreness >= 4) {
    parts.push('Corps sous pression : stress et courbatures élevés. Réduis le volume de 20–30 %, reste à RPE ≤ 7.')
  } else if (wellness.stressLevel >= 4) {
    parts.push('Stress élevé. Le cortisol freine la récupération — évite les maximas aujourd\'hui.')
  } else if (wellness.soreness >= 4) {
    parts.push('Courbatures sévères. Change de groupe musculaire ou opte pour de la mobilité active.')
  } else if (wellness.motivation <= 2) {
    parts.push('Motivation basse. Lance-toi quand même — les 5 premières minutes suffisent à relancer la machine.')
  } else if (wellness.motivation >= 4 && wellness.stressLevel <= 2 && wellness.soreness <= 2) {
    parts.push('Condition optimale. Bon moment pour viser des PRs ou augmenter légèrement le volume.')
  } else {
    parts.push('Journée standard. Suis ton programme normalement.')
  }

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nextSupp = supplements.find(s => {
    const [h, m] = s.timeOfDay.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0) >= nowMins
  })
  if (nextSupp) {
    parts.push(`Prochain supplément : ${nextSupp.supplement}${nextSupp.dose ? ` (${nextSupp.dose})` : ''} à ${nextSupp.timeOfDay}.`)
  }

  return parts.join(' ')
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDailyPlan() {
  const { profile } = useUserStore()
  const [wellness, setWellness] = useState<DailyWellness | null>(null)
  const [supplements, setSupplements] = useState<SupplementSchedule[]>([])
  const [takenIds, setTakenIds] = useState<number[]>([])
  const [proteinToday, setProteinToday] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [todayWellness, allSupps] = await Promise.all([
      db.dailyWellness.where('date').between(todayStart(), todayEnd(), true, true).first(),
      db.supplementSchedules.filter(s => s.enabled).toArray(),
    ])
    const sorted = allSupps.sort((a, b) => {
      const parseTime = (t: string) => {
        const parts = (t ?? '00:00').split(':').map(Number)
        const h = isNaN(parts[0]) ? 0 : parts[0]
        const m = isNaN(parts[1]) ? 0 : parts[1]
        return h * 60 + m
      }
      return parseTime(a.timeOfDay) - parseTime(b.timeOfDay)
    })
    setWellness(todayWellness ?? null)
    setSupplements(sorted)
    setTakenIds(getTakenIds())
    // Load protein: prefer DB over localStorage
    let proteinFromDB = 0
    try {
      const start = todayStart(); const end = todayEnd()
      const nutrition = await (db as any).dailyNutrition?.where('date').between(start, end, true, true).first()
      if (nutrition) {
        proteinFromDB = nutrition.proteinGrams
        // Sync to localStorage
        localStorage.setItem(`apex_protein_${todayKey()}`, String(proteinFromDB))
      }
    } catch { /* table may not exist */ }
    setProteinToday(proteinFromDB || getProteinStored())
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function markSupplementTaken(name: string, _scheduledTime: string) {
    const supp = supplements.find(s => s.supplement === name)
    if (!supp?.id) return
    const taken = getTakenIds()
    if (taken.includes(supp.id)) return
    const next = [...taken, supp.id]
    localStorage.setItem(`apex_taken_${todayKey()}`, JSON.stringify(next))
    setTakenIds(next)
  }

  async function logProtein(grams: number) {
    const next = proteinToday + grams
    localStorage.setItem(`apex_protein_${todayKey()}`, String(next))
    setProteinToday(next)
    // Also persist to DB for history
    try {
      const start = todayStart(); const end = todayEnd()
      const existing = await db.dailyNutrition.where('date').between(start, end, true, true).first()
      if (existing?.id) {
        await db.dailyNutrition.update(existing.id, { proteinGrams: next })
      } else {
        await db.dailyNutrition.add({ date: new Date(), proteinGrams: next, notes: '' })
      }
    } catch { /* silently skip if table doesn't exist yet */ }
  }

  const supplementTimeline: SupplementEntry[] = supplements.map(s => {
    const info = getSupplementInfo(s.supplement)
    return {
      name: s.supplement,
      dose: s.dose ?? info?.defaultDose ?? '',
      time: s.timeOfDay,
      reason: info?.timingLabel ?? s.notes ?? '',
    }
  })

  // Compatibility: supplementLogs as array of taken supplement names
  const supplementLogs = takenIds.map(id => {
    const s = supplements.find(x => x.id === id)
    return s ? { supplement_name: s.supplement, taken_at: new Date().toISOString(), skipped: false } : null
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  return {
    plan: null,
    dayScore: computeDayScore(wellness),
    proteinTarget: profile ? Math.round(profile.weight * 2.2) : 160,
    proteinToday,
    supplementTimeline,
    supplementLogs,
    dailyInsights: buildDailyInsights(wellness, supplements),
    programAdjustments: wellness && (wellness.stressLevel >= 4 || wellness.soreness >= 4)
      ? 'Volume réduit recommandé : −20 % de séries, RPE maximum 7.'
      : null,
    isLoading,
    wellness,
    markSupplementTaken,
    logProtein,
    reload: load,
  }
}
