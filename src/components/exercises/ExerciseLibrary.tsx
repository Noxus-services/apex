import { useState, useEffect, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { db, seedExercises } from '../../db/database'
import { BottomSheet } from '../ui/BottomSheet'
import { ExerciseCard } from '../workout/ExerciseCard'
import { MusclesDiagram } from '../ui/MusclesDiagram'
import type { Exercise } from '../../types'

// ── Filter chips ──────────────────────────────────────────────────────────────

type BodyPartFilter = 'all' | 'chest' | 'back' | 'upper legs' | 'shoulders' | 'upper arms' | 'waist'

const FILTER_CHIPS: { label: string; value: BodyPartFilter }[] = [
  { label: 'Tout', value: 'all' },
  { label: 'Poitrine', value: 'chest' },
  { label: 'Dos', value: 'back' },
  { label: 'Jambes', value: 'upper legs' },
  { label: 'Épaules', value: 'shoulders' },
  { label: 'Bras', value: 'upper arms' },
  { label: 'Abdos', value: 'waist' },
]

// ── Exercise Detail Sheet ─────────────────────────────────────────────────────

interface ExerciseDetailProps {
  exercise: Exercise | null
  isOpen: boolean
  onClose: () => void
  onAddToSession?: (exercise: Exercise) => void
  sessionActive?: boolean
}

function ExerciseGifLarge({ gifUrl, name }: { gifUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="w-full h-52 rounded-xl bg-bg-elevated border border-border-default flex items-center justify-center text-5xl">
        💪
      </div>
    )
  }

  return (
    <img
      src={gifUrl}
      alt={name}
      onError={() => setFailed(true)}
      className="w-full h-52 object-cover rounded-xl border border-border-default"
    />
  )
}

function ExerciseDetailSheet({
  exercise,
  isOpen,
  onClose,
  onAddToSession,
  sessionActive = false,
}: ExerciseDetailProps) {
  if (!exercise) return null

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="90vh">
      <div className="px-4 pb-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl text-[#f0ede6] leading-tight">
              {exercise.nameFr.toUpperCase()}
            </h2>
            <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-0.5">{exercise.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[rgba(240,237,230,0.7)] p-1 -mr-1"
          >
            <X size={22} />
          </button>
        </div>

        {/* GIF */}
        <ExerciseGifLarge gifUrl={exercise.gifUrl} name={exercise.nameFr} />

        {/* Muscles Diagram */}
        <div className="flex flex-col items-center gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest self-start">
            Muscles sollicités
          </p>
          <MusclesDiagram
            primaryMuscles={[exercise.target]}
            secondaryMuscles={exercise.secondaryMuscles}
            size={200}
          />
        </div>

        {/* Equipment + body part tags */}
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide px-3 py-1 rounded-full bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.5)]">
            {exercise.bodyPart}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wide px-3 py-1 rounded-full bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.5)]">
            {exercise.equipment}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wide px-3 py-1 rounded-full bg-accent-red/10 border border-accent-red/20 text-red-400">
            {exercise.target}
          </span>
          {exercise.secondaryMuscles.map(m => (
            <span
              key={m}
              className="font-mono text-[10px] uppercase tracking-wide px-3 py-1 rounded-full bg-bg-overlay border border-border-subtle text-[rgba(240,237,230,0.6)]"
            >
              {m}
            </span>
          ))}
        </div>

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
              Instructions
            </p>
            <ol className="flex flex-col gap-3">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center font-mono text-xs text-accent-yellow flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="font-body text-sm text-[rgba(240,237,230,0.75)] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Add to session button */}
        {sessionActive && onAddToSession && (
          <button
            onClick={() => {
              onAddToSession(exercise)
              onClose()
            }}
            className="w-full h-14 rounded-xl bg-accent-yellow font-body font-medium text-bg-base text-base active:scale-95 transition-transform"
          >
            + Ajouter à la séance
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

// ── ExerciseLibrary ───────────────────────────────────────────────────────────

interface ExerciseLibraryProps {
  sessionActive?: boolean
  onAddToSession?: (exercise: Exercise) => void
}

export function ExerciseLibrary({ sessionActive = false, onAddToSession }: ExerciseLibraryProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<BodyPartFilter>('all')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      await seedExercises()
      const all = await db.exercises.toArray()
      setExercises(all)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = exercises

    // Filter by body part
    if (activeFilter !== 'all') {
      result = result.filter(e => e.bodyPart === activeFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          e.nameFr.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          e.bodyPart.toLowerCase().includes(q)
      )
    }

    return result
  }, [exercises, activeFilter, searchQuery])

  function handleExerciseClick(exercise: Exercise) {
    setSelectedExercise(exercise)
    setIsDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(240,237,230,0.55)]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher un exercice..."
          className="w-full bg-bg-elevated border border-border-default rounded-xl pl-10 pr-10 py-3 font-body text-sm text-[#f0ede6] placeholder:text-[rgba(240,237,230,0.55)] outline-none focus:border-accent-yellow/40 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(240,237,230,0.55)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
        {FILTER_CHIPS.map(chip => (
          <button
            key={chip.value}
            onClick={() => setActiveFilter(chip.value)}
            className={`flex-shrink-0 h-8 px-4 rounded-full font-body text-sm transition-colors ${
              activeFilter === chip.value
                ? 'bg-accent-yellow text-bg-base font-medium'
                : 'bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.55)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
        {filtered.length} exercice{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Exercise grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card h-24 animate-pulse bg-bg-elevated" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="text-4xl">🔍</span>
          <p className="font-body text-sm text-[rgba(240,237,230,0.5)] text-center">
            Aucun exercice trouvé
            {searchQuery ? ` pour "${searchQuery}"` : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(exercise => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onClick={() => handleExerciseClick(exercise)}
            />
          ))}
        </div>
      )}

      {/* Exercise detail bottom sheet */}
      <ExerciseDetailSheet
        exercise={selectedExercise}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onAddToSession={onAddToSession}
        sessionActive={sessionActive}
      />
    </div>
  )
}
