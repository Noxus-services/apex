import { useState } from 'react'
import { db } from '../../db/database'
import { motion } from 'framer-motion'
import type { WorkoutSession, PR } from '../../types'
import { useCoach } from '../../hooks/useCoach'
import { computeAdaptations, type AdaptationNote } from '../../services/apexBrain'

interface SessionSummaryProps {
  session: WorkoutSession & { prs: PR[] }
  onDone: () => void
}

const MOOD_EMOJI = ['', '😴', '😕', '😐', '😊', '🔥']
const ENERGY_EMOJI = ['', '🪫', '😮‍💨', '⚡', '💪', '🚀']

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 bg-bg-elevated rounded-lg py-4 px-2">
      <span className="font-display text-2xl text-[#f0ede6] leading-none">{value}</span>
      {sub && <span className="font-mono text-xs text-[rgba(240,237,230,0.7)]">{sub}</span>}
      <span className="text-xs uppercase tracking-widest text-[rgba(240,237,230,0.6)] font-body mt-1">
        {label}
      </span>
    </div>
  )
}

function getRecoveryAdvice(session: WorkoutSession & { prs: PR[] }): { stretch: string; nutrition: string; sleep: string } {
  const setsCompleted = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.completed && !s.isWarmup).length, 0
  )
  const hasPRs = session.prs && session.prs.length > 0
  const isHeavy = session.totalVolume > 8000 || setsCompleted > 20 || hasPRs

  if (isHeavy) {
    return {
      stretch: 'Étirements statiques 10–15 min sur les groupes travaillés. Priorité aux hanches et épaules.',
      nutrition: 'Protéines dans les 30 min (40g+). Glucides rapides maintenant, complexes au repas.',
      sleep: 'Vise 8–9h. Le pic de synthèse protéique arrive la nuit — dors tôt.',
    }
  }
  return {
    stretch: 'Mobilité légère 5–10 min ou foam roller. Évite les étirements intenses si courbatures.',
    nutrition: 'Protéines dans l\'heure (30g+). Réhydrate bien.',
    sleep: 'Vise 7–8h. La récupération musculaire se fait principalement en sommeil profond.',
  }
}

export function SessionSummary({ session, onDone }: SessionSummaryProps) {
  const [notes, setNotes] = useState(session.notes ?? '')
  const { isStreaming, streamingContent, messages } = useCoach()
  const recovery = getRecoveryAdvice(session)

  // Compute what APEX is adjusting for next session
  const adaptations: AdaptationNote[] = session.exercises.length > 0
    ? computeAdaptations(session, {
        exercises: session.exercises.map(ex => ({
          name: ex.name,
          repsMax: (() => {
            const workSets = ex.sets.filter(s => s.completed && !s.isWarmup)
            return workSets.length > 0 ? Math.max(...workSets.map(s => s.reps)) : 8
          })(),
        }))
      })
    : []

  const totalVolume = Math.round(session.totalVolume)
  const duration = session.duration ?? 0
  const setsCompleted = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.completed && !s.isWarmup).length,
    0
  )

  // Find last assistant post_workout message for AI feedback
  const aiMsg = [...messages]
    .reverse()
    .find(m => m.role === 'assistant' && m.context === 'post_workout')

  const hasPRs = session.prs && session.prs.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="h-full bg-bg-base flex flex-col"
    >
      {/* Header */}
      <div className="bg-bg-surface border-b border-border-subtle px-5 pt-6 pb-5">
        <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mb-1">
          SÉANCE TERMINÉE
        </p>
        <h1 className="font-display text-4xl text-[#f0ede6] leading-none">{session.dayName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 flex flex-col gap-5">

        {/* PR Banner */}
        {hasPRs && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏆</span>
              <span className="font-display text-2xl text-accent-yellow tracking-wide">
                NOUVEAU PR !
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {session.prs.map((pr, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-bg-elevated rounded-lg px-3 py-2"
                >
                  <span className="font-body text-sm text-[#f0ede6]">{pr.exerciseName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[rgba(240,237,230,0.7)] line-through">
                      {pr.previousValue.toFixed(1)} kg
                    </span>
                    <span className="font-mono text-sm text-accent-green font-semibold">
                      {pr.value.toFixed(1)} kg
                    </span>
                    <span className="text-xs text-accent-green">
                      +{(((pr.value - pr.previousValue) / pr.previousValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stats row */}
        <div className="flex gap-3">
          <StatCard label="Volume" value={`${totalVolume}`} sub="kg" />
          <StatCard label="Durée" value={`${duration}`} sub="min" />
          <StatCard label="Séries" value={setsCompleted} />
        </div>

        {/* Mood & Energy display */}
        <div className="card-elevated flex gap-4">
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-2xl">{MOOD_EMOJI[session.mood] ?? '😐'}</span>
            <span className="text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest">Humeur</span>
          </div>
          <div className="w-px bg-border-subtle" />
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-2xl">{ENERGY_EMOJI[session.energy] ?? '⚡'}</span>
            <span className="text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest">Énergie</span>
          </div>
        </div>

        {/* Exercise summary */}
        <div className="card">
          <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mb-3">
            EXERCICES
          </p>
          <div className="flex flex-col gap-2">
            {session.exercises.map((ex, i) => {
              const workSets = ex.sets.filter(s => s.completed && !s.isWarmup)
              if (workSets.length === 0) return null
              const maxWeight = Math.max(...workSets.map(s => s.weight))
              const totalReps = workSets.reduce((acc, s) => acc + s.reps, 0)
              return (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-body text-sm text-[rgba(240,237,230,0.8)]">{ex.name}</span>
                  <span className="font-mono text-xs text-[rgba(240,237,230,0.7)]">
                    {workSets.length}×{Math.round(totalReps / workSets.length)} @ {maxWeight}kg
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* APEX Adaptations */}
        {adaptations.length > 0 && (
          <div className="card">
            <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mb-3">
              APEX ADAPTE LA PROCHAINE FOIS
            </p>
            <div className="flex flex-col gap-2">
              {adaptations.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[rgba(240,237,230,0.85)] truncate">{a.exerciseName}</p>
                    <p className="font-body text-xs text-[rgba(240,237,230,0.5)]">{a.reason}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {a.action === 'increase' && (
                      <>
                        <span className="font-mono text-xs text-[rgba(240,237,230,0.4)] line-through">{a.oldWeight}kg</span>
                        <span className="font-mono text-sm font-bold text-accent-yellow">↑ {a.newWeight}kg</span>
                      </>
                    )}
                    {a.action === 'maintain' && (
                      <span className="font-mono text-sm text-[rgba(240,237,230,0.6)]">= {a.oldWeight}kg</span>
                    )}
                    {a.action === 'decrease' && (
                      <span className="font-mono text-sm text-accent-orange">↓ {a.newWeight}kg</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recovery Card */}
        <div className="card">
          <p className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)] mb-3">
            RÉCUPÉRATION
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">🧘</span>
              <div>
                <p className="font-body text-xs font-semibold text-[rgba(240,237,230,0.85)] mb-0.5">Étirements</p>
                <p className="font-body text-xs text-[rgba(240,237,230,0.6)] leading-relaxed">{recovery.stretch}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">🥩</span>
              <div>
                <p className="font-body text-xs font-semibold text-[rgba(240,237,230,0.85)] mb-0.5">Nutrition</p>
                <p className="font-body text-xs text-[rgba(240,237,230,0.6)] leading-relaxed">{recovery.nutrition}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">😴</span>
              <div>
                <p className="font-body text-xs font-semibold text-[rgba(240,237,230,0.85)] mb-0.5">Sommeil</p>
                <p className="font-body text-xs text-[rgba(240,237,230,0.6)] leading-relaxed">{recovery.sleep}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="ai-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <span className="text-xs font-mono uppercase tracking-widest text-accent-yellow">
              ANALYSE IA
            </span>
          </div>
          {aiMsg ? (
            <p className="text-sm text-[rgba(240,237,230,0.8)] leading-relaxed whitespace-pre-wrap">
              {aiMsg.content}
            </p>
          ) : isStreaming && streamingContent ? (
            <p className="text-sm text-[rgba(240,237,230,0.8)] leading-relaxed whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-accent-yellow/70 ml-0.5 animate-pulse" />
            </p>
          ) : isStreaming ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent-yellow/30 border-t-accent-yellow rounded-full animate-spin flex-shrink-0" />
              <span className="text-sm text-[rgba(240,237,230,0.5)]">Analyse en cours…</span>
            </div>
          ) : (
            <p className="text-sm text-[rgba(240,237,230,0.5)] italic">
              L'analyse apparaît ici juste après ta séance.
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)]">
            NOTES
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Comment s'est passée la séance ?"
            className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-3 text-sm text-[#f0ede6] placeholder-[rgba(240,237,230,0.5)] focus:outline-none focus:border-accent-yellow resize-none"
          />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="flex-shrink-0 bg-bg-base border-t border-border-subtle px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button onClick={async () => {
          if (session.id != null && notes !== (session.notes ?? '')) {
            await db.workoutSessions.update(session.id, { notes })
          }
          onDone()
        }} className="btn-primary w-full">
          TERMINER
        </button>
      </div>
    </motion.div>
  )
}
