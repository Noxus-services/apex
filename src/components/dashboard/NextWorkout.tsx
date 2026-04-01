import { Button } from '../ui/Button'
import type { Program } from '../../types'

interface NextWorkoutProps {
  program: Program | null
  onStart: () => void
}

function getTodayDayIndex(): number {
  // Monday=1 ... Sunday=7, we use 1-based to match typical gym week
  const d = new Date().getDay() // 0=Sun ... 6=Sat
  return d === 0 ? 7 : d
}

export function NextWorkout({ program, onStart }: NextWorkoutProps) {
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

  const previewExercises = todayDay.exercises.slice(0, 3).map(e => e.name).join(' · ')
  const moreCount = todayDay.exercises.length - 3
  const preview = moreCount > 0 ? `${previewExercises} · +${moreCount}` : previewExercises

  return (
    <div className="card-elevated flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-body text-xs text-[rgba(240,237,230,0.4)] uppercase tracking-widest mb-1">
          Séance du jour
        </p>
        <h2 className="font-display text-3xl text-[#f0ede6] leading-none">
          {todayDay.name}
        </h2>
        <p className="font-body text-sm text-[rgba(240,237,230,0.5)] mt-1">
          {todayDay.focus}
        </p>
      </div>

      {/* Exercise preview */}
      <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed">
        {preview}
      </p>

      {/* Stats row */}
      <div className="flex gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-accent-yellow text-lg leading-none">
            {todayDay.estimatedDuration}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.4)]">min</span>
        </div>
        <div className="w-px bg-border-subtle" />
        <div className="flex flex-col">
          <span className="font-mono text-[#f0ede6] text-lg leading-none">
            {todayDay.exercises.length}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.4)]">exercices</span>
        </div>
        <div className="w-px bg-border-subtle" />
        <div className="flex flex-col">
          <span className="font-mono text-[#f0ede6] text-lg leading-none">
            Sem. {program.weekNumber}
          </span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.4)]">programme</span>
        </div>
      </div>

      {/* CTA */}
      <Button variant="primary" fullWidth size="lg" onClick={onStart}>
        COMMENCER LA SÉANCE
      </Button>
    </div>
  )
}
