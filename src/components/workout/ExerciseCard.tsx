import { useState } from 'react'
import type { Exercise } from '../../types'
import { MusclesDiagram } from '../ui/MusclesDiagram'

interface ExerciseCardProps {
  exercise: Exercise
  onClick?: () => void
}

const BODY_PART_LABELS: Record<string, string> = {
  chest: 'Poitrine',
  back: 'Dos',
  shoulders: 'Épaules',
  'upper arms': 'Bras',
  'lower arms': 'Avant-bras',
  'upper legs': 'Cuisses',
  'lower legs': 'Mollets',
  waist: 'Abdos',
  cardio: 'Cardio',
  neck: 'Cou',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  cable: 'Câble',
  machine: 'Machine',
  'body weight': 'Poids du corps',
  'assisted': 'Assisté',
  band: 'Élastique',
  'medicine ball': 'Médecine ball',
  kettlebell: 'Kettlebell',
  'ez barbell': 'Barre EZ',
}

const MUSCLE_COLORS: Record<string, string> = {
  pectorals: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  lats: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  quads: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hamstrings: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  glutes: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  delts: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  biceps: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  triceps: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  abs: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'erector spinae': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
}

function getMuscleClass(muscle: string): string {
  const key = Object.keys(MUSCLE_COLORS).find(k =>
    muscle.toLowerCase().includes(k)
  )
  return key ? MUSCLE_COLORS[key] : 'bg-bg-overlay text-[rgba(240,237,230,0.5)] border-border-default'
}

function ExerciseGif({ gifUrl, name }: { gifUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="w-20 h-20 rounded-lg bg-bg-elevated border border-border-default flex items-center justify-center text-3xl shrink-0">
        💪
      </div>
    )
  }

  return (
    <img
      src={gifUrl}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-20 h-20 rounded-lg object-cover border border-border-default shrink-0"
    />
  )
}

export function ExerciseCard({ exercise, onClick }: ExerciseCardProps) {
  const { name, nameFr, bodyPart, equipment, gifUrl, target, secondaryMuscles } = exercise

  const bodyPartLabel = BODY_PART_LABELS[bodyPart] ?? bodyPart
  const equipmentLabel = EQUIPMENT_LABELS[equipment] ?? equipment

  return (
    <button
      onClick={onClick}
      className="card w-full text-left flex flex-col gap-3 active:scale-[0.98] transition-transform"
    >
      {/* Top row: GIF + name/tags */}
      <div className="flex items-start gap-4">
        <ExerciseGif gifUrl={gifUrl} name={nameFr} />

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* French name */}
          <p className="font-display text-[18px] text-[#f0ede6] leading-tight">
            {nameFr.toUpperCase()}
          </p>
          {/* English name (muted) */}
          <p className="text-xs text-[rgba(240,237,230,0.3)] font-body">{name}</p>

          {/* Body part + equipment tags */}
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.5)]">
              {bodyPartLabel}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.5)]">
              {equipmentLabel}
            </span>
          </div>

          {/* Primary muscle tag */}
          <div className="flex flex-wrap gap-1">
            <span
              className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${getMuscleClass(target)}`}
            >
              {target}
            </span>
            {secondaryMuscles.slice(0, 2).map(m => (
              <span
                key={m}
                className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-bg-overlay text-[rgba(240,237,230,0.35)] border border-border-subtle"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Muscles diagram — small */}
        <div className="shrink-0">
          <MusclesDiagram
            primaryMuscles={[target]}
            secondaryMuscles={secondaryMuscles}
            size={40}
          />
        </div>
      </div>
    </button>
  )
}
