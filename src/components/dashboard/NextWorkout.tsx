import { useState } from 'react'
import { Button } from '../ui/Button'
import type { Program, WorkoutSession, DailyWellness } from '../../types'

interface NextWorkoutProps {
  program: Program | null
  sessions: WorkoutSession[]
  wellness?: DailyWellness | null
  onStart: () => void
}

function getSuggestedWeight(
  exerciseName: string,
  sessions: WorkoutSession[],
  repsMax: number
): { weight: number; isProgression: boolean } | null {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  for (const s of sorted) {
    const found = s.exercises.find(
      e => e.name.toLowerCase() === exerciseName.toLowerCase()
    )
    if (found) {
      const workSets = found.sets.filter(ws => !ws.isWarmup && ws.completed)
      if (workSets.length > 0) {
        const lastSet = workSets[workSets.length - 1]
        const hitTop = lastSet.reps >= repsMax
        const weight = hitTop
          ? Math.round((lastSet.weight + 2.5) * 100) / 100
          : lastSet.weight
        return { weight, isProgression: hitTop }
      }
    }
  }
  return null
}

function getTodayDayIndex(): number {
  // Monday=1 ... Sunday=7, we use 1-based to match typical gym week
  const d = new Date().getDay() // 0=Sun ... 6=Sat
  return d === 0 ? 7 : d
}

export function NextWorkout({ program, sessions, wellness, onStart }: NextWorkoutProps) {
  const [showAll, setShowAll] = useState(false)

  if (!program) {
    return (
      <div className="card-elevated flex flex-col gap-3">
        <p className="font-display text-2xl text-[#f0ede6] leading-none">
          Aucun programme actif
        </p>
        <p className="font-body text-sm text-[rgba(240,237,230,0.5)]">
          Génère un programme personnalisé pour commencer.
        </p>
        <Button variant="primary" fullWidth size="lg">
          Générer un programme
        </Button>
      </div>
    )
  }

  const weekIndex = Math.min(program.weekNumber - 1, program.weeks.length - 1)
  const week = program.weeks[weekIndex] ?? program.weeks[0]

  if (!week) {
    return (
      <div className="card-elevated">
        <p className="font-body text-[rgba(240,237,230,0.5)]">Programme invalide.</p>
      </div>
    )
  }

  const todayIdx = getTodayDayIndex()
  // Find exact match or next upcoming day
  const sortedDays = [...week.days].sort((a, b) => a.dayIndex - b.dayIndex)
  const todayDay =
    sortedDays.find(d => d.dayIndex === todayIdx) ??
    sortedDays.find(d => d.dayIndex > todayIdx) ??
    sortedDays[0]

  if (!todayDay) {
    return (
      <div className="card-elevated">
        <p className="font-body text-[rgba(240,237,230,0.5)]">Repos aujourd'hui. Récupère bien !</p>
      </div>
    )
  }

  const wellnessAlert = wellness
    ? wellness.stressLevel >= 4 || wellness.soreness >= 4
      ? { level: 'warning' as const, msg: `⚠️ Stress ${wellness.stressLevel}/5, courbatures ${wellness.soreness}/5 — volume -20%, RPE ≤ 7 recommandé.` }
      : wellness.motivation <= 2
      ? { level: 'info' as const, msg: `🔋 Motivation ${wellness.motivation}/5 — commence quand même, ça monte vite.` }
      : null
    : null

  return (
    <div className="card-elevated flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-body text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest mb-1">
          Séance du jour
        </p>
        <h2 className="font-display text-3xl text-[#f0ede6] leading-none">
          {todayDay.name}
        </h2>
        <p className="font-body text-sm text-[rgba(240,237,230,0.5)] mt-1">
          {todayDay.focus}
        </p>
      </div>

      {wellnessAlert && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-body leading-relaxed border ${
          wellnessAlert.level === 'warning'
            ? 'bg-orange-500/5 border-orange-500/20 text-[rgba(240,237,230,0.75)]'
            : 'bg-accent-yellow/5 border-accent-yellow/15 text-[rgba(240,237,230,0.7)]'
        }`}>
          <span className="flex-shrink-0">{wellnessAlert.level === 'warning' ? '⚠️' : '💡'}</span>
          <span>{wellnessAlert.msg}</span>
        </div>
      )}

      {/* Exercise targets */}
      <div className="flex flex-col gap-1.5">
        {(showAll ? todayDay.exercises : todayDay.exercises.slice(0, 4)).map(ex => {
          const suggestion = getSuggestedWeight(ex.name, sessions, ex.repsMax)
          return (
            <div key={ex.name} className="flex items-center gap-2">
              <span className="font-body text-xs text-[rgba(240,237,230,0.7)] flex-1 truncate">
                {ex.name}
              </span>
              {suggestion ? (
                <span className={`font-mono text-xs font-semibold flex-shrink-0 ${
                  suggestion.isProgression ? 'text-accent-yellow' : 'text-[rgba(240,237,230,0.6)]'
                }`}>
                  {suggestion.isProgression && '↑ '}{suggestion.weight}kg
                </span>
              ) : (
                <span className="font-mono text-xs text-[rgba(240,237,230,0.35)] flex-shrink-0">
                  {ex.sets}×{ex.repsMin}-{ex.repsMax}
                </span>
              )}
            </div>
          )
        })}
        {todayDay.exercises.length > 4 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="font-body text-xs text-accent-yellow/70 text-left mt-0.5 active:opacity-70"
          >
            {showAll ? '▲ Réduire' : `▼ +${todayDay.exercises.length - 4} exercices`}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-accent-yellow text-lg leading-none">
            {todayDay.estimatedDuration}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.7)]">min</span>
        </div>
        <div className="w-px bg-border-subtle" />
        <div className="flex flex-col">
          <span className="font-mono text-[#f0ede6] text-lg leading-none">
            {todayDay.exercises.length}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.7)]">exercices</span>
        </div>
        <div className="w-px bg-border-subtle" />
        <div className="flex flex-col">
          <span className="font-mono text-[#f0ede6] text-lg leading-none">
            Sem. {program.weekNumber}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.7)]">programme</span>
        </div>
      </div>

      {/* CTA */}
      <Button variant="primary" fullWidth size="lg" onClick={onStart}>
        COMMENCER LA SÉANCE
      </Button>
    </div>
  )
}
