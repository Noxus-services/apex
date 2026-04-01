import { useState, useEffect } from 'react'
import { db } from '../../db/database'
import type { SleepLog } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function getTodayEnd(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

// ── Sleep duration options ────────────────────────────────────────────────────

const SLEEP_HOURS: { label: string; value: number }[] = [
  { label: '5h', value: 5 },
  { label: '6h', value: 6 },
  { label: '7h', value: 7 },
  { label: '8h', value: 8 },
  { label: '9h+', value: 9 },
]

const QUALITY_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😵', label: 'Terrible' },
  { value: 2, emoji: '😴', label: 'Mauvais' },
  { value: 3, emoji: '😐', label: 'Correct' },
  { value: 4, emoji: '🙂', label: 'Bon' },
  { value: 5, emoji: '😄', label: 'Excellent' },
]

// ── Coaching note based on sleep ──────────────────────────────────────────────

function getSleepCoachNote(log: SleepLog): { text: string; variant: 'red' | 'yellow' | 'green' } {
  if (log.hoursSlept < 6) {
    return {
      text: 'Volume réduit recommandé — Ton sommeil insuffisant (<6h) diminue ta force de 10-30% et élève le cortisol.',
      variant: 'red',
    }
  }
  if (log.hoursSlept < 7 || log.quality <= 2) {
    return {
      text: 'Séance modérée conseillée — Évite les maximas et reste à RPE 7 max aujourd\'hui.',
      variant: 'yellow',
    }
  }
  if (log.hoursSlept >= 8 && log.quality >= 4) {
    return {
      text: 'Récupération optimale — Conditions idéales pour performer aujourd\'hui.',
      variant: 'green',
    }
  }
  return {
    text: 'Sommeil correct — Séance normale possible, écoute ton corps.',
    variant: 'green',
  }
}

// ── Summary (already logged today) ───────────────────────────────────────────

function SleepSummary({ log }: { log: SleepLog }) {
  const qualityEmoji = QUALITY_OPTIONS.find(q => q.value === log.quality)?.emoji ?? '😐'
  const note = getSleepCoachNote(log)

  const variantClasses = {
    red: 'bg-red-500/10 border-red-500/25 text-red-400',
    yellow: 'bg-accent-yellow/10 border-accent-yellow/25 text-accent-yellow',
    green: 'bg-green-500/10 border-green-500/25 text-green-400',
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-medium text-[rgba(240,237,230,0.7)]">
          Sommeil cette nuit
        </p>
        <span className="font-mono text-[9px] text-green-400/70 bg-green-400/10 px-2 py-0.5 rounded">
          Enregistré
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">😴</span>
        <div>
          <p className="font-display text-xl text-[#f0ede6] leading-none">
            {log.hoursSlept >= 9 ? '9h+' : `${log.hoursSlept}h`}
          </p>
          <p className="font-body text-xs text-[rgba(240,237,230,0.45)] mt-0.5">
            Qualité {qualityEmoji} {log.quality}/5
          </p>
        </div>
      </div>

      <div className={`border rounded-lg px-3 py-2 ${variantClasses[note.variant]}`}>
        <p className="font-body text-xs leading-relaxed">
          {note.text}
        </p>
      </div>
    </div>
  )
}

// ── SleepTracker (main) ───────────────────────────────────────────────────────

export function SleepTracker() {
  const [todayLog, setTodayLog] = useState<SleepLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [hoursSlept, setHoursSlept] = useState<number>(7)
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3)

  useEffect(() => {
    async function checkToday() {
      setLoading(true)
      const start = getTodayStart()
      const end = getTodayEnd()
      const existing = await db.sleepLogs
        .where('date')
        .between(start, end, true, true)
        .first()
      setTodayLog(existing ?? null)
      setLoading(false)
    }
    checkToday()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const entry: SleepLog = {
        date: new Date(),
        hoursSlept,
        quality,
        notes: '',
      }
      await db.sleepLogs.add(entry)
      setTodayLog(entry)
    } catch (err) {
      console.error('[SleepTracker] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (todayLog) {
    return <SleepSummary log={todayLog} />
  }

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <p className="font-body text-sm font-medium text-[#f0ede6]">
          🌙 Comment as-tu dormi ?
        </p>
        <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5">
          Le sommeil est le pilier n°1 de ta récupération
        </p>
      </div>

      {/* Hours selector */}
      <div className="flex flex-col gap-2">
        <span className="font-body text-xs text-[rgba(240,237,230,0.6)]">Durée du sommeil</span>
        <div className="flex gap-2">
          {SLEEP_HOURS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setHoursSlept(opt.value)}
              className={`flex-1 py-2.5 rounded-xl font-body text-sm font-medium transition-colors ${
                hoursSlept === opt.value
                  ? 'bg-accent-blue/20 border border-accent-blue/40 text-accent-blue'
                  : 'bg-bg-elevated border border-border-subtle text-[rgba(240,237,230,0.5)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality selector */}
      <div className="flex flex-col gap-2">
        <span className="font-body text-xs text-[rgba(240,237,230,0.6)]">Qualité du sommeil</span>
        <div className="flex gap-1.5">
          {QUALITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setQuality(opt.value)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${
                quality === opt.value
                  ? 'bg-accent-blue/20 border border-accent-blue/30'
                  : 'bg-bg-elevated border border-border-subtle'
              }`}
              title={opt.label}
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <span className="font-body text-[8px] text-[rgba(240,237,230,0.35)] text-center leading-none">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Warning for short sleep */}
      {hoursSlept < 6 && (
        <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5">
          <span className="text-red-400 text-sm flex-shrink-0">⚠️</span>
          <p className="font-body text-xs text-red-400">
            Moins de 6h — APEX réduira le volume de ta séance en conséquence.
          </p>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-accent-blue font-body font-medium text-white text-sm active:scale-95 transition-transform disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}
