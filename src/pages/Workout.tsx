import { useState, useEffect } from 'react'
import { useWorkoutStore } from '../store/workoutStore'
import { useWorkout } from '../hooks/useWorkout'
import { useCoach } from '../hooks/useCoach'
import { db } from '../db/database'
import { ActiveSession } from '../components/workout/ActiveSession'
import { SessionSummary } from '../components/workout/SessionSummary'
import type { ProgramDay, WorkoutSession, PR } from '../types'
import { getSessionStagnations, computeSleepAdjustment, type StagnationAlert, type SleepAdjustment } from '../services/apexBrain'

type WorkoutPhase = 'ready' | 'active' | 'summary'

interface ReadyScreenProps {
  programDay: ProgramDay | null
  isLoading: boolean
  onStart: () => void
  hasActiveProgram: boolean
  onNavigate: (page: string) => void
  stagnations?: StagnationAlert[]
  sleepAdjustment?: SleepAdjustment | null
  onSkip: (reason: string) => void
  skipReason: string | null
}

function ReadyScreen({
  programDay,
  isLoading,
  onStart,
  hasActiveProgram,
  onNavigate,
  stagnations = [],
  sleepAdjustment,
  onSkip,
  skipReason,
}: ReadyScreenProps) {
  const [showSkipPicker, setShowSkipPicker] = useState(false)

  // ── Skipped screen ─────────────────────────────────────────────────────────
  if (skipReason) {
    const advice: Record<string, string> = {
      sick: "Repose-toi complètement. Pas d'entraînement tant que tu as de la fièvre. Hydrate-toi, dors bien.",
      fatigue: "Écoute ton corps. Une journée de récupération active (marche, étirements) vaut mieux qu'une mauvaise séance.",
      travel: 'Pas de matériel ? Cardio léger ou HIIT bodyweight si tu veux bouger.',
      busy: "Ça arrive. Reprends demain en gardant l'intensité — ne compense pas en faisant trop.",
    }
    return (
      <div className="page-container flex flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="text-5xl">
          {skipReason === 'sick' ? '🤒' : skipReason === 'fatigue' ? '😴' : skipReason === 'travel' ? '✈️' : '📅'}
        </span>
        <div>
          <h1 className="font-display text-3xl text-[#f0ede6] leading-none mb-2">SÉANCE REPORTÉE</h1>
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed max-w-xs">
            {advice[skipReason] ?? 'Reprends dès que tu peux. La régularité sur le long terme prime.'}
          </p>
        </div>
        <button onClick={() => onSkip('')} className="btn-secondary">
          ← Retour
        </button>
      </div>
    )
  }

  // ── No program ─────────────────────────────────────────────────────────────
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
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mb-1">
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
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mt-1">Exercices</span>
        </div>
        <div className="flex-1 card-elevated flex flex-col items-center py-4">
          <span className="font-display text-2xl text-[#f0ede6]">{totalSets}</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mt-1">Séries</span>
        </div>
        <div className="flex-1 card-elevated flex flex-col items-center py-4">
          <span className="font-display text-2xl text-[#f0ede6]">{programDay.estimatedDuration}</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mt-1">Min</span>
        </div>
      </div>

      {/* Exercise list */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)]">
          PROGRAMME
        </p>
        {programDay.exercises.map((ex, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="font-mono text-xs text-[rgba(240,237,230,0.5)] w-5 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-body text-sm text-[rgba(240,237,230,0.85)]">{ex.name}</p>
              <p className="text-xs font-mono text-[rgba(240,237,230,0.6)] mt-0.5">
                {ex.sets} × {ex.repsMin}–{ex.repsMax} reps · RPE {ex.rpe}
              </p>
              {ex.notes && (
                <p className="text-xs text-[rgba(240,237,230,0.55)] mt-0.5 italic">{ex.notes}</p>
              )}
            </div>
            <span className="text-xs font-mono text-[rgba(240,237,230,0.5)] mt-0.5">
              {ex.restSeconds}s
            </span>
          </div>
        ))}
      </div>

      {/* Sleep adjustment banner */}
      {sleepAdjustment?.banner && (
        <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${
          sleepAdjustment.severity === 'rest'
            ? 'bg-accent-red/[0.06] border-accent-red/20'
            : sleepAdjustment.severity === 'reduce'
            ? 'bg-orange-500/[0.06] border-orange-500/20'
            : 'bg-accent-green/[0.06] border-accent-green/20'
        }`}>
          <div className="flex-1 min-w-0">
            <p className="font-body text-xs text-[rgba(240,237,230,0.8)] leading-relaxed">{sleepAdjustment.banner}</p>
          </div>
        </div>
      )}

      {/* Stagnation alerts */}
      {stagnations.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-accent-yellow/70 uppercase tracking-widest">
              ⚡ {stagnations.length} plateau{stagnations.length > 1 ? 'x' : ''} détecté{stagnations.length > 1 ? 's' : ''}
            </span>
          </div>
          {stagnations.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-accent-yellow/[0.06] border border-accent-yellow/20">
              <span className="text-sm flex-shrink-0 mt-0.5">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs font-semibold text-[#f0ede6]">{s.exerciseName}</p>
                <p className="font-body text-xs text-[rgba(240,237,230,0.65)]">
                  {s.reason} — tu es prêt à progresser. <span className="text-accent-yellow font-semibold">↑ {s.suggestedWeight}kg suggéré</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start CTA */}
      <div className="pt-2">
        <button onClick={onStart} className="btn-primary w-full font-display text-xl tracking-wide">
          COMMENCER LA SÉANCE
        </button>

        {/* Skip / reschedule */}
        {!showSkipPicker ? (
          <button
            onClick={() => setShowSkipPicker(true)}
            className="w-full pt-1 pb-2 font-body text-xs text-[rgba(240,237,230,0.45)] active:opacity-70"
          >
            Je ne peux pas aujourd'hui
          </button>
        ) : (
          <div className="flex flex-col gap-2 mt-1">
            <p className="font-body text-xs text-center text-[rgba(240,237,230,0.55)]">Pourquoi ?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'sick', label: '🤒 Malade' },
                { key: 'fatigue', label: '😴 Fatigué' },
                { key: 'travel', label: '✈️ En voyage' },
                { key: 'busy', label: '📅 Pas le temps' },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => { setShowSkipPicker(false); onSkip(r.key) }}
                  className="h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] font-body text-xs text-[rgba(240,237,230,0.7)] active:opacity-60"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSkipPicker(false)} className="text-xs text-center text-[rgba(240,237,230,0.4)] py-1">
              Annuler
            </button>
          </div>
        )}
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
  const [stagnationAlerts, setStagnationAlerts] = useState<StagnationAlert[]>([])
  const [sleepAdjustment, setSleepAdjustment] = useState<SleepAdjustment | null>(null)
  const [weekAdvanced, setWeekAdvanced] = useState<number | null>(null)
  const [programComplete, setProgramComplete] = useState(false)
  const [skipReason, setSkipReason] = useState<string | null>(null)

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

        // Load sleep + wellness for intensity adjustment
        try {
          const todayStart = new Date(); todayStart.setHours(0,0,0,0)
          const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)
          const yesterday = new Date(Date.now() - 24*60*60*1000)
          const [lastSleep, todayWellness] = await Promise.all([
            db.sleepLogs.where('date').aboveOrEqual(yesterday).last(),
            db.dailyWellness.where('date').between(todayStart, todayEnd, true, true).first()
          ])
          const adj = computeSleepAdjustment(
            lastSleep ? { hoursSlept: lastSleep.hoursSlept, quality: lastSleep.quality } : null,
            todayWellness ? { stressLevel: todayWellness.stressLevel, soreness: todayWellness.soreness, motivation: todayWellness.motivation } : null
          )
          if (adj.banner) setSleepAdjustment(adj)
        } catch { /* silently skip */ }

        // Determine today's day index within the program
        // Use sessions count to pick the next unfinished day
        const weekIndex = Math.max(0, (activeProgram.weekNumber ?? 1) - 1)
        const week = activeProgram.weeks?.[weekIndex] ?? activeProgram.weeks?.[0]

        // Check if program is completed
        if (!week || activeProgram.weekNumber > activeProgram.weeks.length) {
          const continueKey = `apex_program_continue_${activeProgram.id}`
          if (localStorage.getItem(continueKey) === '1') {
            // User already chose to continue anyway, skip complete screen
            setHasActiveProgram(true)
            setIsLoading(false)
            return
          }
          setProgramComplete(true)
          setIsLoading(false)
          return
        }

        // Find today's day by matching today's weekday to dayIndex
        const todayDow = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
        const dayIndex = todayDow === 0 ? 7 : todayDow // 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun

        // Try to find matching day, otherwise take first available
        const todayDay =
          week.days.find(d => d.dayIndex === dayIndex) ?? week.days[0] ?? null
        setProgramDay(todayDay)
        // Detect stagnations for today's exercises
        if (todayDay) {
          const history = await db.workoutSessions.orderBy('date').reverse().limit(30).toArray()
          const alerts = getSessionStagnations(todayDay.exercises, history)
          setStagnationAlerts(alerts)
        }
      } catch (err) {
        console.error('[WorkoutPage] load error:', err)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  function handleSkipToday(reason: string) {
    // Empty string means "go back" from skipped screen
    setSkipReason(reason || null)
  }

  async function handleStart() {
    if (!programDay) return
    setStartError(null)
    setIsLoading(true)

    try {
      // Check for duplicate session today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)
      const existingToday = await db.workoutSessions
        .where('date').between(todayStart, todayEnd, true, true)
        .filter(s => s.dayName === programDay.name)
        .first()
      if (existingToday) {
        setStartError(`Tu as déjà fait "${programDay.name}" aujourd'hui. Reprends demain !`)
        setIsLoading(false)
        return
      }

      // Load history ONCE, build index by exerciseId for O(n) lookups
      const allHistory = await db.workoutSessions.orderBy('date').reverse().toArray()
      // Build map: exerciseId → last logged weight (most recent session first)
      const lastWeightByExId: Record<string, number> = {}
      for (const sess of allHistory) {
        for (const loggedEx of sess.exercises) {
          if (lastWeightByExId[loggedEx.exerciseId] !== undefined) continue
          const workSets = loggedEx.sets.filter(s => s.completed && !s.isWarmup)
          if (workSets.length > 0) {
            lastWeightByExId[loggedEx.exerciseId] = workSets[workSets.length - 1].weight
          }
        }
      }
      // Also index by name as fallback (AI sometimes uses different IDs)
      const lastWeightByName: Record<string, number> = {}
      for (const sess of allHistory) {
        for (const loggedEx of sess.exercises) {
          if (lastWeightByName[loggedEx.name.toLowerCase()]) continue
          const workSets = loggedEx.sets.filter(s => s.completed && !s.isWarmup)
          if (workSets.length > 0) {
            lastWeightByName[loggedEx.name.toLowerCase()] = workSets[workSets.length - 1].weight
          }
        }
      }
      const suggestions: Record<string, number> = {}
      for (const ex of programDay.exercises) {
        suggestions[ex.exerciseId] =
          lastWeightByExId[ex.exerciseId] ??
          lastWeightByName[ex.name.toLowerCase()] ??
          20
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
        // After finishSession, check if we should advance to next week
        try {
          const prog = await db.programs.filter(p => p.isActive === true).first()
          if (prog) {
            const weekIndex = Math.min(prog.weekNumber - 1, prog.weeks.length - 1)
            const week = prog.weeks[weekIndex]
            if (week) {
              // Check how many distinct days we've trained this week
              const weekStart = new Date()
              weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
              weekStart.setHours(0, 0, 0, 0)
              const sessionsThisWeek = await db.workoutSessions
                .where('date').aboveOrEqual(weekStart)
                .toArray()
              const trainedDayNames = new Set(sessionsThisWeek.map(s => s.dayName))
              const programDayNames = new Set(week.days.map(d => d.name))
              // If all training days of this week have been done
              const allDone = [...programDayNames].every(name => trainedDayNames.has(name))
              if (allDone && prog.weekNumber < prog.weeks.length) {
                await db.programs.update(prog.id!, { weekNumber: prog.weekNumber + 1 })
                setWeekAdvanced(prog.weekNumber + 1)
              }
            }
          }
        } catch { /* silently skip week advancement */ }
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
      <>
        <SessionSummary
          session={finishedSession}
          onDone={handleDone}
        />
        {weekAdvanced !== null && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-6">
            <div className="bg-bg-surface border border-accent-yellow/30 rounded-2xl p-6 flex flex-col items-center gap-4 max-w-sm w-full text-center">
              <span className="text-5xl">🏆</span>
              <div>
                <h2 className="font-display text-3xl text-accent-yellow leading-none mb-2">
                  SEMAINE {weekAdvanced} !
                </h2>
                <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed">
                  Tu as complété toutes les séances de cette semaine. Le programme passe à la semaine {weekAdvanced}.
                </p>
              </div>
              <button
                onClick={() => { setWeekAdvanced(null); handleDone() }}
                className="btn-primary w-full"
              >
                CONTINUER →
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  if (phase === 'ready' && programComplete) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="text-6xl">🏆</span>
        <div>
          <h1 className="font-display text-4xl text-accent-yellow leading-none mb-3">
            PROGRAMME TERMINÉ !
          </h1>
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed max-w-xs">
            Tu as complété l'intégralité du programme. C'est une vraie réussite — maintenant on passe à la suite.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => onNavigate?.('profile')}
            className="btn-primary w-full"
          >
            GÉNÉRER UN NOUVEAU PROGRAMME →
          </button>
          <button
            onClick={async () => {
              const prog = await db.programs.filter(p => p.isActive === true).first()
              if (prog?.id) localStorage.setItem(`apex_program_continue_${prog.id}`, '1')
              setProgramComplete(false)
              setHasActiveProgram(true)
            }}
            className="btn-secondary w-full"
          >
            Continuer quand même
          </button>
        </div>
      </div>
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
        stagnations={stagnationAlerts}
        sleepAdjustment={sleepAdjustment}
        onSkip={handleSkipToday}
        skipReason={skipReason}
      />
      {startError && (
        <div className="fixed bottom-28 left-4 right-4 bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm font-body rounded-lg px-4 py-3 text-center">
          {startError}
        </div>
      )}
    </>
  )
}
