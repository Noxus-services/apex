import { useState, useEffect } from 'react'
import { db } from '../../db/database'
import { useCoach } from '../../hooks/useCoach'
import type { DailyWellness, SleepLog, WorkoutSession } from '../../types'

// ── Score computation ─────────────────────────────────────────────────────────

interface RecoveryData {
  wellness: DailyWellness[]
  sleepLogs: SleepLog[]
  recentSessions: WorkoutSession[]
}

function computeRecoveryScore(data: RecoveryData): number {
  const { wellness, sleepLogs, recentSessions } = data

  let score = 70 // baseline

  // Sleep quality contribution (0-25 points)
  if (sleepLogs.length > 0) {
    const avgQuality = sleepLogs.reduce((acc, s) => acc + s.quality, 0) / sleepLogs.length
    const avgHours = sleepLogs.reduce((acc, s) => acc + s.hoursSlept, 0) / sleepLogs.length
    const qualityScore = ((avgQuality - 1) / 4) * 15 // 0-15
    const hoursScore = Math.min(Math.max((avgHours - 5) / 4, 0), 1) * 10 // 0-10 for 5h–9h
    score = score - 35 + qualityScore + hoursScore // replace placeholder
  }

  // Stress (inverted) contribution (0-25 points)
  if (wellness.length > 0) {
    const avgStress = wellness.reduce((acc, w) => acc + w.stressLevel, 0) / wellness.length
    const stressScore = ((5 - avgStress) / 4) * 25
    score += stressScore - 12.5 // center around 0 relative to baseline
  }

  // Training load penalty
  const sessionCount7d = recentSessions.length
  if (sessionCount7d >= 6) score -= 15
  else if (sessionCount7d >= 5) score -= 8

  // Days since last rest day
  const daysSinceRest = getDaysSinceLastRest(recentSessions)
  if (daysSinceRest >= 6) score -= 20
  else if (daysSinceRest >= 4) score -= 10

  return Math.round(Math.min(100, Math.max(0, score)))
}

function getDaysSinceLastRest(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 0
  const sortedDates = sessions
    .map(s => new Date(s.date).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i) // unique days
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  const today = new Date()
  let consecutive = 0
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (sortedDates.includes(d.toDateString())) {
      consecutive++
    } else if (i > 0) {
      break
    }
  }
  return consecutive
}

// ── Recommendation engine (static rules) ─────────────────────────────────────

function buildRecommendations(
  score: number,
  data: RecoveryData,
  daysSinceRest: number
): string[] {
  const recs: string[] = []
  const { wellness, sleepLogs } = data

  const avgSleep =
    sleepLogs.length > 0
      ? sleepLogs.reduce((acc, s) => acc + s.quality, 0) / sleepLogs.length
      : null

  const avgStress =
    wellness.length > 0
      ? wellness.reduce((acc, w) => acc + w.stressLevel, 0) / wellness.length
      : null

  if (score < 50) {
    recs.push('Planifie un jour de repos demain — ton score de récupération est bas.')
  }

  if (avgSleep !== null && avgSleep < 3) {
    recs.push('Priorité #1 : améliore ton sommeil — vise 8h, magnésium 300mg le soir.')
  }

  if (avgStress !== null && avgStress > 3.5) {
    recs.push('Le stress chronique freine ta progression — cortisol élevé = moins de masse.')
  }

  if (daysSinceRest >= 5) {
    recs.push(`Tu n'as pas eu de jour de repos depuis ${daysSinceRest} jours — planifie-en un.`)
  }

  if (recs.length === 0) {
    recs.push('Ta récupération est bonne — continue sur cette lancée.')
  }

  return recs.slice(0, 3)
}

// ── Color based on score ──────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 70) return { text: 'text-green-400', bg: 'bg-green-400', ring: 'text-green-400' }
  if (score >= 45) return { text: 'text-accent-yellow', bg: 'bg-accent-yellow', ring: 'text-accent-yellow' }
  return { text: 'text-red-400', bg: 'bg-red-400', ring: 'text-red-400' }
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Excellente'
  if (score >= 55) return 'Correcte'
  if (score >= 35) return 'Limitée'
  return 'Faible'
}

// ── RecoveryAdvisor ───────────────────────────────────────────────────────────

export function RecoveryAdvisor() {
  const [score, setScore] = useState<number | null>(null)
  const [recs, setRecs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [analysisRequested, setAnalysisRequested] = useState(false)
  const { sendMessage, isStreaming } = useCoach()

  useEffect(() => {
    async function load() {
      setLoading(true)

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const wellness = await db.dailyWellness
        .where('date')
        .aboveOrEqual(sevenDaysAgo)
        .toArray()

      const sleepLogs = await db.sleepLogs
        .where('date')
        .aboveOrEqual(sevenDaysAgo)
        .toArray()

      const recentSessions = await db.workoutSessions
        .where('date')
        .aboveOrEqual(sevenDaysAgo)
        .toArray()

      const data: RecoveryData = { wellness, sleepLogs, recentSessions }
      const computed = computeRecoveryScore(data)
      const daysSinceRest = getDaysSinceLastRest(recentSessions)
      const recommendations = buildRecommendations(computed, data, daysSinceRest)

      setScore(computed)
      setRecs(recommendations)
      setLoading(false)
    }

    load()
  }, [])

  async function handleAnalyzeWithAI() {
    setAnalysisRequested(true)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const wellness = await db.dailyWellness
      .where('date')
      .aboveOrEqual(sevenDaysAgo)
      .toArray()

    const sleepLogs = await db.sleepLogs
      .where('date')
      .aboveOrEqual(sevenDaysAgo)
      .toArray()

    const recentSessions = await db.workoutSessions
      .where('date')
      .aboveOrEqual(sevenDaysAgo)
      .toArray()

    const avgSleep =
      sleepLogs.length > 0
        ? (sleepLogs.reduce((acc, s) => acc + s.hoursSlept, 0) / sleepLogs.length).toFixed(1)
        : 'N/A'
    const avgQuality =
      sleepLogs.length > 0
        ? (sleepLogs.reduce((acc, s) => acc + s.quality, 0) / sleepLogs.length).toFixed(1)
        : 'N/A'
    const avgStress =
      wellness.length > 0
        ? (wellness.reduce((acc, w) => acc + w.stressLevel, 0) / wellness.length).toFixed(1)
        : 'N/A'
    const avgSoreness =
      wellness.length > 0
        ? (wellness.reduce((acc, w) => acc + w.soreness, 0) / wellness.length).toFixed(1)
        : 'N/A'
    const daysSinceRest = getDaysSinceLastRest(recentSessions)

    const msg = [
      'ANALYSE DE RÉCUPÉRATION — 7 derniers jours',
      '',
      `Score de récupération calculé : ${score}/100`,
      `Séances réalisées : ${recentSessions.length}`,
      `Jours consécutifs sans repos : ${daysSinceRest}`,
      `Sommeil moyen : ${avgSleep}h · Qualité moyenne : ${avgQuality}/5`,
      `Stress moyen : ${avgStress}/5 · Courbatures moyennes : ${avgSoreness}/5`,
      '',
      'Fais-moi une analyse complète de ma récupération et donne-moi 3 actions prioritaires concrètes pour optimiser ma progression cette semaine.',
    ].join('\n')

    await sendMessage(msg, 'chat')
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-6">
        <p className="font-body text-xs text-[rgba(240,237,230,0.6)]">Calcul du score…</p>
      </div>
    )
  }

  const colors = score !== null ? getScoreColor(score) : getScoreColor(50)
  const label = score !== null ? getScoreLabel(score) : '–'

  return (
    <div className="card flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-body text-sm font-medium text-[#f0ede6]">
          Récupération (7j)
        </p>
        <span className={`font-mono text-[9px] px-2 py-0.5 rounded ${
          (score ?? 0) >= 70
            ? 'text-green-400/70 bg-green-400/10'
            : (score ?? 0) >= 45
            ? 'text-accent-yellow/70 bg-accent-yellow/10'
            : 'text-red-400/70 bg-red-400/10'
        }`}>
          {label}
        </span>
      </div>

      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="rgba(240,237,230,0.08)"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * (1 - (score ?? 0) / 100)}`}
              className={`${colors.ring} transition-all duration-700`}
            />
          </svg>
          <span className={`absolute font-display text-lg leading-none ${colors.text}`}>
            {score}
          </span>
        </div>

        {/* Recommendations */}
        <div className="flex-1 flex flex-col gap-1.5">
          {recs.map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs mt-0.5 flex-shrink-0">
                {i === 0 && score !== null && score < 50 ? '🔴' : i === 0 ? '✅' : '💡'}
              </span>
              <p className="font-body text-xs text-[rgba(240,237,230,0.65)] leading-relaxed">
                {rec}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis button */}
      <button
        onClick={handleAnalyzeWithAI}
        disabled={isStreaming || analysisRequested}
        className="w-full h-10 rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 font-body text-sm text-accent-yellow font-medium active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isStreaming && analysisRequested
          ? 'Analyse en cours…'
          : analysisRequested
          ? 'Analyse envoyée au coach'
          : 'Analyser avec l\'IA'}
      </button>
    </div>
  )
}
