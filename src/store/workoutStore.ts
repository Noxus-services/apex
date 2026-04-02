import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ActiveSessionState,
  ActiveExercise,
  ActiveSet,
  ProgramDay,
  PlannedExercise,
} from '../types'

interface WorkoutState {
  session: ActiveSessionState | null
  isSessionActive: boolean

  startSession: (day: ProgramDay, suggestions: Record<string, number>) => void
  completeSet: (
    exerciseIdx: number,
    setIdx: number,
    weight: number,
    reps: number,
    rpe: number | null
  ) => void
  skipSet: (exerciseIdx: number, setIdx: number) => void
  setCurrentExercise: (idx: number) => void
  clearSession: () => void
  updateMood: (mood: 1 | 2 | 3 | 4 | 5) => void
  updateEnergy: (energy: 1 | 2 | 3 | 4 | 5) => void
  undoLastSet: () => void
  togglePause: () => void
}

function buildWarmupSets(workWeight: number): ActiveSet[] {
  const percentages = [0.4, 0.6, 0.75]
  return percentages.map((pct, i) => ({
    setNumber: i + 1,
    targetWeight: Math.round((workWeight * pct) / 1.25) * 1.25,
    targetReps: 5,
    loggedWeight: null,
    loggedReps: null,
    rpe: null,
    status: 'pending' as const,
    timestamp: null,
    isWarmup: true,
  }))
}

function buildWorkSets(
  planned: PlannedExercise,
  suggestedWeight: number,
  warmupCount: number
): ActiveSet[] {
  return Array.from({ length: planned.sets }, (_, i) => ({
    setNumber: warmupCount + i + 1,
    targetWeight: suggestedWeight,
    targetReps: planned.repsMax,
    loggedWeight: null,
    loggedReps: null,
    rpe: null,
    status: 'pending' as const,
    timestamp: null,
    isWarmup: false,
  }))
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
  session: null,
  isSessionActive: false,

  startSession: (day: ProgramDay, suggestions: Record<string, number>) => {
    const exercises: ActiveExercise[] = day.exercises.map(planned => {
      const suggestedWeight = suggestions[planned.exerciseId] ?? 20
      const warmupSets = buildWarmupSets(suggestedWeight)
      const workSets = buildWorkSets(planned, suggestedWeight, warmupSets.length)
      return {
        planned,
        sets: [...warmupSets, ...workSets],
        isExpanded: false,
      }
    })

    const session: ActiveSessionState = {
      sessionId: crypto.randomUUID(),
      dayName: day.name,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      exercises,
      restTimer: null,
      sessionStartTime: new Date(),
      isPaused: false,
      mood: 3,
      energy: 3,
    }

    set({ session, isSessionActive: true })
  },

  completeSet: (exerciseIdx, setIdx, weight, reps, rpe) => {
    const { session } = get()
    if (!session) return

    const exercises = session.exercises.map((ex, eIdx) => {
      if (eIdx !== exerciseIdx) return ex
      const sets = ex.sets.map((s, sIdx) => {
        if (sIdx !== setIdx) return s
        return {
          ...s,
          loggedWeight: weight,
          loggedReps: reps,
          rpe,
          status: 'completed' as const,
          timestamp: new Date(),
        }
      })
      return { ...ex, sets }
    })

    // Advance current set/exercise pointer
    let nextExerciseIndex = session.currentExerciseIndex
    let nextSetIndex = session.currentSetIndex + 1

    const currentEx = exercises[exerciseIdx]
    if (nextSetIndex >= currentEx.sets.length) {
      nextSetIndex = 0
      nextExerciseIndex = exerciseIdx + 1
    }

    set({
      session: {
        ...session,
        exercises,
        currentExerciseIndex: Math.min(nextExerciseIndex, exercises.length - 1),
        currentSetIndex: nextSetIndex,
      },
    })
  },

  skipSet: (exerciseIdx, setIdx) => {
    const { session } = get()
    if (!session) return

    const exercises = session.exercises.map((ex, eIdx) => {
      if (eIdx !== exerciseIdx) return ex
      const sets = ex.sets.map((s, sIdx) => {
        if (sIdx !== setIdx) return s
        return { ...s, status: 'skipped' as const, timestamp: new Date() }
      })
      return { ...ex, sets }
    })

    let nextExerciseIndex = session.currentExerciseIndex
    let nextSetIndex = session.currentSetIndex + 1

    const currentEx = exercises[exerciseIdx]
    if (nextSetIndex >= currentEx.sets.length) {
      nextSetIndex = 0
      nextExerciseIndex = exerciseIdx + 1
    }

    set({
      session: {
        ...session,
        exercises,
        currentExerciseIndex: Math.min(nextExerciseIndex, exercises.length - 1),
        currentSetIndex: nextSetIndex,
      },
    })
  },

  setCurrentExercise: (idx: number) => {
    const { session } = get()
    if (!session) return
    set({
      session: {
        ...session,
        currentExerciseIndex: idx,
        currentSetIndex: 0,
      },
    })
  },

  clearSession: () => {
    set({ session: null, isSessionActive: false })
  },

  updateMood: (mood) => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, mood } })
  },

  updateEnergy: (energy) => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, energy } })
  },

  togglePause: () => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, isPaused: !session.isPaused } })
  },

  undoLastSet: () => {
    const { session } = get()
    if (!session) return

    // Walk backwards through all sets to find the last completed one
    const exercises = [...session.exercises]
    let found = false

    for (let eIdx = session.currentExerciseIndex; eIdx >= 0 && !found; eIdx--) {
      const ex = exercises[eIdx]
      const startIdx = eIdx === session.currentExerciseIndex
        ? session.currentSetIndex - 1
        : ex.sets.length - 1
      for (let sIdx = startIdx; sIdx >= 0 && !found; sIdx--) {
        if (ex.sets[sIdx].status === 'completed') {
          const newSets = ex.sets.map((s, i) =>
            i === sIdx
              ? { ...s, status: 'pending' as const, loggedWeight: null, loggedReps: null, rpe: null, timestamp: null }
              : s
          )
          exercises[eIdx] = { ...ex, sets: newSets }
          // Move pointer back
          set({
            session: {
              ...session,
              exercises,
              currentExerciseIndex: eIdx,
              currentSetIndex: sIdx,
            },
          })
          found = true
        }
      }
    }
  },
    }),
    {
      name: 'apex-workout-session',
      // Only persist the active session, not UI state
      partialize: (state) => ({
        session: state.session,
        isSessionActive: state.isSessionActive,
      }),
      // Revive Date objects after deserialization
      onRehydrateStorage: () => (state) => {
        if (state?.session?.sessionStartTime) {
          state.session.sessionStartTime = new Date(state.session.sessionStartTime)
        }
      },
    }
  )
)
