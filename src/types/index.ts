export interface UserProfile {
  id?: number
  name: string
  age: number
  weight: number
  height: number
  experience: 'debutant' | 'intermediaire' | 'avance'
  goal: 'force' | 'hypertrophie' | 'perte_poids' | 'athletisme'
  goalDescription: string
  daysPerWeek: number
  availableEquipment: string[]
  supplements: string[]
  trainingTime: string // e.g. "18:00"
  injuries: string
  createdAt: Date
  updatedAt: Date
}

export interface PlannedExercise {
  exerciseId: string
  name: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  rpe: number
  technique: string
  notes: string
}

export interface ProgramDay {
  dayIndex: number
  name: string
  focus: string
  estimatedDuration: number
  exercises: PlannedExercise[]
}

export interface ProgramWeek {
  weekIndex: number
  days: ProgramDay[]
}

export interface Program {
  id?: number
  name: string
  generatedAt: Date
  weekNumber: number
  weeks: ProgramWeek[]
  aiRationale: string
  feasibilityAnalysis: string
  isActive: boolean
}

export interface LoggedSet {
  setNumber: number
  weight: number
  reps: number
  rpe: number | null
  completed: boolean
  isWarmup: boolean
  timestamp: Date | null
}

export interface LoggedExercise {
  exerciseId: string
  name: string
  sets: LoggedSet[]
  notes: string
}

export interface PR {
  exerciseId: string
  exerciseName: string
  type: '1rm' | 'volume' | 'reps'
  value: number
  previousValue: number
  date: Date
}

export interface WorkoutSession {
  id?: number
  programDayRef?: string
  date: Date
  startedAt: Date
  completedAt?: Date
  dayName: string
  exercises: LoggedExercise[]
  bodyweight?: number
  mood: 1 | 2 | 3 | 4 | 5
  energy: 1 | 2 | 3 | 4 | 5
  notes: string
  aiCoachFeedback?: string
  totalVolume: number
  duration: number
  prsAchieved: PR[]
}

export interface ActiveSet {
  setNumber: number
  targetWeight: number
  targetReps: number
  loggedWeight: number | null
  loggedReps: number | null
  rpe: number | null
  status: 'pending' | 'active' | 'completed' | 'skipped'
  timestamp: Date | null
  isWarmup: boolean
}

export interface ActiveExercise {
  planned: PlannedExercise
  sets: ActiveSet[]
  isExpanded: boolean
}

export interface ActiveSessionState {
  sessionId: string
  currentExerciseIndex: number
  currentSetIndex: number
  exercises: ActiveExercise[]
  restTimer: number | null
  sessionStartTime: Date
  isPaused: boolean
  mood: 1 | 2 | 3 | 4 | 5
  energy: 1 | 2 | 3 | 4 | 5
}

export interface CoachMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context: 'weekly_review' | 'post_workout' | 'chat' | 'program_gen'
}

export interface WeeklyReview {
  id?: number
  weekStart: Date
  weekEnd: Date
  generatedAt: Date
  sessionsCount: number
  totalVolume: number
  analysis: string
  nextWeekAdjustments: string
  progressScore: number
  keyInsights: string[]
}

export interface Exercise {
  id: string
  name: string
  nameFr: string
  bodyPart: string
  equipment: string
  gifUrl: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
}

export interface SupplementSchedule {
  id?: number
  supplement: string
  timeOfDay: string // "08:00"
  notes: string
  enabled: boolean
}

export interface SleepLog {
  id?: number
  date: Date
  hoursSlept: number
  quality: 1 | 2 | 3 | 4 | 5
  notes: string
}

export interface DailyWellness {
  id?: number
  date: Date
  stressLevel: 1 | 2 | 3 | 4 | 5
  soreness: 1 | 2 | 3 | 4 | 5
  motivation: 1 | 2 | 3 | 4 | 5
  hrv?: number
  notes: string
}
