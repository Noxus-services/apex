import { useWorkoutStore } from '../store/workoutStore'
import { useVibration } from './useVibration'
import { useTimer } from './useTimer'
import { calculateSessionVolume, detectPRs } from '../utils/calculations'
import { db } from '../db/database'
import type { LoggedSet } from '../types'

export function useWorkout() {
  const store = useWorkoutStore()
  const vibration = useVibration()
  const timer = useTimer()

  async function validateSet(
    exerciseIndex: number,
    setIndex: number,
    weight: number,
    reps: number,
    rpe: number | null
  ) {
    vibration.success()
    store.completeSet(exerciseIndex, setIndex, weight, reps, rpe)
    const restSeconds =
      store.session?.exercises[exerciseIndex]?.planned.restSeconds ?? 90
    timer.start(restSeconds)
  }

  async function finishSession(mood: number, energy: number, notes: string) {
    const session = store.session
    if (!session) return null

    const loggedExercises = session.exercises.map(ex => ({
      exerciseId: ex.planned.exerciseId,
      name: ex.planned.name,
      sets: ex.sets
        .filter(s => s.status === 'completed')
        .map(
          s =>
            ({
              setNumber: s.setNumber,
              weight: s.loggedWeight!,
              reps: s.loggedReps!,
              rpe: s.rpe,
              completed: true,
              isWarmup: s.isWarmup,
              timestamp: s.timestamp,
            } as LoggedSet)
        ),
      notes: '',
    }))

    const allHistory = await db.workoutSessions.toArray()
    const totalVolume = calculateSessionVolume(loggedExercises)
    const prs = detectPRs(
      { exercises: loggedExercises, date: new Date() } as any,
      allHistory
    )

    if (prs.length > 0) vibration.pr()

    const completedSession = {
      date: session.sessionStartTime,
      startedAt: session.sessionStartTime,
      completedAt: new Date(),
      dayName: session.exercises[0]?.planned.name ?? 'Séance',
      exercises: loggedExercises,
      mood: mood as any,
      energy: energy as any,
      notes,
      totalVolume,
      duration: Math.round(
        (Date.now() - session.sessionStartTime.getTime()) / 60000
      ),
      prsAchieved: prs,
    }

    const id = await db.workoutSessions.add(completedSession as any)
    store.clearSession()
    return { ...completedSession, id, prs }
  }

  return { validateSet, finishSession, timer }
}
