import { useState, useEffect, useRef } from 'react'
import { useWorkoutStore } from '../../store/workoutStore'
import { useWorkout } from '../../hooks/useWorkout'
import { NumberInput } from '../ui/NumberInput'
import { RPESelector } from '../ui/RPESelector'
import { RestTimer } from './RestTimer'
import type { ActiveSet } from '../../types'

interface ActiveSessionProps {
  onFinish: (mood: number, energy: number, notes: string) => void
  onCancel: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function ExerciseGif({ gifUrl, name }: { gifUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center text-2xl shrink-0">
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
      className="w-16 h-16 rounded-full object-cover border border-border-default shrink-0"
    />
  )
}

// Compact inline set row for completed / pending sets
function SetRow({
  set,
  setNumber,
  isActive,
  exerciseIndex,
  setIndex,
  onValidate,
  onSkip,
}: {
  set: ActiveSet
  setNumber: number
  isActive: boolean
  exerciseIndex: number
  setIndex: number
  onValidate: (exIdx: number, sIdx: number, w: number, r: number, rpe: number | null) => void
  onSkip: (exIdx: number, sIdx: number) => void
}) {
  const [weight, setWeight] = useState(set.targetWeight)
  const [reps, setReps] = useState(set.targetReps)
  const [rpe, setRpe] = useState<number | null>(set.rpe)

  // Update local state when target changes (e.g. new exercise)
  useEffect(() => {
    setWeight(set.targetWeight)
    setReps(set.targetReps)
    setRpe(null)
  }, [set.targetWeight, set.targetReps])

  const isCompleted = set.status === 'completed'
  const isSkipped = set.status === 'skipped'
  const isWarmup = set.isWarmup

  // Compact display row
  if (isCompleted || isSkipped) {
    const rowClass = isWarmup
      ? 'opacity-40 text-[rgba(240,237,230,0.4)]'
      : 'text-accent-green'
    return (
      <div className={`flex items-center gap-2 py-2 px-1 text-sm font-mono ${rowClass}`}>
        <span className="w-6 text-center shrink-0">
          {isWarmup ? (
            <span className="text-[10px] text-accent-orange font-semibold">W{setNumber}</span>
          ) : (
            <span>{setNumber}</span>
          )}
        </span>
        <span className="flex-1 text-center">
          {set.loggedWeight ?? set.targetWeight}
          <span className="text-[10px] opacity-50 ml-0.5">kg</span>
        </span>
        <span className="flex-1 text-center">{set.loggedReps ?? set.targetReps}</span>
        <span className="flex-1 text-center">{set.rpe ?? '—'}</span>
        <span className="w-6 text-center">{isSkipped ? '–' : '✓'}</span>
      </div>
    )
  }

  if (!isActive) {
    // Pending set
    return (
      <div className="flex items-center gap-2 py-2 px-1 text-sm font-mono text-[rgba(240,237,230,0.35)]">
        <span className="w-6 text-center shrink-0">
          {isWarmup ? (
            <span className="text-[10px] text-accent-orange/50 font-semibold">W{setNumber}</span>
          ) : (
            <span>{setNumber}</span>
          )}
        </span>
        <span className="flex-1 text-center">
          {set.targetWeight}
          <span className="text-[10px] opacity-50 ml-0.5">kg</span>
        </span>
        <span className="flex-1 text-center">{set.targetReps}</span>
        <span className="flex-1 text-center">—</span>
        <span className="w-6 text-center text-[rgba(240,237,230,0.15)]">○</span>
      </div>
    )
  }

  // ACTIVE SET — expanded inline input
  return (
    <div className="border-l-2 border-accent-yellow bg-bg-elevated rounded-r-lg py-4 px-3 mb-2 flex flex-col gap-4">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="font-display text-lg text-accent-yellow tracking-wide">
          {isWarmup ? `ÉCHAUFFEMENT W${setNumber}` : `SÉRIE ${setNumber - 3}`}
        </span>
        <span className="text-xs font-mono text-[rgba(240,237,230,0.35)]">
          Cible: {set.targetWeight}kg × {set.targetReps}
        </span>
      </div>

      {/* Inputs row */}
      <div className="flex gap-3 justify-center">
        <NumberInput
          label="POIDS"
          value={weight}
          onChange={setWeight}
          step={1.25}
          min={0}
          max={500}
          unit="kg"
        />
        <NumberInput
          label="REPS"
          value={reps}
          onChange={setReps}
          step={1}
          min={0}
          max={100}
        />
      </div>

      {/* RPE */}
      <RPESelector value={rpe} onChange={setRpe} />

      {/* Validate button */}
      <button
        onClick={() => onValidate(exerciseIndex, setIndex, weight, reps, rpe)}
        className="btn-primary w-full h-16 font-display text-xl tracking-wide"
      >
        ✓ VALIDER SÉRIE {isWarmup ? `W${setNumber}` : setNumber - 3}
      </button>

      {/* Skip */}
      <button
        onClick={() => onSkip(exerciseIndex, setIndex)}
        className="text-center text-xs text-[rgba(240,237,230,0.35)] py-1 active:opacity-60 transition-opacity"
      >
        Passer
      </button>
    </div>
  )
}

// ─── Finish modal overlay ─────────────────────────────────────────────────────

function FinishModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (mood: number, energy: number, notes: string) => void
  onCancel: () => void
}) {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [notes, setNotes] = useState('')

  const MOOD_EMOJI = ['😴', '😕', '😐', '😊', '🔥']
  const ENERGY_EMOJI = ['🪫', '😮‍💨', '⚡', '💪', '🚀']

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
      <div className="w-full bg-bg-surface border-t border-border-default rounded-t-xl p-5 flex flex-col gap-5 pb-10">
        <h2 className="font-display text-3xl text-[#f0ede6]">TERMINER LA SÉANCE</h2>

        {/* Mood */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
            HUMEUR
          </span>
          <div className="flex gap-2">
            {MOOD_EMOJI.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setMood(i + 1)}
                className={`flex-1 h-12 rounded-md text-xl transition-all ${
                  mood === i + 1
                    ? 'bg-accent-yellow/20 border border-accent-yellow scale-105'
                    : 'bg-bg-elevated border border-border-default'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
            ÉNERGIE
          </span>
          <div className="flex gap-2">
            {ENERGY_EMOJI.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setEnergy(i + 1)}
                className={`flex-1 h-12 rounded-md text-xl transition-all ${
                  energy === i + 1
                    ? 'bg-accent-yellow/20 border border-accent-yellow scale-105'
                    : 'bg-bg-elevated border border-border-default'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes sur la séance..."
          className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-3 text-sm text-[#f0ede6] placeholder-[rgba(240,237,230,0.25)] focus:outline-none focus:border-accent-yellow resize-none"
        />

        <button onClick={() => onConfirm(mood, energy, notes)} className="btn-primary w-full">
          ENREGISTRER LA SÉANCE
        </button>
        <button
          onClick={onCancel}
          className="text-center text-sm text-[rgba(240,237,230,0.4)] py-1"
        >
          Retour
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActiveSession({ onFinish, onCancel }: ActiveSessionProps) {
  const { session } = useWorkoutStore()
  const { validateSet, timer } = useWorkout()
  const store = useWorkoutStore()

  const [elapsed, setElapsed] = useState(0)
  const [showFinish, setShowFinish] = useState(false)
  const [tipOpenMap, setTipOpenMap] = useState<Record<number, boolean>>({})
  const [notesOpenMap, setNotesOpenMap] = useState<Record<number, boolean>>({})
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([])

  // Elapsed clock
  useEffect(() => {
    if (!session) return
    const start = session.sessionStartTime.getTime()
    const id = window.setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [session])

  // Auto-scroll to current exercise when it changes
  useEffect(() => {
    if (!session) return
    const ref = exerciseRefs.current[session.currentExerciseIndex]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [session?.currentExerciseIndex])

  if (!session) return null

  const { exercises, currentExerciseIndex, currentSetIndex } = session

  const totalExercises = exercises.length
  const completedExercises = exercises.filter(ex =>
    ex.sets.every(s => s.status === 'completed' || s.status === 'skipped')
  ).length

  const completedWorkSets = exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => !s.isWarmup && s.status === 'completed').length,
    0
  )

  const progressFraction = totalExercises > 0 ? completedExercises / totalExercises : 0
  const allDone = completedExercises === totalExercises

  async function handleValidate(
    exIdx: number,
    sIdx: number,
    w: number,
    r: number,
    rpe: number | null
  ) {
    await validateSet(exIdx, sIdx, w, r, rpe)
  }

  function handleSkip(exIdx: number, sIdx: number) {
    store.skipSet(exIdx, sIdx)
  }

  function toggleTip(idx: number) {
    setTipOpenMap(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function toggleNotes(idx: number) {
    setNotesOpenMap(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function isSetActive(exIdx: number, sIdx: number): boolean {
    return (
      exIdx === currentExerciseIndex &&
      sIdx === currentSetIndex &&
      exercises[exIdx].sets[sIdx]?.status === 'pending'
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-bg-surface border-b border-border-subtle">
        {/* Row 1: Day name + timer */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="font-display text-[18px] text-[#f0ede6] tracking-wide">
            {exercises[0]?.planned.name
              ? exercises.length > 1
                ? `SÉANCE · ${totalExercises} exercices`
                : exercises[0].planned.name.toUpperCase()
              : 'SÉANCE EN COURS'}
          </span>
          <span className="font-mono text-accent-yellow text-base">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Row 2: Progress */}
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-bg-overlay rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent-yellow rounded-full transition-all duration-500"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-[rgba(240,237,230,0.4)]">
            {completedExercises}/{totalExercises} exercices · {completedWorkSets} séries complétées
          </span>
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-4 px-4 flex flex-col gap-6">

        {/* ACTIVE EXERCISE SECTION */}
        {exercises.map((ex, exIdx) => {
          const isCurrentEx = exIdx === currentExerciseIndex
          const isUpcoming = exIdx > currentExerciseIndex
          const planned = ex.planned

          // Upcoming exercises — muted preview
          if (isUpcoming) {
            const opacity = Math.max(0.25, 0.6 - (exIdx - currentExerciseIndex) * 0.15)
            return (
              <div
                key={exIdx}
                ref={el => { exerciseRefs.current[exIdx] = el }}
                className="card flex items-center gap-3"
                style={{ opacity }}
              >
                <div className="w-10 h-10 rounded-full bg-bg-overlay border border-border-subtle flex items-center justify-center text-sm font-mono text-[rgba(240,237,230,0.3)] shrink-0">
                  {exIdx + 1}
                </div>
                <div>
                  <p className="font-body text-sm text-[rgba(240,237,230,0.6)]">{planned.name}</p>
                  <p className="text-xs font-mono text-[rgba(240,237,230,0.3)]">
                    {planned.sets} séries · {planned.repsMin}–{planned.repsMax} reps
                  </p>
                </div>
              </div>
            )
          }

          // Past / current exercise — full card
          return (
            <div
              key={exIdx}
              ref={el => { exerciseRefs.current[exIdx] = el }}
              className="flex flex-col gap-3"
            >
              {/* Exercise header */}
              <div className="flex items-start gap-4">
                <ExerciseGif gifUrl={planned.exerciseId ? `https://v2.exercisedb.io/image/${planned.exerciseId}` : ''} name={planned.name} />
                <div className="flex-1 min-w-0">
                  <p
                    className="font-display leading-none text-[#f0ede6] mb-1"
                    style={{ fontSize: isCurrentEx ? 26 : 20 }}
                  >
                    {planned.name.toUpperCase()}
                  </p>
                  <p className="text-xs font-mono text-[rgba(240,237,230,0.4)] leading-relaxed">
                    {planned.sets} séries · {planned.repsMin}–{planned.repsMax} reps · Repos {planned.restSeconds}s · RPE cible {planned.rpe}
                  </p>
                </div>
              </div>

              {/* AI Tip — collapsible */}
              {planned.technique && (
                <div className="ai-card">
                  <button
                    onClick={() => toggleTip(exIdx)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>🤖</span>
                      <span className="text-xs font-mono uppercase tracking-widest text-accent-blue">
                        CONSEIL COACH
                      </span>
                    </div>
                    <span className="text-[rgba(240,237,230,0.4)] text-lg leading-none">
                      {tipOpenMap[exIdx] ? '−' : '+'}
                    </span>
                  </button>
                  {tipOpenMap[exIdx] && (
                    <p className="mt-3 text-sm text-[rgba(240,237,230,0.7)] leading-relaxed">
                      {planned.technique}
                    </p>
                  )}
                </div>
              )}

              {/* Sets table */}
              <div className="card-elevated flex flex-col gap-0">
                {/* Table header */}
                <div className="flex items-center gap-2 pb-2 border-b border-border-subtle mb-1">
                  <span className="w-6 text-center text-[10px] font-mono uppercase text-[rgba(240,237,230,0.25)] shrink-0">S</span>
                  <span className="flex-1 text-center text-[10px] font-mono uppercase text-[rgba(240,237,230,0.25)]">POIDS</span>
                  <span className="flex-1 text-center text-[10px] font-mono uppercase text-[rgba(240,237,230,0.25)]">REPS</span>
                  <span className="flex-1 text-center text-[10px] font-mono uppercase text-[rgba(240,237,230,0.25)]">RPE</span>
                  <span className="w-6 text-center text-[10px] font-mono uppercase text-[rgba(240,237,230,0.25)]">✓</span>
                </div>

                {ex.sets.map((set, sIdx) => (
                  <SetRow
                    key={sIdx}
                    set={set}
                    setNumber={sIdx + 1}
                    isActive={isSetActive(exIdx, sIdx)}
                    exerciseIndex={exIdx}
                    setIndex={sIdx}
                    onValidate={handleValidate}
                    onSkip={handleSkip}
                  />
                ))}
              </div>

              {/* Exercise notes — collapsible */}
              <button
                onClick={() => toggleNotes(exIdx)}
                className="text-xs font-mono text-[rgba(240,237,230,0.35)] text-left flex items-center gap-1"
              >
                <span>{notesOpenMap[exIdx] ? '−' : '+'}</span>
                <span>Notes sur l'exercice</span>
              </button>
              {notesOpenMap[exIdx] && (
                <textarea
                  rows={2}
                  placeholder="Notes..."
                  className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-3 text-sm text-[#f0ede6] placeholder-[rgba(240,237,230,0.25)] focus:outline-none focus:border-accent-yellow resize-none"
                />
              )}
            </div>
          )
        })}

        {/* All done CTA */}
        {allDone && (
          <div className="pt-2">
            <button
              onClick={() => setShowFinish(true)}
              className="btn-primary w-full font-display text-xl tracking-wide"
            >
              🏁 TERMINER LA SÉANCE
            </button>
          </div>
        )}
      </div>

      {/* ── Rest timer (floating card) ───────────────────────────────── */}
      <RestTimer timer={timer} />

      {/* ── Bottom actions ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-bg-base border-t border-border-subtle px-4 py-3 flex gap-3">
        {!allDone && (
          <button
            onClick={() => setShowFinish(true)}
            className="flex-1 btn-secondary text-sm"
          >
            TERMINER
          </button>
        )}
        <button
          onClick={onCancel}
          className="btn-danger px-4 text-sm"
        >
          ANNULER
        </button>
      </div>

      {/* ── Finish modal ─────────────────────────────────────────────── */}
      {showFinish && (
        <FinishModal
          onConfirm={(mood, energy, notes) => {
            setShowFinish(false)
            onFinish(mood, energy, notes)
          }}
          onCancel={() => setShowFinish(false)}
        />
      )}
    </div>
  )
}
