import { useState, useEffect } from 'react'
import { db } from '../../db/database'
import { useCoach } from '../../hooks/useCoach'
import type { DailyWellness } from '../../types'

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

// ── Emoji Selectors ───────────────────────────────────────────────────────────

const SLEEP_EMOJIS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😵', label: 'Très mauvais' },
  { value: 2, emoji: '😴', label: 'Mauvais' },
  { value: 3, emoji: '😐', label: 'Correct' },
  { value: 4, emoji: '🙂', label: 'Bon' },
  { value: 5, emoji: '😄', label: 'Excellent' },
]

const STRESS_EMOJIS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😌', label: 'Zen' },
  { value: 2, emoji: '🙂', label: 'Serein' },
  { value: 3, emoji: '😐', label: 'Neutre' },
  { value: 4, emoji: '😤', label: 'Stressé' },
  { value: 5, emoji: '🤯', label: 'Épuisé' },
]

const SORENESS_EMOJIS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '✅', label: 'Aucune' },
  { value: 2, emoji: '💪', label: 'Légère' },
  { value: 3, emoji: '😓', label: 'Modérée' },
  { value: 4, emoji: '🤕', label: 'Forte' },
  { value: 5, emoji: '🚫', label: 'Sévère' },
]

interface EmojiPickerProps {
  options: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[]
  value: 1 | 2 | 3 | 4 | 5
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
}

function EmojiPicker({ options, value, onChange }: EmojiPickerProps) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${
            value === opt.value
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
  )
}

// ── AI Recommendation ─────────────────────────────────────────────────────────

function getAIRecommendation(wellness: DailyWellness): { show: boolean; message: string } {
  const { stressLevel, soreness, motivation } = wellness

  // Bad sleep or high stress → light session
  if (stressLevel >= 4 || soreness >= 4) {
    return {
      show: true,
      message: '⚠️ Séance allégée recommandée — Volume -30%, focus mobilité et technique.',
    }
  }

  if (stressLevel === 3 && soreness === 3) {
    return {
      show: true,
      message: '💡 Séance modérée conseillée — Évite les maximas aujourd\'hui, reste à RPE 7 max.',
    }
  }

  if (motivation <= 2) {
    return {
      show: true,
      message: '🔋 Motivation basse — Commence quand même : les premières séries reveilleront ton énergie.',
    }
  }

  if (soreness <= 1 && stressLevel <= 2 && motivation >= 4) {
    return {
      show: true,
      message: '🔥 Condition optimale — C\'est le moment d\'aller chercher des PRs !',
    }
  }

  return { show: false, message: '' }
}

// ── Summary Display ───────────────────────────────────────────────────────────

function WellnessSummary({ wellness }: { wellness: DailyWellness }) {
  const sleepEmoji = SLEEP_EMOJIS.find(e => e.value === wellness.motivation)?.emoji ?? '😐'
  const stressEmoji = STRESS_EMOJIS.find(e => e.value === wellness.stressLevel)?.emoji ?? '😐'
  const sorenessEmoji = SORENESS_EMOJIS.find(e => e.value === wellness.soreness)?.emoji ?? '💪'

  const stressLabel = STRESS_EMOJIS.find(e => e.value === wellness.stressLevel)?.label ?? 'Neutre'
  const sorenessLabel = SORENESS_EMOJIS.find(e => e.value === wellness.soreness)?.label ?? 'Modérée'

  const rec = getAIRecommendation(wellness)

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-medium text-[rgba(240,237,230,0.7)]">
          Bien-être aujourd'hui
        </p>
        <span className="font-mono text-[9px] text-green-400/70 bg-green-400/10 px-2 py-0.5 rounded">
          Enregistré
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{sleepEmoji}</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.5)]">
            Motivation {wellness.motivation}/5
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{stressEmoji}</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.5)]">
            {stressLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{sorenessEmoji}</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.5)]">
            {sorenessLabel}
          </span>
        </div>
      </div>

      {rec.show && (
        <div className="bg-accent-blue/5 border border-accent-blue/15 rounded-lg px-3 py-2">
          <p className="font-body text-xs text-[rgba(240,237,230,0.75)] leading-relaxed">
            {rec.message}
          </p>
        </div>
      )}
    </div>
  )
}

// ── WellnessCheck (main) ──────────────────────────────────────────────────────

interface WellnessCheckProps {
  onSaved?: (data: { sleep: number; stress: number; soreness: number }) => void
}

export function WellnessCheck({ onSaved }: WellnessCheckProps = {}) {
  const [todayWellness, setTodayWellness] = useState<DailyWellness | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [soreness, setSoreness] = useState<1 | 2 | 3 | 4 | 5>(2)
  const [motivation, setMotivation] = useState<1 | 2 | 3 | 4 | 5>(3)

  const { sendMessage } = useCoach()

  useEffect(() => {
    async function checkToday() {
      setLoading(true)
      const todayStart = getTodayStart()
      const todayEnd = getTodayEnd()
      const existing = await db.dailyWellness
        .where('date')
        .between(todayStart, todayEnd, true, true)
        .first()
      setTodayWellness(existing ?? null)
      setLoading(false)
    }
    checkToday()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const entry: DailyWellness = {
        date: new Date(),
        stressLevel,
        soreness,
        motivation,
        notes: '',
      }
      await db.dailyWellness.add(entry)
      setTodayWellness(entry)

      // Call parent onSaved callback (triggers daily coaching)
      if (onSaved) {
        onSaved({ sleep: motivation, stress: stressLevel, soreness })
      } else if (stressLevel >= 4 || soreness >= 4) {
        // Fallback: notify coach with a plain message if no callback
        const wellnessMsg = [
          'BILAN BIEN-ÊTRE DU JOUR:',
          `Stress: ${stressLevel}/5`,
          `Courbatures: ${soreness}/5`,
          `Motivation: ${motivation}/5`,
          '',
          'En tenant compte de ce bilan, comment dois-je adapter ma séance d\'aujourd\'hui ?',
        ].join('\n')
        sendMessage(wellnessMsg, 'chat')
      }
    } catch (err) {
      console.error('[WellnessCheck] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (todayWellness) {
    return <WellnessSummary wellness={todayWellness} />
  }

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <p className="font-body text-sm font-medium text-[#f0ede6]">
          Comment tu te sens aujourd'hui ?
        </p>
        <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5">
          Aide ton coach à adapter ta séance
        </p>
      </div>

      {/* Motivation / Énergie (using sleep emojis scale) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🔋</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.6)]">Motivation / Énergie</span>
        </div>
        <EmojiPicker
          options={SLEEP_EMOJIS}
          value={motivation}
          onChange={setMotivation}
        />
      </div>

      {/* Stress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">😤</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.6)]">Niveau de stress</span>
        </div>
        <EmojiPicker
          options={STRESS_EMOJIS}
          value={stressLevel}
          onChange={setStressLevel}
        />
      </div>

      {/* Soreness */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">💪</span>
          <span className="font-body text-xs text-[rgba(240,237,230,0.6)]">Courbatures</span>
        </div>
        <EmojiPicker
          options={SORENESS_EMOJIS}
          value={soreness}
          onChange={setSoreness}
        />
      </div>

      {/* Warning preview */}
      {(stressLevel >= 4 || soreness >= 4) && (
        <div className="flex items-start gap-2 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-3 py-2.5">
          <span className="text-accent-yellow text-sm flex-shrink-0">⚠️</span>
          <p className="font-body text-xs text-[rgba(240,237,230,0.7)]">
            Séance allégée recommandée — APEX adaptera tes conseils en conséquence.
          </p>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-accent-yellow font-body font-medium text-bg-base text-sm active:scale-95 transition-transform disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}
