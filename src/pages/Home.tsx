import { useEffect, useState } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { getMorningBrief, detectPatterns, checkDeloadNeeded, detectStagnations, generateProactiveCoachMessage, type PatternInsight, type DeloadSuggestion } from '../services/apexBrain'
import { useUserStore } from '../store/userStore'
import { useCoach } from '../hooks/useCoach'
import { useCoachStore } from '../store/coachStore'
import { db } from '../db/database'
import { NextWorkout } from '../components/dashboard/NextWorkout'
import { ProgressCharts } from '../components/dashboard/ProgressCharts'
import { SupplementReminder } from '../components/dashboard/SupplementReminder'
import { CoachChat } from '../components/coach/CoachChat'
import { WellnessCheck } from '../components/dashboard/WellnessCheck'
import { SleepTracker } from '../components/dashboard/SleepTracker'
import type { Program, WorkoutSession, PR } from '../types'
import { computeStreak } from '../utils/calculations'

// ─── Props ───────────────────────────────────────────────────────────────────

interface HomeProps {
  onNavigate: (page: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFrenchDate(): string {
  const now = new Date()
  const dayName = now.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dayMonth = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  // Week number within month (rough: ceil of day/7)
  const weekOfMonth = Math.ceil(now.getDate() / 7)

  const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1)
  return `${dayCapitalized} ${dayMonth} · Semaine ${weekOfMonth}`
}

const DEFAULT_MOTIVATION = [
  'La progression est la seule direction.',
  'Chaque séance compte. Montre-toi.',
  'Le meilleur moment, c\'est maintenant.',
  'Les champions s\'entraînent même sans motivation.',
  'Concentre-toi sur la prochaine répétition.',
]

function getDefaultMotivation(): string {
  const idx = new Date().getDate() % DEFAULT_MOTIVATION.length
  return DEFAULT_MOTIVATION[idx]
}

// ─── Weekly Stats ─────────────────────────────────────────────────────────────

function WeeklyStats({
  sessions,
  prs,
  streak,
}: {
  sessions: WorkoutSession[]
  prs: PR[]
  streak: number
}) {
  const now = new Date()
  // Start of current week (Monday)
  const weekStart = new Date(now)
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  weekStart.setDate(now.getDate() + diffToMonday)
  weekStart.setHours(0, 0, 0, 0)

  const weeklySessions = sessions.filter(s => new Date(s.date) >= weekStart)
  const weeklyVolume = weeklySessions.reduce((acc, s) => acc + (s.totalVolume ?? 0), 0)

  // PRs this month (kept for potential future use)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  void prs.filter(pr => new Date(pr.date) >= monthStart)

  const stats = [
    {
      label: 'Séances',
      value: weeklySessions.length.toString(),
      sub: 'cette semaine',
      highlight: false,
    },
    {
      label: 'Volume',
      value: weeklyVolume >= 1000
        ? `${(weeklyVolume / 1000).toFixed(1)}t`
        : `${Math.round(weeklyVolume)}kg`,
      sub: 'cette semaine',
      highlight: false,
    },
    {
      label: streak > 0 ? `🔥 Streak` : 'Streak',
      value: streak > 0 ? `${streak}j` : '0',
      sub: streak >= 7 ? '🎯 7 jours !' : streak >= 3 ? 'continue !' : 'commence ici',
      highlight: streak >= 3,
    },
  ]

  return (
    <div className="flex gap-3">
      {stats.map(stat => (
        <div key={stat.label} className={`card flex-1 flex flex-col items-center py-3 ${stat.highlight ? 'border-accent-yellow/30 bg-accent-yellow/[0.03]' : ''}`}>
          <span className={`font-display text-2xl leading-none ${stat.highlight ? 'text-accent-yellow' : 'text-[#f0ede6]'}`}>{stat.value}</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-0.5 text-center leading-tight">
            {stat.label}
          </span>
          <span className="font-body text-[10px] text-[rgba(240,237,230,0.5)] text-center leading-tight">
            {stat.sub}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Recent PRs ───────────────────────────────────────────────────────────────

function RecentPRs({ sessions }: { sessions: WorkoutSession[] }) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const recentPRs = sessions
    .filter(s => new Date(s.date) >= sevenDaysAgo)
    .flatMap(s =>
      (s.prsAchieved ?? []).map(pr => ({ ...pr, sessionDate: s.date }))
    )
    .slice(0, 3)

  if (recentPRs.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest">
        Records récents
      </p>
      {recentPRs.map((pr, i) => (
        <div key={i} className="card flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="font-body font-medium text-[#f0ede6] text-sm truncate">
              {pr.exerciseName}
            </p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.7)]">
              {pr.type.toUpperCase()} · {pr.previousValue} → {pr.value} kg
            </p>
          </div>
          <p className="font-body text-xs text-[rgba(240,237,230,0.7)] flex-shrink-0">
            {new Date(pr.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export function Home({ onNavigate }: HomeProps) {
  const { profile } = useUserStore()
  const { checkWeeklyReview, messages, generateDailyCoaching } = useCoach()
  const coachStore = useCoachStore()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const [program, setProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [allPRs, setAllPRs] = useState<PR[]>([])
  const [todayWellness, setTodayWellness] = useState<import('../types').DailyWellness | null>(null)
  const [apexBrief, setApexBrief] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState(false)
  const [patterns, setPatterns] = useState<PatternInsight[]>([])
  const [deloadSuggestion, setDeloadSuggestion] = useState<DeloadSuggestion | null>(null)
  const [showRegenSuggestion, setShowRegenSuggestion] = useState(false)
  const [stagnationCount, setStagnationCount] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    async function init() {
      // Load active program
      const activeProgram = await db.programs.filter(p => p.isActive === true).first()
      setProgram(activeProgram ?? null)

      // Load recent sessions for chart (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const rawSessions = await db.workoutSessions
        .where('date')
        .aboveOrEqual(thirtyDaysAgo)
        .toArray()
      const recentSessions = rawSessions.map(s => ({ ...s, date: new Date(s.date) }))
      setSessions(recentSessions)

      // Compute current streak (local timezone, deduped)
      setStreak(computeStreak(recentSessions))

      // Collect all PRs from sessions
      const prs: PR[] = recentSessions.flatMap(s => s.prsAchieved ?? [])
      setAllPRs(prs)

      // Load today's wellness for NextWorkout alert
      const wStart = new Date(); wStart.setHours(0,0,0,0)
      const wEnd = new Date(); wEnd.setHours(23,59,59,999)
      const todayW = await db.dailyWellness.where('date').between(wStart, wEnd, true, true).first()
      setTodayWellness(todayW ?? null)

      // Generate morning brief (cached per day)
      if (profile) {
        setBriefLoading(true)
        const allSessions = await db.workoutSessions.orderBy('date').reverse().limit(20).toArray()
        const detected = detectPatterns(allSessions, profile)
        setPatterns(detected)
        const wellness = todayW ? { stressLevel: todayW.stressLevel, soreness: todayW.soreness } : null
        const deload = checkDeloadNeeded(detected, allSessions, wellness)
        if (deload.shouldDeload) setDeloadSuggestion(deload)

        // Check if regen suggestion should be shown
        const stags = detectStagnations(allSessions, 3)
        setStagnationCount(stags.length)
        const isNearingEnd = activeProgram != null &&
          activeProgram.weekNumber >= activeProgram.weeks.length - 1
        const regenDismissKey = `apex_regen_dismissed_${new Date().toISOString().slice(0, 10)}`
        const dismissed = localStorage.getItem(regenDismissKey) === '1'
        if (!dismissed && (stags.length >= 2 || isNearingEnd)) {
          setShowRegenSuggestion(true)
        }

        getMorningBrief(profile, allSessions, todayW ?? null, activeProgram ?? null)
          .then(brief => { setApexBrief(brief); setBriefLoading(false); setBriefError(false) })
          .catch(() => { setBriefLoading(false); setBriefError(true) })

        // Generate proactive coaching for most critical pattern
        const criticalPatterns = detected.filter(p => p.severity === 'critical' || p.severity === 'warning')
        if (criticalPatterns.length > 0 && profile) {
          // Run async, non-blocking
          generateProactiveCoachMessage(criticalPatterns[0], profile, allSessions)
            .then(msg => {
              if (msg) {
                const proactiveMsg = {
                  role: 'assistant' as const,
                  content: `🔔 **Message APEX**\n\n${msg}`,
                  timestamp: new Date(),
                  context: 'chat' as const,
                }
                coachStore.addMessage(proactiveMsg)
                // Also persist to DB
                import('../db/database').then(({ db }) => db.coachMessages.add(proactiveMsg))
              }
            })
            .catch(() => {})
        }
      }

      // Check weekly review
      checkWeeklyReview()

      // Auto weekly review: trigger Sunday evenings (≥18h) once per week
      const now = new Date()
      const isSundayEvening = now.getDay() === 0 && now.getHours() >= 18
      const sundayKey = `apex_sunday_review_${now.toLocaleDateString('en-CA')}`
      if (isSundayEvening && !localStorage.getItem(sundayKey)) {
        localStorage.setItem(sundayKey, '1')
        // Trigger weekly review non-blocking
        checkWeeklyReview(true).catch(() => {})
      }
    }

    init()
  }, [])

  // Get last AI message for display
  const lastAIMessage = [...messages]
    .reverse()
    .find(m => m.role === 'assistant')

  const aiMessage = lastAIMessage?.content?.slice(0, 200) ?? getDefaultMotivation()

  const firstName = profile?.name?.split(' ')[0] ?? 'Athlète'

  function handleStartWorkout() {
    onNavigate('workout')
  }

  async function handleRefreshBrief() {
    if (!profile || briefLoading) return
    setBriefLoading(true)
    const { refreshMorningBrief } = await import('../services/apexBrain')
    const allSessions = await db.workoutSessions.orderBy('date').reverse().limit(20).toArray()
    refreshMorningBrief(profile, allSessions, todayWellness, program)
      .then(brief => { setApexBrief(brief); setBriefLoading(false); setBriefError(false) })
      .catch(() => { setBriefLoading(false); setBriefError(true) })
  }

  return (
    <div className="page-container">
      {/* Safe area spacing */}
      <div
        className="px-4 pb-6"
        style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 16px)` }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-5">
          <h1 className="font-display text-[28px] text-[#f0ede6] leading-none">
            Bonjour {firstName}
          </h1>
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)] mt-1">
            {getFrenchDate()}
          </p>
        </div>

        {/* ── APEX Brief ─────────────────────────────────────────────── */}
        <div className="ai-card mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {briefLoading && !apexBrief ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-accent-yellow/30 border-t-accent-yellow rounded-full animate-spin flex-shrink-0" />
                  <span className="font-body text-xs text-[rgba(240,237,230,0.5)] animate-pulse">APEX analyse tes données…</span>
                </div>
              ) : briefError && !apexBrief ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[rgba(240,237,230,0.45)]">⚠️ Brief indisponible — vérifie ta connexion.</span>
                </div>
              ) : (
                <p className="font-body text-sm text-[rgba(240,237,230,0.88)] leading-relaxed">
                  {apexBrief || aiMessage}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="section-label text-accent-yellow/70">APEX</span>
              <button
                onClick={handleRefreshBrief}
                disabled={briefLoading}
                className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[rgba(240,237,230,0.4)] active:scale-90 transition-all disabled:opacity-30"
              >
                <RefreshCw size={11} className={briefLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Pattern alerts */}
          {patterns.filter(p => p.severity === 'warning' || p.severity === 'critical').slice(0, 2).map((p, i) => (
            <div key={i} className="mt-2 flex items-center gap-2 pt-2 border-t border-accent-yellow/[0.08]">
              <span className="text-xs flex-shrink-0">{p.severity === 'critical' ? '🔴' : '🟡'}</span>
              <span className="font-body text-xs text-[rgba(240,237,230,0.65)]">{p.message}</span>
            </div>
          ))}
          {patterns.filter(p => p.severity === 'good').slice(0, 1).map((p, i) => (
            <div key={i} className="mt-2 flex items-center gap-2 pt-2 border-t border-accent-yellow/[0.08]">
              <span className="text-xs flex-shrink-0">🟢</span>
              <span className="font-body text-xs text-[rgba(240,237,230,0.65)]">{p.message}</span>
            </div>
          ))}
        </div>

        {/* ── Deload Recommendation Banner ────────────────────────────── */}
        {deloadSuggestion?.shouldDeload && (
          <div className="bg-orange-500/[0.08] border border-orange-500/25 rounded-xl px-4 py-3 mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-sm">⚠️</span>
              <span className="font-mono text-xs text-orange-400 uppercase tracking-widest">RÉCUPÉRATION RECOMMANDÉE</span>
            </div>
            <p className="font-body text-sm text-[rgba(240,237,230,0.8)]">
              APEX détecte {deloadSuggestion.reason}. Une semaine de décharge (−30% volume, −15% poids) optimiserait ta progression.
            </p>
            <div className="flex flex-wrap gap-1">
              {deloadSuggestion.details.map((d, i) => (
                <span key={i} className="font-mono text-[10px] text-orange-400/70 bg-orange-400/[0.08] px-2 py-0.5 rounded">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Regen Suggestion Banner ─────────────────────────────────── */}
        {showRegenSuggestion && program && (
          <div className="bg-accent-yellow/[0.06] border border-accent-yellow/20 rounded-xl px-4 py-3 mb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-accent-yellow/80 uppercase tracking-widest">APEX RECOMMANDE</span>
              <button onClick={() => {
                setShowRegenSuggestion(false)
                localStorage.setItem(`apex_regen_dismissed_${new Date().toISOString().slice(0, 10)}`, '1')
              }} className="text-[rgba(240,237,230,0.4)] text-xs">✕</button>
            </div>
            <p className="font-body text-sm text-[rgba(240,237,230,0.8)]">
              {program.weekNumber >= program.weeks.length - 1
                ? `Programme semaine ${program.weekNumber}/${program.weeks.length} — prêt pour un nouveau cycle ?`
                : `${stagnationCount} exercice${stagnationCount > 1 ? 's' : ''} en plateau depuis 3+ séances — un nouveau programme maximiserait tes gains.`
              }
            </p>
            <button
              onClick={() => onNavigate('profile')}
              className="self-start font-mono text-xs text-accent-yellow/70 underline active:opacity-70"
            >
              Générer un nouveau programme →
            </button>
          </div>
        )}

        {/* ── Sleep Tracker ────────────────────────────────────────────── */}
        <div className="mb-4">
          <SleepTracker />
        </div>

        {/* ── Today's Workout ─────────────────────────────────────────── */}
        <div className="mb-4">
          <NextWorkout program={program} sessions={sessions} wellness={todayWellness} onStart={handleStartWorkout} />
        </div>

        {/* ── Weekly Stats ────────────────────────────────────────────── */}
        <div className="mb-4">
          <WeeklyStats sessions={sessions} prs={allPRs} streak={streak} />
        </div>

        {/* ── Recent PRs ──────────────────────────────────────────────── */}
        <div className="mb-4">
          <RecentPRs sessions={sessions} />
        </div>

        {/* ── Volume Chart ────────────────────────────────────────────── */}
        <div className="mb-4">
          <ProgressCharts sessions={sessions} />
        </div>

        {/* ── Wellness Check ───────────────────────────────────────────── */}
        <div className="mb-2">
          <WellnessCheck onSaved={generateDailyCoaching} />
        </div>

        {/* ── Supplement Reminder ─────────────────────────────────────── */}
        <div className="mb-2">
          <SupplementReminder />
        </div>
      </div>

      {/* ── APEX FAB ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsChatOpen(v => !v)}
        className="fixed bottom-[84px] right-4 z-50 flex items-center gap-2 bg-accent-yellow text-bg-base pl-3 pr-4 h-11 rounded-full active:scale-95 transition-transform duration-75 select-none font-body font-semibold text-sm"
        style={{ boxShadow: '0 2px 20px rgba(232,255,71,0.25)' }}
        aria-label="Parler à APEX"
      >
        <MessageCircle size={16} strokeWidth={2.2} />
        APEX
      </button>

      {/* ── CoachChat Bottom Sheet ───────────────────────────────────── */}
      <CoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
