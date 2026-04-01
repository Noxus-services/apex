import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Typed helpers ─────────────────────────────────────────────────────────────

export interface DailyPlanRow {
  id?: string
  user_id: string
  plan_date: string
  day_score: number
  program_adjustments: string
  supplement_timeline: SupplementEntry[]
  protein_target_g: number
  daily_insights: string
  notifications_scheduled: NotificationEntry[]
  created_at?: string
}

export interface SupplementEntry {
  time: string       // "07:30"
  name: string
  dose: string
  reason: string
}

export interface NotificationEntry {
  time: string
  title: string
  body: string
  type: 'supplement' | 'pre_workout' | 'post_workout' | 'check_in' | 'recovery'
}

export interface SupplementLogRow {
  id?: string
  user_id: string
  log_date: string
  supplement_name: string
  scheduled_time: string
  taken_at?: string
  skipped: boolean
}

export interface NutritionLogRow {
  id?: string
  user_id: string
  log_date: string
  protein_g: number
  calories?: number
  notes?: string
  created_at?: string
}

export interface AthleteModelRow {
  id?: string
  user_id: string
  avg_sleep_quality: number
  avg_stress: number
  avg_soreness: number
  adherence_rate: number
  volume_trend: string
  best_days_of_week: number[]
  typical_training_hour: number
  recovery_score: number
  insights: { key: string; value: string; confidence: number }[]
  updated_at?: string
}

// ── Today's date as ISO string ────────────────────────────────────────────────
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
