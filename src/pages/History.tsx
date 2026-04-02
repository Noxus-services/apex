import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { db } from '../db/database'
import { Card } from '../components/ui/Card'
import type { WorkoutSession } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
}

const ENERGY_EMOJI: Record<number, string> = {
  1: '🪫',
  2: '😴',
  3: '⚡',
  4: '⚡⚡',
  5: '🔥',
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h${rem.toString().padStart(2, '0')}` : `${h}h`
}

function formatDayName(date: Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type FilterTab = 'all' | 'month' | 'week'

function getFilterLabel(f: FilterTab): string {
  if (f === 'all') return 'Tout'
  if (f === 'month') return 'Ce mois'
  return 'Cette semaine'
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: WorkoutSession }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const prs = session.prsAchieved ?? []

  return (
    <div className="card flex flex-col gap-3">
      {/* ── Summary Row ──────────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full text-left flex items-start gap-3"
      >
        {/* Date block */}
        <div className="flex flex-col items-center justify-center bg-bg-elevated rounded-lg w-12 h-12 flex-shrink-0">
          <span className="font-display text-base text-[#f0ede6] leading-none">
            {new Date(session.date).getDate()}
          </span>
          <span className="font-body text-[9px] text-[rgba(240,237,230,0.7)] uppercase">
            {new Date(session.date).toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-medium text-[#f0ede6] truncate">{session.dayName}</p>
            {prs.length > 0 && (
              <div className="flex items-center gap-1 bg-accent-yellow/10 border border-accent-yellow/20 rounded-full px-2 py-0.5 flex-shrink-0">
                <Trophy size={10} className="text-accent-yellow" />
                <span className="font-mono text-[9px] text-accent-yellow">{prs.length} PR</span>
              </div>
            )}
          </div>
          <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-0.5">
            {formatDayName(session.date)}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-body text-xs text-[rgba(240,237,230,0.55)]">
              {session.totalVolume >= 1000
                ? `${(session.totalVolume / 1000).toFixed(1)}t`
                : `${Math.round(session.totalVolume)}kg`}
            </span>
            <span className="text-[rgba(240,237,230,0.45)]">·</span>
            <span className="font-body text-xs text-[rgba(240,237,230,0.55)]">
              {formatDuration(session.duration)}
            </span>
            <span className="text-[rgba(240,237,230,0.45)]">·</span>
            <span className="text-sm">{MOOD_EMOJI[session.mood] ?? '😐'}</span>
            <span className="text-sm">{ENERGY_EMOJI[session.energy] ?? '⚡'}</span>
          </div>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 text-[rgba(240,237,230,0.55)] mt-1">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* ── Expanded Detail ──────────────────────────────────────────── */}
      {isExpanded && (
        <div className="flex flex-col gap-4 border-t border-border-subtle pt-3">
          {/* Exercises list */}
          <div className="flex flex-col gap-2">
            <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
              Exercices
            </p>
            {session.exercises.map((ex, i) => {
              const workSets = ex.sets.filter(s => s.completed && !s.isWarmup)
              const totalVol = workSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
              const bestSet = workSets.reduce<typeof workSets[0] | null>((best, s) => {
                if (!best || s.weight > best.weight) return s
                return best
              }, null)

              return (
                <div key={i} className="bg-bg-elevated rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-body text-sm text-[#f0ede6] font-medium truncate">{ex.name}</p>
                    <span className="font-body text-xs text-[rgba(240,237,230,0.7)] flex-shrink-0">
                      {workSets.length} séries · {Math.round(totalVol)}kg
                    </span>
                  </div>
                  {bestSet && (
                    <p className="font-body text-xs text-[rgba(240,237,230,0.72)] mt-0.5">
                      Meilleure série : {bestSet.weight}kg × {bestSet.reps} reps
                      {bestSet.rpe ? ` @ RPE${bestSet.rpe}` : ''}
                    </p>
                  )}
                  {ex.notes && (
                    <p className="font-body text-xs text-[rgba(240,237,230,0.6)] mt-0.5 italic">
                      {ex.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* PRs achieved */}
          {prs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
                Records battus
              </p>
              {prs.map((pr, i) => (
                <div key={i} className="flex items-center gap-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-3 py-2">
                  <Trophy size={14} className="text-accent-yellow flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[#f0ede6] truncate">{pr.exerciseName}</p>
                    <p className="font-body text-xs text-accent-yellow/70">
                      {pr.type.toUpperCase()} · {pr.previousValue} → {pr.value} kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI feedback */}
          {session.aiCoachFeedback && (
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
                Feedback APEX
              </p>
              <div className="bg-accent-yellow/5 border border-accent-yellow/15 rounded-lg px-3 py-2.5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.7)] leading-relaxed">
                  {session.aiCoachFeedback}
                </p>
              </div>
            </div>
          )}

          {/* Session notes */}
          {session.notes && (
            <div className="flex flex-col gap-1">
              <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
                Notes
              </p>
              <p className="font-body text-sm text-[rgba(240,237,230,0.6)] italic">{session.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Summary Stats Bar ─────────────────────────────────────────────────────────

function SummaryStats({ sessions }: { sessions: WorkoutSession[] }) {
  const totalVolume = sessions.reduce((acc, s) => acc + (s.totalVolume ?? 0), 0)
  const totalPRs = sessions.reduce((acc, s) => acc + (s.prsAchieved?.length ?? 0), 0)

  const stats = [
    {
      label: 'Séances',
      value: sessions.length.toString(),
    },
    {
      label: 'Volume total',
      value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`,
    },
    {
      label: 'PRs',
      value: totalPRs.toString(),
    },
  ]

  return (
    <div className="flex gap-3">
      {stats.map(s => (
        <div key={s.label} className="card flex-1 flex flex-col items-center py-3 gap-0.5">
          <span className="font-display text-2xl text-[#f0ede6] leading-none">{s.value}</span>
          <span className="font-body text-[10px] text-[rgba(240,237,230,0.7)] text-center">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── HistoryPage ───────────────────────────────────────────────────────────────

export function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const all = await db.workoutSessions.orderBy('date').reverse().toArray()
      setSessions(all)
      setLoading(false)
    }
    load()
  }, [])

  // Apply filter
  const now = new Date()

  const filtered = sessions.filter(s => {
    const d = new Date(s.date)
    if (filter === 'week') {
      const weekStart = new Date(now)
      const dayOfWeek = now.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      weekStart.setDate(now.getDate() + diffToMonday)
      weekStart.setHours(0, 0, 0, 0)
      return d >= weekStart
    }
    if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return d >= monthStart
    }
    return true
  })

  const TABS: FilterTab[] = ['all', 'month', 'week']

  return (
    <div className="page-container">
      <div
        className="px-4 pb-6 flex flex-col gap-4"
        style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 16px)` }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="font-display text-[26px] text-[#f0ede6] leading-none tracking-wide">
            HISTORIQUE
          </h1>
          <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-1">
            {sessions.length} séance{sessions.length !== 1 ? 's' : ''} enregistrée{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* ── Filter Tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 h-9 rounded-lg font-body text-sm transition-colors ${
                filter === tab
                  ? 'bg-accent-yellow text-bg-base font-medium'
                  : 'bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.55)]'
              }`}
            >
              {getFilterLabel(tab)}
            </button>
          ))}
        </div>

        {/* ── Summary Stats ───────────────────────────────────────────── */}
        <SummaryStats sessions={filtered} />

        {/* ── Sessions List ───────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card h-20 animate-pulse bg-bg-elevated" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10">
            <span className="text-4xl">📋</span>
            <div className="text-center">
              <p className="font-body text-sm text-[rgba(240,237,230,0.6)]">
                Aucune séance trouvée
              </p>
              <p className="font-body text-xs text-[rgba(240,237,230,0.6)] mt-1">
                {filter === 'all'
                  ? 'Commence à t\'entraîner pour voir ton historique ici.'
                  : 'Aucune séance pour cette période.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
