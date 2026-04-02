import { useState, useEffect } from 'react'
import { useWorkoutStore } from '../../store/workoutStore'
import { useWorkout } from '../../hooks/useWorkout'
import { MusclesDiagram } from '../ui/MusclesDiagram'
import { RestTimer } from './RestTimer'
import { db } from '../../db/database'
import type { Exercise } from '../../types'

interface LastPerf {
  weight: number
  reps: number
  suggestedWeight: number
  isProgression: boolean // true = we're suggesting more than last time
}

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

// ─── Big Stepper — full width card ───────────────────────────────────────────

function WeightStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  function adjust(delta: number) {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100)
    onChange(next)
    if ('vibrate' in navigator) navigator.vibrate(8)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="section-label text-center">POIDS</span>
      {/* Main row */}
      <div className="flex items-center gap-2">
        <button
          onPointerDown={() => adjust(-1.25)}
          className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.09] text-[#f0ede6] text-2xl font-light flex items-center justify-center active:scale-90 active:bg-white/10 transition-all select-none"
        >
          −
        </button>
        <div className="flex-1 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center relative">
          <span className="font-display text-[40px] leading-none text-[#f0ede6]">{value % 1 === 0 ? value.toFixed(0) : value}</span>
          <span className="font-mono text-xs text-[rgba(240,237,230,0.6)] absolute right-4 bottom-3">kg</span>
        </div>
        <button
          onPointerDown={() => adjust(+1.25)}
          className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.09] text-[#f0ede6] text-2xl font-light flex items-center justify-center active:scale-90 active:bg-white/10 transition-all select-none"
        >
          +
        </button>
      </div>
      {/* Quick adjust row */}
      <div className="flex gap-2">
        {[-5, -2.5].map(d => (
          <button key={d}
            onPointerDown={() => adjust(d)}
            className="flex-1 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] font-mono text-xs text-[rgba(240,237,230,0.72)] active:bg-white/8 active:scale-95 transition-all select-none">
            {d}
          </button>
        ))}
        <div className="w-px bg-white/10 mx-1" />
        {[+2.5, +5].map(d => (
          <button key={d}
            onPointerDown={() => adjust(d)}
            className="flex-1 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] font-mono text-xs text-[rgba(240,237,230,0.72)] active:bg-white/8 active:scale-95 transition-all select-none">
            +{d}
          </button>
        ))}
      </div>
    </div>
  )
}

function RepsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  function adjust(delta: number) {
    const next = Math.max(1, value + delta)
    onChange(next)
    if ('vibrate' in navigator) navigator.vibrate(8)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="section-label text-center">REPS</span>
      <div className="flex items-center gap-2">
        <button
          onPointerDown={() => adjust(-1)}
          className="w-16 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.09] text-[#f0ede6] text-2xl font-light flex items-center justify-center active:scale-90 active:bg-white/10 transition-all select-none"
        >
          −
        </button>
        <div className="flex-1 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <span className="font-display text-[36px] leading-none text-[#f0ede6]">{value}</span>
        </div>
        <button
          onPointerDown={() => adjust(+1)}
          className="w-16 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.09] text-[#f0ede6] text-2xl font-light flex items-center justify-center active:scale-90 active:bg-white/10 transition-all select-none"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Finish Modal ─────────────────────────────────────────────────────────────

function FinishModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (mood: number, energy: number, notes: string) => void
  onCancel: () => void
}) {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)

  const MOOD =   ['😴', '😕', '😐', '😊', '🔥']
  const ENERGY = ['🪫', '😮‍💨', '⚡', '💪', '🚀']

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-slide-up">
      <div
        className="w-full bg-bg-surface border-t border-border-subtle rounded-t-3xl p-5 flex flex-col gap-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <h2 className="font-display text-3xl text-[#f0ede6]">TERMINER LA SÉANCE</h2>

        <div className="flex flex-col gap-2">
          <span className="section-label">HUMEUR</span>
          <div className="flex gap-2">
            {MOOD.map((e, i) => (
              <button key={i} onClick={() => setMood(i + 1)}
                className={`flex-1 h-14 rounded-xl text-2xl active:scale-95 transition-all ${mood === i + 1 ? 'bg-accent-yellow/20 border border-accent-yellow' : 'bg-white/5 border border-white/10'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="section-label">ÉNERGIE</span>
          <div className="flex gap-2">
            {ENERGY.map((e, i) => (
              <button key={i} onClick={() => setEnergy(i + 1)}
                className={`flex-1 h-14 rounded-xl text-2xl active:scale-95 transition-all ${energy === i + 1 ? 'bg-accent-yellow/20 border border-accent-yellow' : 'bg-white/5 border border-white/10'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => onConfirm(mood, energy, '')} className="btn-primary w-full font-display text-xl tracking-wide">
          ENREGISTRER
        </button>
        <button onClick={onCancel} className="text-center text-sm text-[rgba(240,237,230,0.7)] py-1">Retour</button>
      </div>
    </div>
  )
}

// ─── Muscle panel (slide-up sheet) ────────────────────────────────────────────

function MusclePanel({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-bg-surface border-t border-border-subtle rounded-t-3xl px-6 py-6 flex flex-col items-center gap-4 animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mb-1" />
        <p className="font-display text-xl text-[#f0ede6] text-center">{exercise.nameFr || exercise.name}</p>
        <p className="font-mono text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest -mt-2">
          {exercise.bodyPart} · {exercise.equipment}
        </p>
        <MusclesDiagram
          primaryMuscles={[exercise.target]}
          secondaryMuscles={exercise.secondaryMuscles}
          size={180}
        />
        {exercise.instructions?.length > 0 && (
          <div className="w-full flex flex-col gap-2 mt-2">
            <p className="section-label">TECHNIQUE</p>
            {exercise.instructions.slice(0, 3).map((inst, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-xs text-accent-yellow mt-0.5 flex-shrink-0">{i + 1}</span>
                <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed">{inst}</p>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="w-full h-12 rounded-xl bg-white/5 border border-white/10 font-body text-sm text-[rgba(240,237,230,0.5)] mt-2">
          Fermer
        </button>
      </div>
    </div>
  )
}

// ─── Compact muscle indicator ─────────────────────────────────────────────────

function MuscleBadge({ target, secondary, onClick }: {
  target: string
  secondary: string[]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
    >
      <MusclesDiagram
        primaryMuscles={[target]}
        secondaryMuscles={secondary}
        size={72}
      />
      <span className="font-mono text-[9px] text-[rgba(240,237,230,0.55)] uppercase tracking-wide max-w-[72px] text-center truncate">
        {target}
      </span>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ActiveSession({ onFinish, onCancel }: ActiveSessionProps) {
  const { session, togglePause } = useWorkoutStore()
  const { validateSet, timer } = useWorkout()
  const store = useWorkoutStore()
  const { undoLastSet } = useWorkoutStore()

  const [elapsed, setElapsed] = useState(0)
  const [showFinish, setShowFinish] = useState(false)
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [exerciseData, setExerciseData] = useState<Exercise | null>(null)
  const [showMuscles, setShowMuscles] = useState(false)
  const [lastPerf, setLastPerf] = useState<LastPerf | null>(null)
  const [lastValidated, setLastValidated] = useState(false)
  const [justValidated, setJustValidated] = useState<string | null>(null) // 'exIdx-setIdx'

  // Elapsed clock
  useEffect(() => {
    if (!session) return
    const start = session.sessionStartTime.getTime()
    const id = window.setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [session])

  // Reps: always sync from program target
  useEffect(() => {
    if (!session) return
    const ex = session.exercises[session.currentExerciseIndex]
    if (!ex) return
    const set = ex.sets[session.currentSetIndex]
    if (!set) return
    setReps(set.targetReps)
  }, [session?.currentExerciseIndex, session?.currentSetIndex])

  // Weight + progression: load last performance from DB when exercise changes
  useEffect(() => {
    if (!session) return
    const ex = session.exercises[session.currentExerciseIndex]
    if (!ex) return
    const currentSet = ex.sets[session.currentSetIndex]

    setLastPerf(null)

    db.workoutSessions
      .orderBy('date')
      .reverse()
      .limit(30)
      .toArray()
      .then(allSessions => {
        for (const s of allSessions) {
          const found = s.exercises.find(e =>
            e.name.toLowerCase() === ex.planned.name.toLowerCase()
          )
          if (found) {
            const workSets = found.sets.filter(ws => !ws.isWarmup && ws.completed)
            if (workSets.length > 0) {
              const lastSet = workSets[workSets.length - 1]
              const hitTop = lastSet.reps >= ex.planned.repsMax
              const suggested = hitTop
                ? Math.round((lastSet.weight + 2.5) * 100) / 100
                : lastSet.weight
              setLastPerf({
                weight: lastSet.weight,
                reps: lastSet.reps,
                suggestedWeight: suggested,
                isProgression: hitTop,
              })
              // Pre-fill weight with suggestion for work sets
              if (currentSet && !currentSet.isWarmup) {
                setWeight(suggested)
              } else if (currentSet) {
                setWeight(currentSet.targetWeight)
              }
              return
            }
          }
        }
        // No history — use program target
        if (currentSet) setWeight(currentSet.targetWeight)
      })
  }, [session?.currentExerciseIndex])

  // Load exercise data for muscle diagram
  useEffect(() => {
    if (!session) return
    const ex = session.exercises[session.currentExerciseIndex]
    if (!ex?.planned.exerciseId) { setExerciseData(null); return }
    db.exercises.get(ex.planned.exerciseId).then(data => setExerciseData(data ?? null))
  }, [session?.currentExerciseIndex])

  if (!session) return null

  const { exercises, currentExerciseIndex, currentSetIndex } = session
  const currentEx = exercises[currentExerciseIndex]
  if (!currentEx) return null

  const planned = currentEx.planned
  const currentSet = currentEx.sets[currentSetIndex]

  const totalExercises = exercises.length
  const completedExercises = exercises.filter(ex =>
    ex.sets.every(s => s.status === 'completed' || s.status === 'skipped')
  ).length
  const allDone = completedExercises === totalExercises
  const progressFraction = totalExercises > 0 ? completedExercises / totalExercises : 0

  const isWarmup = currentSet?.isWarmup ?? false
  const warmupCount = currentEx.sets.filter(s => s.isWarmup).length
  const currentWorkSetNum = isWarmup ? 0 : currentSetIndex - warmupCount + 1
  const totalWorkSets = currentEx.sets.filter(s => !s.isWarmup).length
  const nextEx = exercises[currentExerciseIndex + 1]

  async function handleValidate() {
    await validateSet(currentExerciseIndex, currentSetIndex, weight, reps, null)
    setLastValidated(true)
    setTimeout(() => setLastValidated(false), 8000) // undo window: 8 seconds
    const key = `${currentExerciseIndex}-${currentSetIndex}`
    setJustValidated(key)
    setTimeout(() => setJustValidated(null), 600)
  }

  function handleSkip() {
    store.skipSet(currentExerciseIndex, currentSetIndex)
  }

  return (
    <div className="flex flex-col h-full bg-bg-base">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pb-3 border-b border-border-subtle"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-body text-sm text-[rgba(240,237,230,0.72)]">
            Exercice {currentExerciseIndex + 1} / {totalExercises}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-accent-yellow font-semibold tabular-nums">
              {formatElapsed(elapsed)}
            </span>
            <button
              onClick={togglePause}
              className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[rgba(240,237,230,0.6)] active:scale-90 transition-all"
              aria-label={session.isPaused ? 'Reprendre' : 'Pause'}
            >
              {session.isPaused ? '▶' : '⏸'}
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-yellow rounded-full transition-all duration-500"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>
      </div>

      {/* ── Exercise info ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 flex items-start gap-3">
        {/* Text side */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[30px] leading-none text-[#f0ede6] mb-1.5 truncate">
            {planned.name.toUpperCase()}
          </h1>
          <p className="font-mono text-xs text-[rgba(240,237,230,0.7)] mb-2.5">
            {isWarmup
              ? `ÉCHAUFFEMENT · W${currentSetIndex + 1}`
              : `SÉRIE ${currentWorkSetNum} / ${totalWorkSets}`}
            {currentSet && (
              <span className="text-[rgba(240,237,230,0.22)]">
                {' '}· {currentSet.targetWeight}kg × {currentSet.targetReps}
              </span>
            )}
          </p>
          {/* Set dots */}
          <div className="flex items-center gap-1.5">
            {currentEx.sets.map((s, i) => {
              const done = s.status === 'completed'
              const active = i === currentSetIndex
              const flashing = justValidated === `${currentExerciseIndex}-${i}`
              return (
                <div key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    done ? 'bg-accent-yellow w-5'
                    : active ? 'bg-accent-yellow/50 w-5'
                    : 'bg-white/10 w-3'
                  } ${flashing ? 'ring-2 ring-accent-green/60 bg-accent-green/10' : ''}`}
                />
              )
            })}
          </div>
          {/* Progression indicator */}
          {lastPerf && !isWarmup && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-accent-yellow/[0.07] border border-accent-yellow/15">
              <span className="font-mono text-xs text-[rgba(240,237,230,0.5)]">
                Dernière fois {lastPerf.weight}kg×{lastPerf.reps}
              </span>
              <span className="text-[rgba(240,237,230,0.25)] text-xs">→</span>
              <span className={`font-mono text-xs font-bold ${lastPerf.isProgression ? 'text-accent-yellow' : 'text-[rgba(240,237,230,0.72)]'}`}>
                {lastPerf.isProgression && '↑ '}{lastPerf.suggestedWeight}kg
              </span>
              {lastPerf.isProgression && (
                <span className="ml-auto font-mono text-[10px] text-accent-yellow/60 uppercase tracking-wide">PROGRESSION</span>
              )}
            </div>
          )}
          {exerciseData?.instructions && exerciseData.instructions.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {exerciseData.instructions.slice(0, 2).map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="font-mono text-[9px] text-accent-yellow/60 mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <p className="font-body text-[10px] text-[rgba(240,237,230,0.5)] leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Muscle diagram — tap to expand */}
        {exerciseData ? (
          <MuscleBadge
            target={exerciseData.target}
            secondary={exerciseData.secondaryMuscles}
            onClick={() => setShowMuscles(true)}
          />
        ) : (
          <button
            onClick={() => setShowMuscles(true)}
            className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-2xl opacity-40"
          >
            💪
          </button>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-4 gap-3 overflow-hidden">
        {currentSet && !allDone && (
          <>
            <WeightStepper value={weight} onChange={setWeight} />
            <RepsStepper value={reps} onChange={setReps} />
          </>
        )}
      </div>

      {/* ── Bottom ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 flex flex-col gap-2.5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        {/* Next preview */}
        {nextEx && !allDone && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-border-subtle">
            <span className="section-label text-[rgba(240,237,230,0.22)]">SUIVANT</span>
            <span className="font-body text-xs text-[rgba(240,237,230,0.72)] flex-1 truncate">{nextEx.planned.name}</span>
            <span className="font-mono text-xs text-[rgba(240,237,230,0.5)]">{nextEx.planned.sets}×{nextEx.planned.repsMin}</span>
          </div>
        )}

        {allDone ? (
          <button onClick={() => setShowFinish(true)} className="btn-primary w-full font-display text-2xl tracking-wide h-16">
            🏁 TERMINER
          </button>
        ) : (
          <>
            <button onClick={handleValidate} className="btn-primary w-full font-display text-2xl tracking-wide h-16">
              ✓ VALIDER
            </button>
            <div className="flex gap-2">
              {lastValidated && (
                <button
                  onClick={() => { undoLastSet(); setLastValidated(false) }}
                  className="px-3 h-11 rounded-xl bg-accent-yellow/[0.08] border border-accent-yellow/20 font-body text-xs text-accent-yellow active:scale-90 transition-all flex-shrink-0"
                >
                  ↩ Annuler
                </button>
              )}
              <button onClick={handleSkip}
                className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] font-body text-sm text-[rgba(240,237,230,0.7)] active:opacity-60 transition-opacity">
                Passer
              </button>
              <button onClick={() => setShowFinish(true)}
                className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] font-body text-sm text-[rgba(240,237,230,0.7)] active:opacity-60 transition-opacity">
                Terminer
              </button>
              <button onClick={onCancel}
                className="px-4 h-11 rounded-xl bg-accent-red/[0.08] border border-accent-red/20 font-body text-sm text-accent-red active:opacity-60 transition-opacity">
                ✕
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────── */}

      {/* Pause overlay */}
      {session.isPaused && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-6">
          <span className="text-6xl">⏸</span>
          <h2 className="font-display text-3xl text-[#f0ede6]">PAUSE</h2>
          <p className="font-body text-sm text-[rgba(240,237,230,0.6)]">Séance en pause — reprends quand tu es prêt</p>
          <button
            onClick={togglePause}
            className="btn-primary px-10"
          >
            ▶ REPRENDRE
          </button>
        </div>
      )}

      <RestTimer timer={timer} />

      {showMuscles && exerciseData && (
        <MusclePanel exercise={exerciseData} onClose={() => setShowMuscles(false)} />
      )}

      {showFinish && (
        <FinishModal
          onConfirm={(mood, energy, notes) => { setShowFinish(false); onFinish(mood, energy, notes) }}
          onCancel={() => setShowFinish(false)}
        />
      )}
    </div>
  )
}
