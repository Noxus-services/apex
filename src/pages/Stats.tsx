import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
  Cell,
} from 'recharts'
import { db } from '../db/database'
import { useUserStore } from '../store/userStore'
import { computeStreak } from '../utils/calculations'
import type { WorkoutSession, PR } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}

function getWeekStart(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = 'kg' }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-xs font-body">
      <p className="text-[rgba(240,237,230,0.5)] mb-0.5">{label}</p>
      <p className="text-accent-yellow font-semibold">
        {unit === 'min' ? `${payload[0].value} min` : fmtVolume(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="section-label text-[rgba(240,237,230,0.6)] mb-3">{children}</p>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ value, label, sub, highlight = false }: {
  value: string
  label: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`card flex-1 flex flex-col items-center py-3 gap-0.5 ${highlight ? 'border-accent-yellow/30 bg-accent-yellow/[0.04]' : ''}`}>
      <span className={`font-display text-2xl leading-none ${highlight ? 'text-accent-yellow' : 'text-[#f0ede6]'}`}>
        {value}
      </span>
      <span className="font-body text-xs text-[rgba(240,237,230,0.7)] text-center leading-tight">{label}</span>
      {sub && <span className="font-body text-[10px] text-[rgba(240,237,230,0.5)] text-center">{sub}</span>}
    </div>
  )
}

// ─── Weekly volume chart (last 8 weeks) ──────────────────────────────────────

function WeeklyVolumeChart({ sessions }: { sessions: WorkoutSession[] }) {
  const weeks: { label: string; volume: number; sessions: number }[] = []
  const now = new Date()

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const weekSessions = sessions.filter(s => {
      const d = new Date(s.date)
      return d >= weekStart && d < weekEnd
    })

    const vol = weekSessions.reduce((acc, s) => acc + (s.totalVolume ?? 0), 0)
    const label = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    weeks.push({ label, volume: Math.round(vol), sessions: weekSessions.length })
  }

  const max = Math.max(...weeks.map(w => w.volume), 1)

  return (
    <div className="card-elevated">
      <SectionTitle>VOLUME HEBDOMADAIRE</SectionTitle>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={weeks} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgba(240,237,230,0.6)', fontSize: 10, fontFamily: 'DM Sans' }}
            axisLine={false} tickLine={false}
          />
          <YAxis hide domain={[0, max * 1.1]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {weeks.map((_entry, i) => (
              <Cell
                key={i}
                fill={i === weeks.length - 1 ? '#e8ff47' : 'rgba(232,255,71,0.35)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Session duration trend (last 10 sessions) ───────────────────────────────

function DurationChart({ sessions }: { sessions: WorkoutSession[] }) {
  const last10 = [...sessions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10)
    .map(s => ({
      label: new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      duration: Math.round((s.duration ?? 0) / 60),
    }))

  if (last10.length < 2) return null

  return (
    <div className="card-elevated">
      <SectionTitle>DURÉE DES SÉANCES</SectionTitle>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={last10}>
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgba(240,237,230,0.6)', fontSize: 10, fontFamily: 'DM Sans' }}
            axisLine={false} tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltip unit="min" />} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
          <Line
            type="monotone"
            dataKey="duration"
            stroke="#e8ff47"
            strokeWidth={2}
            dot={{ fill: '#e8ff47', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#e8ff47' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Activity heatmap (last 12 weeks) ────────────────────────────────────────

function ActivityHeatmap({ sessions }: { sessions: WorkoutSession[] }) {
  const now = new Date()
  const sessionDates = sessions.map(s => new Date(s.date))

  // Build 12 weeks × 7 days grid (Mon–Sun)
  const weeks: Date[][] = []
  for (let w = 11; w >= 0; w--) {
    const week: Date[] = []
    const weekStart = new Date(now)
    const d = weekStart.getDay()
    weekStart.setDate(now.getDate() - (d === 0 ? 6 : d - 1) - w * 7)
    weekStart.setHours(0, 0, 0, 0)
    for (let day = 0; day < 7; day++) {
      const cell = new Date(weekStart)
      cell.setDate(weekStart.getDate() + day)
      week.push(cell)
    }
    weeks.push(week)
  }

  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  function hasSession(date: Date): boolean {
    return sessionDates.some(sd => isSameDay(sd, date))
  }

  function isToday(date: Date): boolean {
    return isSameDay(date, now)
  }

  function isFuture(date: Date): boolean {
    return date > now
  }

  return (
    <div className="card-elevated">
      <SectionTitle>FRÉQUENCE D'ENTRAÎNEMENT</SectionTitle>
      <div className="flex gap-1">
        {/* Day labels column */}
        <div className="flex flex-col gap-1 mr-1">
          <div className="h-3" /> {/* spacer for month labels */}
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="h-3 flex items-center">
              <span className="text-[9px] font-mono text-[rgba(240,237,230,0.45)] w-3 text-center">{l}</span>
            </div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {/* Month label on first day of month */}
            <div className="h-3 flex items-center justify-center">
              {week[0].getDate() <= 7 && (
                <span className="text-[9px] font-mono text-[rgba(240,237,230,0.5)]">
                  {week[0].toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3)}
                </span>
              )}
            </div>
            {week.map((date, di) => {
              const trained = hasSession(date)
              const today = isToday(date)
              const future = isFuture(date)
              return (
                <div
                  key={di}
                  className={`h-3 rounded-sm transition-all ${
                    future
                      ? 'bg-transparent'
                      : trained
                      ? today ? 'bg-accent-yellow' : 'bg-accent-yellow/70'
                      : today
                      ? 'bg-white/20 ring-1 ring-accent-yellow/40'
                      : 'bg-white/[0.06]'
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[9px] font-mono text-[rgba(240,237,230,0.55)]">Moins</span>
        <div className="w-3 h-3 rounded-sm bg-white/[0.06]" />
        <div className="w-3 h-3 rounded-sm bg-accent-yellow/40" />
        <div className="w-3 h-3 rounded-sm bg-accent-yellow" />
        <span className="text-[9px] font-mono text-[rgba(240,237,230,0.55)]">Plus</span>
      </div>
    </div>
  )
}

// ─── Top PRs ──────────────────────────────────────────────────────────────────

function TopPRs({ sessions }: { sessions: WorkoutSession[] }) {
  // Collect best PR per exercise (by value)
  const prMap = new Map<string, PR & { sessionDate: Date }>()

  for (const s of sessions) {
    for (const pr of s.prsAchieved ?? []) {
      const existing = prMap.get(pr.exerciseId)
      if (!existing || pr.value > existing.value) {
        prMap.set(pr.exerciseId, { ...pr, sessionDate: new Date(s.date) })
      }
    }
  }

  const prs = [...prMap.values()].sort((a, b) => b.value - a.value).slice(0, 8)

  if (prs.length === 0) {
    return (
      <div className="card-elevated">
        <SectionTitle>RECORDS PERSONNELS</SectionTitle>
        <p className="text-center text-[rgba(240,237,230,0.5)] text-sm py-4 font-body">
          Tes records apparaîtront ici après tes séances
        </p>
      </div>
    )
  }

  return (
    <div className="card-elevated flex flex-col gap-0">
      <SectionTitle>RECORDS PERSONNELS</SectionTitle>
      {prs.map((pr, i) => (
        <div key={pr.exerciseId} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
          <span className="font-mono text-xs text-[rgba(240,237,230,0.45)] w-4 text-right flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-[#f0ede6] truncate">{pr.exerciseName}</p>
            <p className="font-mono text-[10px] text-[rgba(240,237,230,0.55)]">
              {pr.type.toUpperCase()} · {new Date(pr.sessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="font-display text-xl text-accent-yellow leading-none">{pr.value}</span>
            <span className="font-mono text-xs text-[rgba(240,237,230,0.7)] ml-0.5">kg</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Muscle balance chart ────────────────────────────────────────────────────

function MuscleBalanceChart({ sessions }: { sessions: WorkoutSession[] }) {
  const muscleGroups: Record<string, number> = {}

  for (const s of sessions) {
    for (const ex of s.exercises ?? []) {
      const name = ex.name.toLowerCase()
      let group = 'Autres'
      if (name.includes('bench') || name.includes('chest') || name.includes('pectoral') || name.includes('fly') || name.includes('push')) group = 'Poitrine'
      else if (name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('deadlift') || name.includes('back')) group = 'Dos'
      else if (name.includes('squat') || name.includes('leg') || name.includes('lunge') || name.includes('hip') || name.includes('rdl') || name.includes('hamstring') || name.includes('quad') || name.includes('glute')) group = 'Jambes'
      else if (name.includes('shoulder') || name.includes('press') || name.includes('delt') || name.includes('overhead') || name.includes('military')) group = 'Épaules'
      else if (name.includes('curl') || name.includes('bicep') || name.includes('tricep') || name.includes('dip') || name.includes('extension') || name.includes('skull')) group = 'Bras'
      else if (name.includes('abs') || name.includes('plank') || name.includes('crunch') || name.includes('core')) group = 'Abdos'

      const vol = ex.sets.filter(set => set.completed && !set.isWarmup)
        .reduce((acc, set) => acc + set.weight * set.reps, 0)
      muscleGroups[group] = (muscleGroups[group] ?? 0) + vol
    }
  }

  const entries = Object.entries(muscleGroups)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  if (entries.length === 0) return null

  const total = entries.reduce((acc, [, v]) => acc + v, 0)
  const maxVol = entries[0]?.[1] ?? 1

  const chestVol = muscleGroups['Poitrine'] ?? 0
  const backVol = muscleGroups['Dos'] ?? 0
  const hasImbalance = chestVol > backVol * 1.5 || backVol > chestVol * 1.5

  return (
    <div className="card-elevated">
      <SectionTitle>ÉQUILIBRE MUSCULAIRE</SectionTitle>
      {hasImbalance && (
        <div className="mb-3 px-3 py-2 bg-orange-500/[0.06] border border-orange-500/20 rounded-lg">
          <p className="font-body text-xs text-orange-400/90">
            ⚠️ {chestVol > backVol * 1.5 ? 'Poitrine > Dos — ajoute du rowing pour équilibrer.' : 'Dos > Poitrine — équilibre avec du développé couché.'}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {entries.map(([name, vol]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="font-body text-xs text-[rgba(240,237,230,0.6)] w-20 flex-shrink-0">{name}</span>
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(vol / maxVol) * 100}%`,
                  background: (name === 'Poitrine' && hasImbalance && chestVol > backVol * 1.5) ||
                               (name === 'Dos' && hasImbalance && backVol > chestVol * 1.5)
                    ? '#f97316'
                    : '#e8ff47'
                }}
              />
            </div>
            <span className="font-mono text-xs text-[rgba(240,237,230,0.5)] w-12 text-right flex-shrink-0">
              {Math.round((vol / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Volume by muscle group ───────────────────────────────────────────────────

function VolumeByMuscle({ sessions }: { sessions: WorkoutSession[] }) {
  const muscleVolume = new Map<string, number>()

  for (const s of sessions) {
    for (const ex of s.exercises ?? []) {
      const vol = ex.sets
        .filter(set => set.completed)
        .reduce((acc, set) => acc + set.weight * set.reps, 0)
      if (vol > 0) {
        muscleVolume.set(ex.name, (muscleVolume.get(ex.name) ?? 0) + vol)
      }
    }
  }

  const top = [...muscleVolume.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, volume]) => ({ name: name.slice(0, 18), volume: Math.round(volume) }))

  if (top.length === 0) return null

  const maxVol = Math.max(...top.map(t => t.volume), 1)

  return (
    <div className="card-elevated">
      <SectionTitle>TOP EXERCICES — VOLUME TOTAL</SectionTitle>
      <div className="flex flex-col gap-2">
        {top.map(({ name, volume }, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="font-body text-xs text-[rgba(240,237,230,0.5)] w-32 flex-shrink-0 truncate">{name}</span>
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-yellow/60 rounded-full transition-all duration-700"
                style={{ width: `${(volume / maxVol) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-[rgba(240,237,230,0.6)] w-16 text-right flex-shrink-0">
              {fmtVolume(volume)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mood & Energy trend (last 12 sessions) ──────────────────────────────────

function MoodEnergyChart({ sessions }: { sessions: WorkoutSession[] }) {
  const last12 = [...sessions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-12)
    .map(s => ({
      label: new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      mood: s.mood,
      energy: s.energy,
    }))

  if (last12.length < 2) return null

  return (
    <div className="card">
      <SectionTitle>HUMEUR & ÉNERGIE</SectionTitle>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={last12} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: 'rgba(240,237,230,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={{ fill: 'rgba(240,237,230,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-xs font-body">
                  <p className="text-[rgba(240,237,230,0.5)] mb-1">{label}</p>
                  <p style={{ color: '#e8ff47' }}>Humeur : {payload[0]?.value}/5</p>
                  <p style={{ color: '#4ade80' }}>Énergie : {payload[1]?.value}/5</p>
                </div>
              )
            }}
          />
          <Line type="monotone" dataKey="mood" stroke="#e8ff47" strokeWidth={2} dot={{ r: 3, fill: '#e8ff47', strokeWidth: 0 }} />
          <Line type="monotone" dataKey="energy" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full" style={{ background: '#e8ff47' }} />
          <span className="font-mono text-[10px] text-[rgba(240,237,230,0.5)]">Humeur</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full" style={{ background: '#4ade80' }} />
          <span className="font-mono text-[10px] text-[rgba(240,237,230,0.5)]">Énergie</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function StatsPage() {
  const { profile } = useUserStore()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    db.workoutSessions
      .where('date')
      .aboveOrEqual(sixMonthsAgo)
      .toArray()
      .then(all => {
        setSessions(all)
        setLoading(false)
      })
  }, [])

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const now = new Date()

  // This month sessions
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthSessions = sessions.filter(s => new Date(s.date) >= monthStart)

  // This week volume
  const weekStart = getWeekStart(now)
  const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart)
  const weekVolume = weekSessions.reduce((acc, s) => acc + (s.totalVolume ?? 0), 0)

  // All-time PRs
  const allPRs = sessions.flatMap(s => s.prsAchieved ?? [])

  // Current streak
  const streak = computeStreak(sessions)

  // Total volume all-time
  const totalVolume = sessions.reduce((acc, s) => acc + (s.totalVolume ?? 0), 0)

  const goalLabel = profile?.goal
    ? { force: 'Force', hypertrophie: 'Hypertrophie', perte_poids: 'Poids', athletisme: 'Athlétisme' }[profile.goal] ?? ''
    : ''

  return (
    <div className="page-container">
    <div
      className="px-4 pb-8"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-[28px] text-[#f0ede6] leading-none">Statistiques</h1>
        {goalLabel && (
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)] mt-1">
            Objectif · <span className="text-accent-yellow">{goalLabel}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-6 h-6 border-2 border-accent-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* KPI row 1 */}
          <div className="flex gap-2">
            <KpiCard value={sessions.length.toString()} label="Séances" sub="total" />
            <KpiCard value={fmtVolume(totalVolume)} label="Volume" sub="total" />
            <KpiCard value={`${streak}`} label="Streak" sub="jours" highlight={streak > 0} />
          </div>

          {/* KPI row 2 */}
          <div className="flex gap-2">
            <KpiCard value={monthSessions.length.toString()} label="Séances" sub="ce mois" />
            <KpiCard value={fmtVolume(weekVolume)} label="Volume" sub="cette semaine" />
            <KpiCard value={allPRs.length.toString()} label="Records" sub="total" />
          </div>

          {/* Volume chart */}
          <WeeklyVolumeChart sessions={sessions} />

          {/* Muscle balance */}
          <MuscleBalanceChart sessions={sessions} />

          {/* Activity heatmap */}
          <ActivityHeatmap sessions={sessions} />

          {/* Duration trend */}
          <DurationChart sessions={sessions} />
          <MoodEnergyChart sessions={sessions} />

          {/* Top exercises volume */}
          <VolumeByMuscle sessions={sessions} />

          {/* All-time PRs */}
          <TopPRs sessions={sessions} />

          {sessions.length === 0 && (
            <div className="card flex flex-col items-center gap-3 py-10">
              <span className="text-4xl">📊</span>
              <p className="font-body text-sm text-[rgba(240,237,230,0.72)] text-center">
                Complète ta première séance pour voir tes statistiques ici
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
