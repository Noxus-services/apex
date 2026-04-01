import { useState, useEffect } from 'react'
import { useWorkoutStore } from '../store/workoutStore'
import { useWorkout } from '../hooks/useWorkout'
import { useCoach } from '../hooks/useCoach'
import { db } from '../db/database'
import { ActiveSession } from '../components/workout/ActiveSession'
import { SessionSummary } from '../components/workout/SessionSummary'
import type { ProgramDay, WorkoutSession, PR } from '../types'

type WorkoutPhase = 'ready' | 'active' | 'summary'

interface ReadyScreenProps {
  programDay: ProgramDay | null
  isLoading: boolean
  onStart: () => void
  hasActiveProgram: boolean
  onNavigate: (page: string) => void
}

function ReadyScreen({
  programDay,
  isLoading,
  onStart,
  hasActiveProgram,
  onNavigate,
}: ReadyScreenProps) {
  if (!hasActiveProgram) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="text-5xl">📋</span>
        <div>
          <h1 className="font-display text-4xl text-[#f0ede6] mb-2">PAS DE PROGRAMME</h1>
          <p className="text-sm text-[rgba(240,237,230,0.5)] leading-relaxed">
            Tu n'as pas encore de programme actif. Génère-en un depuis l'accueil ou le coach IA.
          </p>
        </div>
        <button
          onClick={() => onNavigate('home')}
          className="btn-primary"
        >
          ALLER À L'ACCUEIL
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-accent-yellow/30 border-t-accent-yellow rounded-full animate-spin" />
        <p className="font-mono text-sm text-[rgba(240,237,230,0.5)] animate-pulse">
          Chargement de la séance...
        </p>
      </div>
    )
  }

  if (!programDay) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">😴</span>
        <div>
          <h1 className="font-display text-3xl text-[#f0ede6] mb-2">REPOS AUJOURD'HUI</h1>
          <p className="text-sm text-[rgba(240,237,230,0.5)]">
            Pas de séance prévue pour aujourd'hui selon ton programme.
          </p>
        </div>
      </div>
    )
  }

  const totalSets = programDay.exercises.reduce((acc, ex) => acc + ex.sets, 0)

  return (
    <div className="page-container px-4 pt-6 flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)] mb-1">
          PRÊT À COMMENCER ?
        </p>
        <h1 className="font-display text-4xl text-[#f0ede6] leading-none">
          {programDay.name.toUpperCase()}
        </h1>
        <p className="text-sm text-[rgba(240,237,230,0.5)] mt-1">{programDay.focus}</p>
      </div>

      {/* Meta row */}
      <div className="flex gap-3">
        <div className="flex-1 card-elevated flex flex-col items-center py-4">
          <span className="font-display text-2xl text-[#f0ede6]">{programDay.exercises.length}</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)] mt-1">Exercices</span>
        </div>
        <div className="flex-1 card-elevated flex flex-col items-center py-4">
          <span className="font-display text-2xl text-[#f0ede6]">{totalSets}</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)] mt-1">Séries</span>
        </div>
        <div className="flex-1 card-elevated flex flex-col items-center py-4">
          <span className="font-display text-2xl text-[#f0ede6]">{programDay.estimatedDuration}</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)] mt-1">Min</span>
        </div>
      </div>

      {/* Exercise list */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
          PROGRAMME
        </p>
        {programDay.exercises.map((ex, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="font-mono text-xs text-[rgba(240,237,230,0.25)] w-5 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-body text-sm text-[rgba(240,237,230,0.85)]">{ex.name}</p>
              <p className="text-xs font-mono text-[rgba(240,237,230,0.35)] mt-0.5">
                {ex.sets} × {ex.repsMin}–{ex.repsMax} reps · RPE {ex.rpe}
              </p>
              {ex.notes && (
                <p className="text-xs text-[rgba(240,237,230,0.3)] mt-0.5 italic">{ex.notes}</p>
              )}
            </div>
            <span className="text-xs font-mono text-[rgba(240,237,230,0.25)] mt-0.5">
              {ex.restSeconds}s
            </span>
          </div>
        ))}
      </div>

      {/* Start CTA */}
      <div className="pt-2">
        <button onClick={onStart} className="btn-primary w-full font-display text-xl tracking-wide">
          COMMENCER LA SÉANCE
        </button>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function WorkoutPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [phase, setPhase] = useState<WorkoutPhase>('ready')
  const [finishedSession, setFinishedSession] = useState<(WorkoutSession & { prs: PR[] }) | null>(null)
  const [programDay, setProgramDay] = useState<ProgramDay | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasActiveProgram, setHasActiveProgram] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { session, isSessionActive, startSession } = useWorkoutStore()
  const { finishSession } = useWorkout()
  const { analyzeWorkout } = useCoach()

  // If a session is already active (e.g. page reload), jump to active phase
  useEffect(() => {
    if (isSessionActive && session) {
      setPhase('active')
    }
  }, []) // intentionally only on mount

  // Load today's program day on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const activeProgram = await db.programs.filter(p => p.isActive === true).first()
        if (!activeProgram) {
          setHasActiveProgram(false)
          setIsLoading(false)
          return
        }
        setHasActiveProgram(true)

        // Determine today's day index within the program
        // Use sessions count to pick the next unfinished day
        const weekIndex = Math.max(0, (activeProgram.weekNumber ?? 1) - 1)
        const week = activeProgram.weeks?.[weekIndex] ?? activeProgram.weeks?.[0]
        if (!week) {
          setIsLoading(false)
          return
        }

        // Find today's day by matching today's weekday to dayIndex
        const todayDow = new Date().getDay() // 0=Sun,1=Mon,...
        const dayOfWeek = todayDow === 0 ? 6 : todayDow - 1 // convert to 0=Mon,...,6=Sun

        // Try to find matching day, otherwise take first available
        const todayDay =
          week.days.find(d => d.dayIndex === dayOfWeek) ?? week.days[0] ?? null
        setProgramDay(todayDay)
      } catch (err) {
        console.error('[WorkoutPage] load error:', err)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  async function handleStart() {
    if (!programDay) return
    setStartError(null)
    setIsLoading(true)

    try {
      // Build default weight suggestions: 20kg for each exercise
      // A real implementation would query history via suggestNextWeight
      const suggestions: Record<string, number> = {}
      for (const ex of programDay.exercises) {
        // Try to get last logged weight from history
        const history = await db.workoutSessions.toArray()
        let suggested = 20
        for (const sess of history) {
          const loggedEx = sess.exercises.find(e => e.exerciseId === ex.exerciseId)
          if (loggedEx) {
            const workSets = loggedEx.sets.filter(s => s.completed && !s.isWarmup)
            if (workSets.length > 0) {
              suggested = workSets[workSets.length - 1].weight
            }
          }
        }
        suggestions[ex.exerciseId] = suggested
      }

      startSession(programDay, suggestions)
      setPhase('active')
    } catch (err) {
      console.error('[WorkoutPage] start error:', err)
      setStartError('Impossible de démarrer la séance. Réessaye.')
    }
    setIsLoading(false)
  }

  async function handleFinish(mood: number, energy: number, notes: string) {
    try {
      const result = await finishSession(mood, energy, notes)
      if (result) {
        setFinishedSession(result as WorkoutSession & { prs: PR[] })
        setPhase('summary')
        // Kick off AI analysis in background (non-blocking)
        analyzeWorkout(result as unknown as WorkoutSession, programDay).catch(
          err => console.warn('[WorkoutPage] AI analysis failed:', err)
        )
      }
    } catch (err) {
      console.error('[WorkoutPage] finish error:', err)
    }
  }

  function handleCancel() {
    // In a real app you'd want a confirmation dialog
    useWorkoutStore.getState().clearSession()
    setPhase('ready')
  }

  function handleDone() {
    setFinishedSession(null)
    setPhase('ready')
    if (onNavigate) onNavigate('home')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'active') {
    return (
      <ActiveSession
        onFinish={handleFinish}
        onCancel={handleCancel}
      />
    )
  }

  if (phase === 'summary' && finishedSession) {
    return (
      <SessionSummary
        session={finishedSession}
        onDone={handleDone}
      />
    )
  }

  return (
    <>
      <ReadyScreen
        programDay={programDay}
        isLoading={isLoading}
        onStart={handleStart}
        hasActiveProgram={hasActiveProgram}
        onNavigate={onNavigate ?? (() => {})}
      />
      {startError && (
        <div className="fixed bottom-28 left-4 right-4 bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm font-body rounded-lg px-4 py-3 text-center">
          {startError}
        </div>
      )}
    </>
  )
}
