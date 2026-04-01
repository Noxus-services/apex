/**
 * Pushes a compact athlete snapshot to Supabase once per day.
 * The daily-planner cron job reads this to generate the daily plan.
 * Runs silently in background — never blocks the UI.
 */

import { supabase, todayISO } from '../lib/supabase'
import { db } from '../db/database'
import type { UserProfile } from '../types'

export async function pushAthleteSnapshot(profile: UserProfile): Promise<void> {
  try {
    const today = todayISO()
    const userId = profile.name.toLowerCase().replace(/\s+/g, '_')

    // Fetch local data
    const [sessions, wellness, supplements, programs] = await Promise.all([
      db.workoutSessions.orderBy('date').reverse().limit(5).toArray(),
      db.dailyWellness.orderBy('date').reverse().limit(1).toArray(),
      db.supplementSchedules.toArray(),
      db.programs.filter(p => !!p.isActive).first(),
    ])

    await supabase.from('athlete_snapshots').upsert(
      {
        user_id: userId,
        snapshot_date: today,
        profile_json: profile,
        wellness_json: wellness[0] ?? null,
        last_sessions_json: sessions,
        supplements_json: supplements,
        active_program_json: programs ?? null,
      },
      { onConflict: 'user_id,snapshot_date' }
    )
  } catch {
    // Silent — snapshot is optional, never block the app
  }
}

/** Stable user_id derived from profile name */
export function getUserId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}
