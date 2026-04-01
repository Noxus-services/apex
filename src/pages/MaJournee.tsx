import { useState } from 'react'
import { Bell, BellOff, CheckCircle2, Circle, Plus, Zap, ChevronDown } from 'lucide-react'
import { useDailyPlan } from '../hooks/useDailyPlan'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useUserStore } from '../store/userStore'
import type { SupplementEntry } from '../lib/supabase'

// ── Colour-coded score ring ───────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const size = 140
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#e8ff47' : '#f87171'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fill: color, fontFamily: 'Bebas Neue, sans-serif', fontSize: '36px' }}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
        {score >= 80 ? 'PRÊT À L\'ATTAQUE' : score >= 60 ? 'JOURNÉE MODULÉE' : 'RÉCUP PRIORITAIRE'}
      </span>
    </div>
  )
}

// ── Supplement card with checkbox ────────────────────────────────────────────
function SupplementCard({
  entry,
  isTaken,
  onTake,
}: {
  entry: SupplementEntry
  isTaken: boolean
  onTake: () => void
}) {
  return (
    <button
      onClick={onTake}
      disabled={isTaken}
      className={`flex items-start gap-3 w-full text-left rounded-lg p-3 border transition-all ${
        isTaken
          ? 'bg-bg-elevated border-accent-green/20 opacity-60'
          : 'bg-bg-elevated border-border-default active:scale-95'
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isTaken ? (
          <CheckCircle2 size={18} className="text-accent-green" />
        ) : (
          <Circle size={18} className="text-[rgba(240,237,230,0.3)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-body text-sm font-medium ${isTaken ? 'line-through text-[rgba(240,237,230,0.4)]' : 'text-[#f0ede6]'}`}>
            {entry.name} — {entry.dose}
          </span>
          <span className="font-mono text-xs text-accent-yellow flex-shrink-0">{entry.time}</span>
        </div>
        <p className="text-xs text-[rgba(240,237,230,0.45)] mt-0.5 leading-relaxed">{entry.reason}</p>
      </div>
    </button>
  )
}

// ── Protein progress bar ──────────────────────────────────────────────────────
function ProteinBar({
  consumed,
  target,
  onAdd,
}: {
  consumed: number
  target: number
  onAdd: (g: number) => void
}) {
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const pct = Math.min(100, (consumed / target) * 100)
  const color = pct >= 100 ? '#4ade80' : pct >= 70 ? '#e8ff47' : 'rgba(240,237,230,0.3)'

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">PROTÉINES</span>
        <span className="font-display text-lg text-[#f0ede6] leading-none">
          {consumed}<span className="text-xs text-[rgba(240,237,230,0.4)] ml-1">/ {target}g</span>
        </span>
      </div>
      <div className="h-2 bg-bg-overlay rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[20, 30, 40].map(g => (
          <button
            key={g}
            onClick={() => onAdd(g)}
            className="flex items-center gap-1 bg-bg-overlay border border-border-subtle rounded-md px-3 py-1.5 text-xs font-mono text-[#f0ede6] active:scale-95 transition-transform"
          >
            <Plus size={10} />+{g}g
          </button>
        ))}
        <button
          onClick={() => setShowCustom(v => !v)}
          className="flex items-center gap-1 bg-bg-overlay border border-border-subtle rounded-md px-3 py-1.5 text-xs font-mono text-[rgba(240,237,230,0.5)] active:scale-95 transition-transform"
        >
          <ChevronDown size={10} />Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex gap-2">
          <input
            type="number"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder="Ex: 55"
            className="flex-1 bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-sm text-[#f0ede6] outline-none focus:border-accent-yellow"
          />
          <button
            onClick={() => { if (custom) { onAdd(Number(custom)); setCustom(''); setShowCustom(false) } }}
            className="bg-accent-yellow text-bg-base font-body font-medium text-sm rounded-md px-4 active:scale-95 transition-transform"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MaJournee() {
  const { profile } = useUserStore()
  const {
    dayScore,
    proteinTarget,
    proteinToday,
    supplementTimeline,
    supplementLogs,
    dailyInsights,
    programAdjustments,
    isLoading,
    markSupplementTaken,
    logProtein,
  } = useDailyPlan()
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe } = usePushNotifications()

  if (!profile) return null

  const now = new Date()
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 safe-top">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
          {dateLabel}
        </p>
        <h1 className="font-display text-4xl text-[#f0ede6] leading-none mt-1">MA JOURNÉE</h1>
      </div>

      {/* ── Day score ──────────────────────────────────────────────────── */}
      <div className="flex justify-center py-2">
        {isLoading ? (
          <div className="w-[140px] h-[140px] rounded-full bg-bg-elevated animate-pulse" />
        ) : (
          <ScoreRing score={dayScore} />
        )}
      </div>

      {/* ── AI insight ─────────────────────────────────────────────────── */}
      {dailyInsights && (
        <div className="ai-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-accent-blue" />
            <span className="text-xs font-mono uppercase tracking-widest text-accent-blue">ANALYSE APEX</span>
          </div>
          <p className="text-sm text-[rgba(240,237,230,0.8)] leading-relaxed">{dailyInsights}</p>
        </div>
      )}

      {/* ── Programme adjustment banner ────────────────────────────────── */}
      {programAdjustments && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-widest text-accent-yellow mb-1">AJUSTEMENT PROGRAMME</p>
          <p className="text-sm text-[#f0ede6]">{programAdjustments}</p>
        </div>
      )}

      {/* ── Protein progress ────────────────────────────────────────────── */}
      <ProteinBar consumed={proteinToday} target={proteinTarget} onAdd={logProtein} />

      {/* ── Supplement checklist ────────────────────────────────────────── */}
      {supplementTimeline.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
            PROTOCOLE SUPPLÉMENTS
          </p>
          {supplementTimeline.map((entry, i) => {
            const log = supplementLogs.find(s => s.supplement_name === entry.name)
            return (
              <SupplementCard
                key={i}
                entry={entry}
                isTaken={!!log?.taken_at}
                onTake={() => markSupplementTaken(entry.name, entry.time)}
              />
            )
          })}
        </div>
      )}

      {/* ── No plan yet placeholder ─────────────────────────────────────── */}
      {!isLoading && !dailyInsights && supplementTimeline.length === 0 && (
        <div className="card-elevated flex flex-col gap-2 items-center py-8 text-center">
          <span className="text-3xl">⏰</span>
          <p className="font-body text-sm text-[rgba(240,237,230,0.6)]">
            Ton plan journalier est généré chaque matin à 5h par APEX.
          </p>
          <p className="font-body text-xs text-[rgba(240,237,230,0.35)]">
            Active les notifications pour le recevoir dès le réveil.
          </p>
        </div>
      )}

      {/* ── Push notifications CTA ──────────────────────────────────────── */}
      {isSupported && !isSubscribed && (
        <button
          onClick={subscribe}
          disabled={pushLoading}
          className="btn-secondary flex items-center gap-2 w-full justify-center"
        >
          <Bell size={16} />
          {pushLoading ? 'Activation...' : 'Activer les rappels intelligents'}
        </button>
      )}
      {isSubscribed && (
        <div className="flex items-center gap-2 justify-center text-xs text-[rgba(240,237,230,0.35)] font-mono">
          <BellOff size={12} />
          Notifications actives
        </div>
      )}
    </div>
  )
}
