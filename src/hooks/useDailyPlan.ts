import { useState, useEffect, useCallback } from 'react'
import { supabase, todayISO } from '../lib/supabase'
import type { DailyPlanRow, SupplementLogRow } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { getUserId } from '../services/snapshotSync'
import { db } from '../db/database'
import type { DailyWellness } from '../types'

export function useDailyPlan() {
  const { profile } = useUserStore()
  const [plan, setPlan] = useState<DailyPlanRow | null>(null)
  const [supplementLogs, setSupplementLogs] = useState<SupplementLogRow[]>([])
  const [proteinToday, setProteinToday] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [wellness, setWellness] = useState<DailyWellness | null>(null)

  const userId = profile ? getUserId(profile.name) : ''
  const today = todayISO()

  const load = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    const [planRes, suppRes, nutRes, wellRes] = await Promise.all([
      supabase
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_date', today)
        .maybeSingle(),
      supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('log_date', today),
      supabase
        .from('nutrition_logs')
        .select('protein_g')
        .eq('user_id', userId)
        .eq('log_date', today),
      db.dailyWellness.orderBy('date').reverse().first(),
    ])

    setPlan(planRes.data as DailyPlanRow | null)
    setSupplementLogs((suppRes.data ?? []) as SupplementLogRow[])
    const total = (nutRes.data ?? []).reduce((s: number, r: { protein_g: number }) => s + r.protein_g, 0)
    setProteinToday(total)
    setWellness(wellRes ?? null)
    setIsLoading(false)
  }, [userId, today])

  useEffect(() => { load() }, [load])

  /** Mark a supplement as taken */
  async function markSupplementTaken(name: string, scheduledTime: string) {
    const existing = supplementLogs.find(s => s.supplement_name === name)
    if (existing?.taken_at) return // already marked

    const row: SupplementLogRow = {
      user_id: userId,
      log_date: today,
      supplement_name: name,
      scheduled_time: scheduledTime,
      taken_at: new Date().toISOString(),
      skipped: false,
    }

    await supabase.from('supplement_logs').upsert(row, {
      onConflict: 'user_id,log_date,supplement_name',
    })
    setSupplementLogs(prev => {
      const filtered = prev.filter(s => s.supplement_name !== name)
      return [...filtered, row]
    })
  }

  /** Log protein intake */
  async function logProtein(grams: number) {
    await supabase.from('nutrition_logs').insert({
      user_id: userId,
      log_date: today,
      protein_g: grams,
    })
    setProteinToday(prev => prev + grams)
  }

  /** Compute a local day score when no server plan exists */
  function computeLocalScore(): number {
    if (!wellness) return 70
    let score = 80
    if (wellness.stressLevel >= 4) score -= 20
    if (wellness.soreness >= 4) score -= 15
    if (wellness.motivation <= 2) score -= 10
    if (wellness.motivation >= 4) score += 5
    return Math.max(0, Math.min(100, score))
  }

  const dayScore = plan?.day_score ?? computeLocalScore()
  const proteinTarget = plan?.protein_target_g ?? (profile ? Math.round(profile.weight * 2.2) : 160)
  const supplementTimeline = plan?.supplement_timeline ?? []
  const dailyInsights = plan?.daily_insights ?? null
  const programAdjustments = plan?.program_adjustments ?? null

  return {
    plan,
    dayScore,
    proteinTarget,
    proteinToday,
    supplementTimeline,
    supplementLogs,
    dailyInsights,
    programAdjustments,
    isLoading,
    wellness,
    markSupplementTaken,
    logProtein,
    reload: load,
  }
}
