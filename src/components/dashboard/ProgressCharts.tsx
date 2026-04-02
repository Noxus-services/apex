import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { WorkoutSession } from '../../types'

interface ProgressChartsProps {
  sessions: WorkoutSession[]
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
}

function buildLast7Days(sessions: WorkoutSession[]) {
  const result: { day: string; volume: number; date: string }[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)

    const dayVolume = sessions
      .filter(s => {
        const sd = new Date(s.date)
        return sd >= d && sd < next
      })
      .reduce((acc, s) => {
        // Fallback: compute from exercises if totalVolume is missing
        if (s.totalVolume && s.totalVolume > 0) return acc + s.totalVolume
        const computed = s.exercises?.reduce((exAcc, ex) =>
          exAcc + ex.sets.filter(set => set.completed && !set.isWarmup)
            .reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0)
        , 0) ?? 0
        return acc + computed
      }, 0)

    result.push({
      day: getDayLabel(d),
      volume: Math.round(dayVolume),
      date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    })
  }
  return result
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; volume: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-sm font-body">
      <p className="text-[rgba(240,237,230,0.6)] text-xs">{d.date}</p>
      <p className="text-accent-yellow font-medium">{d.volume} kg</p>
    </div>
  )
}

export function ProgressCharts({ sessions }: ProgressChartsProps) {
  const data = useMemo(() => buildLast7Days(sessions), [sessions])
  const hasData = data.some(d => d.volume > 0)

  return (
    <div className="card-elevated">
      <h3 className="font-body font-medium text-[rgba(240,237,230,0.7)] text-sm mb-3 uppercase tracking-widest">
        Volume — 7 derniers jours
      </h3>
      {!hasData ? (
        <p className="text-center text-[rgba(240,237,230,0.55)] text-sm py-6 font-body">
          Aucune séance cette semaine
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} barCategoryGap="30%">
            <XAxis
              dataKey="day"
              tick={{ fill: 'rgba(240,237,230,0.7)', fontSize: 11, fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar
              dataKey="volume"
              fill="#e8ff47"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
