import type { LoggedSet, LoggedExercise, WorkoutSession, PR } from '../types'

export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 4) / 4
}

export function roundToPlate(weight: number): number {
  return Math.round(weight / 1.25) * 1.25
}

export function suggestNextWeight(
  lastSets: LoggedSet[],
  targetRepsMin: number,
  targetRepsMax: number
): number {
  const workSets = lastSets.filter(s => !s.isWarmup && s.completed)
  if (workSets.length === 0) return 20
  const lastSet = workSets[workSets.length - 1]
  const avgRPE = workSets.reduce((acc, s) => acc + (s.rpe ?? 7), 0) / workSets.length
  const allMaxReps = workSets.every(s => s.reps >= targetRepsMax)
  const allMinReps = workSets.every(s => s.reps >= targetRepsMin)
  if (allMaxReps && avgRPE <= 7.5) return roundToPlate(lastSet.weight + 2.5)
  if (allMaxReps && avgRPE <= 9) return lastSet.weight
  if (!allMinReps) return roundToPlate(lastSet.weight * 0.925)
  return lastSet.weight
}

export function calculateSessionVolume(exercises: LoggedExercise[]): number {
  return exercises.reduce((total, ex) =>
    total + ex.sets.filter(s => s.completed && !s.isWarmup).reduce((acc, s) => acc + s.weight * s.reps, 0), 0)
}

export function detectPRs(session: WorkoutSession, allHistory: WorkoutSession[]): PR[] {
  const prs: PR[] = []
  for (const exercise of session.exercises) {
    const prevSessions = allHistory.filter(s => s.exercises.some(e => e.exerciseId === exercise.exerciseId))
    if (prevSessions.length === 0) continue
    const workSets = exercise.sets.filter(s => s.completed && !s.isWarmup)
    if (workSets.length === 0) continue
    const current1RM = Math.max(...workSets.map(s => estimate1RM(s.weight, s.reps)))
    const prev1RMs = prevSessions.flatMap(s =>
      s.exercises.filter(e => e.exerciseId === exercise.exerciseId).flatMap(e =>
        e.sets.filter(set => set.completed && !set.isWarmup).map(set => estimate1RM(set.weight, set.reps))
      )
    )
    if (prev1RMs.length === 0) continue
    const prev1RM = Math.max(...prev1RMs)
    if (current1RM > prev1RM * 1.01) {
      prs.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        type: '1rm',
        value: Math.round(current1RM * 4) / 4,
        previousValue: Math.round(prev1RM * 4) / 4,
        date: session.date,
      })
    }
  }
  return prs
}

export function formatWeight(weight: number): string {
  return weight % 1 === 0 ? `${weight}` : `${weight.toFixed(2).replace(/0$/, '')}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
