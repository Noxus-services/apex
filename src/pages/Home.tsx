import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useUserStore } from '../store/userStore'
import { useCoach } from '../hooks/useCoach'
import { db } from '../db/database'
import { Card } from '../components/ui/Card'
import { NextWorkout } from '../components/dashboard/NextWorkout'
import { ProgressCharts } from '../components/dashboard/ProgressCharts'
import { SupplementReminder } from '../components/dashboard/SupplementReminder'
import { CoachChat } from '../components/coach/CoachChat'
import { WellnessCheck } from '../components/dashboard/WellnessCheck'
import { SleepTracker } from '../components/dashboard/SleepTracker'
import type { Program, WorkoutSession, PR } from '../types'

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
}: {
  sessions: WorkoutSession[]
  prs: PR[]
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

  // PRs this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthPRs = prs.filter(pr => new Date(pr.date) >= monthStart)

  const stats = [
    {
      label: 'Séances',
      value: weeklySessions.length.toString(),
      sub: 'cette semaine',
    },
    {
      label: 'Volume',
      value: weeklyVolume >= 1000
        ? `${(weeklyVolume / 1000).toFixed(1)}t`
        : `${Math.round(weeklyVolume)}kg`,
      sub: 'cette semaine',
    },
    {
      label: 'PRs',
      value: monthPRs.length.toString(),
      sub: 'ce mois',
    },
  ]

  return (
    <div className="flex gap-3">
      {stats.map(stat => (
        <div key={stat.label} className="card flex-1 flex flex-col items-center py-3">
          <span className="font-display text-2xl text-[#f0ede6] leading-none">{stat.value}</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5 text-center leading-tight">
            {stat.label}
          </span>
          <span className="font-body text-[10px] text-[rgba(240,237,230,0.25)] text-center leading-tight">
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
      <p className="font-body text-xs text-[rgba(240,237,230,0.4)] uppercase tracking-widest">
        Records récents
      </p>
      {recentPRs.map((pr, i) => (
        <div key={i} className="card flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="font-body font-medium text-[#f0ede6] text-sm truncate">
              {pr.exerciseName}
            </p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.4)]">
              {pr.type.toUpperCase()} · {pr.previousValue} → {pr.value} kg
            </p>
          </div>
          <p className="font-body text-xs text-[rgba(240,237,230,0.4)] flex-shrink-0">
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
  const [isChatOpen, setIsChatOpen] = useState(false)

  const [program, setProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [allPRs, setAllPRs] = useState<PR[]>([])

  useEffect(() => {
    async function init() {
      // Load active program
      const activeProgram = await db.programs.filter(p => p.isActive === true).first()
      setProgram(activeProgram ?? null)

      // Load recent sessions for chart (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentSessions = await db.workoutSessions
        .where('date')
        .aboveOrEqual(thirtyDaysAgo)
        .toArray()
      setSessions(recentSessions)

      // Collect all PRs from sessions
      const prs: PR[] = recentSessions.flatMap(s => s.prsAchieved ?? [])
      setAllPRs(prs)

      // Check weekly review
      checkWeeklyReview()
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
          <p className="font-body text-sm text-[rgba(240,237,230,0.4)] mt-1">
            {getFrenchDate()}
          </p>
        </div>

        {/* ── AI Card ─────────────────────────────────────────────────── */}
        <Card ai className="mb-4 relative">
          <div className="flex items-start justify-between gap-2">
            <p className="font-body text-sm text-[rgba(240,237,230,0.85)] leading-relaxed flex-1 line-clamp-4">
              {aiMessage}
            </p>
            <span className="font-mono text-[10px] text-accent-blue/60 bg-accent-blue/10 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
              APEX IA
            </span>
          </div>
        </Card>

        {/* ── Sleep Tracker ────────────────────────────────────────────── */}
        <div className="mb-4">
          <SleepTracker />
        </div>

        {/* ── Today's Workout ─────────────────────────────────────────── */}
        <div className="mb-4">
          <NextWorkout program={program} onStart={handleStartWorkout} />
        </div>

        {/* ── Weekly Stats ────────────────────────────────────────────── */}
        <div className="mb-4">
          <WeeklyStats sessions={sessions} prs={allPRs} />
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

      {/* ── Floating Coach Button ────────────────────────────────────── */}
      <button
        onClick={() => setIsChatOpen(v => !v)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 bg-accent-blue text-white px-4 py-3 rounded-full shadow-lg active:scale-95 transition-transform duration-100 select-none"
        style={{ boxShadow: '0 4px 24px rgba(56,184,255,0.35)' }}
        aria-label="Ouvrir le coach IA"
      >
        <MessageCircle size={20} />
        <span className="font-body font-medium text-sm">Coach IA</span>
      </button>

      {/* ── CoachChat Bottom Sheet ───────────────────────────────────── */}
      <CoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
