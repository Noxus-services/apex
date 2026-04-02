import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import type { SupplementSchedule } from '../../types'

function parseTime(timeStr: string): { h: number; m: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { h: h ?? 0, m: m ?? 0 }
}

function getMinutesFromMidnight(timeStr: string): number {
  const { h, m } = parseTime(timeStr)
  return h * 60 + m
}

export function SupplementReminder() {
  const [next, setNext] = useState<SupplementSchedule | null>(null)
  const [minutesUntil, setMinutesUntil] = useState<number>(0)

  useEffect(() => {
    async function load() {
      const schedules = await db.supplementSchedules
        .filter(s => s.enabled)
        .toArray()

      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const windowEnd = nowMinutes + 4 * 60 // next 4 hours

      const upcoming = schedules
        .map(s => {
          const mins = getMinutesFromMidnight(s.timeOfDay)
          return { schedule: s, mins }
        })
        .filter(({ mins }) => mins >= nowMinutes - 5 && mins <= windowEnd)
        .sort((a, b) => a.mins - b.mins)

      if (upcoming.length === 0) {
        setNext(null)
        return
      }

      const { schedule, mins } = upcoming[0]
      setNext(schedule)
      setMinutesUntil(Math.max(0, mins - nowMinutes))
    }

    load()
    // Refresh every minute so countdown stays accurate
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!next) return null

  const timeLabel =
    minutesUntil <= 5
      ? 'Maintenant'
      : minutesUntil < 60
      ? `Dans ${minutesUntil} min`
      : `Dans ${Math.round(minutesUntil / 60)}h`

  return (
    <div className="card flex items-center gap-3">
      <span className="text-2xl" aria-hidden="true">💊</span>
      <div className="flex-1 min-w-0">
        <p className="font-body font-medium text-[#f0ede6] text-sm truncate">
          {next.supplement}
        </p>
        {next.notes ? (
          <p className="font-body text-xs text-[rgba(240,237,230,0.7)] truncate">{next.notes}</p>
        ) : null}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-accent-yellow text-sm font-medium">{timeLabel}</p>
        <p className="font-body text-xs text-[rgba(240,237,230,0.7)]">{next.timeOfDay}</p>
      </div>
    </div>
  )
}
