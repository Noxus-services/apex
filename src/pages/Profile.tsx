import { useState, useEffect, useRef } from 'react'
import { Pencil, Check, X, AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { useUserStore } from '../store/userStore'
import { useCoachStore } from '../store/coachStore'
import { useCoach } from '../hooks/useCoach'
import { db } from '../db/database'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { SupplementSchedule, Program, WeeklyReview } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXPERIENCE_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
}

const GOAL_LABELS: Record<string, string> = {
  force: 'Force',
  hypertrophie: 'Hypertrophie',
  perte_poids: 'Perte de poids',
  athletisme: 'Athlétisme',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

// ── Inline Edit Field ─────────────────────────────────────────────────────────

interface InlineEditProps {
  label: string
  value: string | number
  unit?: string
  type?: 'text' | 'number' | 'time'
  onSave: (value: string) => void
}

function InlineEdit({ label, value, unit, type = 'text', onSave }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function handleSave() {
    onSave(draft)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(String(value))
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0">
      <span className="font-body text-xs text-[rgba(240,237,230,0.72)] w-28 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            className="flex-1 bg-bg-elevated border border-accent-yellow/30 rounded-lg px-3 py-1.5 font-body text-sm text-[#f0ede6] outline-none"
          />
          {unit && <span className="font-body text-xs text-[rgba(240,237,230,0.7)]">{unit}</span>}
          <button onClick={handleSave} className="text-green-400 p-1">
            <Check size={16} />
          </button>
          <button onClick={handleCancel} className="text-[rgba(240,237,230,0.7)] p-1">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="font-body text-sm text-[#f0ede6]">
            {value}{unit ? ` ${unit}` : ''}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-[rgba(240,237,230,0.55)] hover:text-[rgba(240,237,230,0.6)] transition-colors p-1"
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Profile Page ──────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { profile, updateProfile } = useUserStore()

  const [supplements, setSupplements] = useState<SupplementSchedule[]>([])
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([])
  const [showReviews, setShowReviews] = useState(false)

  const { checkWeeklyReview } = useCoach()
  const [regenerating, setRegenerating] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [generatingReview, setGeneratingReview] = useState(false)

  async function handleGenerateWeeklyReview() {
    setGeneratingReview(true)
    try {
      await checkWeeklyReview(true)
    } finally {
      setGeneratingReview(false)
    }
  }

  useEffect(() => {
    async function load() {
      const sups = await db.supplementSchedules.toArray()
      setSupplements(sups)
      const prog = await db.programs.filter(p => p.isActive === true).first()
      setActiveProgram(prog ?? null)
      const reviews = await db.weeklyReviews.orderBy('generatedAt').reverse().limit(10).toArray()
      setWeeklyReviews(reviews)
    }
    load()
  }, [])

  if (!profile) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-4">
        <span className="text-4xl">👤</span>
        <p className="font-body text-[rgba(240,237,230,0.5)]">Profil non disponible</p>
      </div>
    )
  }

  const initials = getInitials(profile.name)

  // ── Supplement helpers ───────────────────────────────────────────────────────

  async function toggleSupplement(id: number | undefined, enabled: boolean) {
    if (id === undefined) return
    await db.supplementSchedules.update(id, { enabled })
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
  }

  async function updateSupplementTime(id: number | undefined, time: string) {
    if (id === undefined) return
    await db.supplementSchedules.update(id, { timeOfDay: time })
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, timeOfDay: time } : s))
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    const sessions = await db.workoutSessions.toArray()
    const messages = await db.coachMessages.toArray()
    const programs = await db.programs.toArray()
    const sups = await db.supplementSchedules.toArray()

    const data = {
      exportedAt: new Date().toISOString(),
      profile,
      sessions,
      messages,
      programs,
      supplements: sups,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apex-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  async function handleReset() {
    if (!confirm('Supprimer toutes les données ? Cette action est irréversible.')) return
    try {
      await Promise.all([
        db.workoutSessions.clear(),
        db.coachMessages.clear(),
        db.programs.clear(),
        db.weeklyReviews.clear(),
        db.userProfile.clear(),
        db.dailyWellness.clear(),
        db.sleepLogs.clear(),
        db.supplementSchedules.clear(),
      ])
      // Clear localStorage too
      localStorage.clear()
      // Clear Zustand coach store
      useCoachStore.getState().clearMessages()
      window.location.reload()
    } catch (err) {
      console.error('[Profile] reset error:', err)
      alert('Erreur lors de la suppression. Réessaye.')
    }
  }

  // ── Regenerate program ───────────────────────────────────────────────────────

  async function handleRegenerateProgram() {
    if (!profile) return
    setRegenerating(true)
    try {
      const { generateJSON, buildProgramPrompt } = await import('../api/gemini')
      const sessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray()
      // Retrieve interview context if available (saved during onboarding)
      const interviewContext = localStorage.getItem('apex_interview_context') ?? undefined
      const prompt = buildProgramPrompt(profile, sessions, interviewContext)
      const generated = await generateJSON<{
        name: string
        aiRationale: string
        feasibilityAnalysis: string
        weeks: unknown[]
      }>(prompt)

      // Deactivate existing programs
      await db.programs.toCollection().modify({ isActive: false })

      const newProgram = {
        ...generated,
        generatedAt: new Date(),
        weekNumber: 1,
        isActive: true,
      }
      await db.programs.add(newProgram as Parameters<typeof db.programs.add>[0])
      const prog = await db.programs.filter(p => p.isActive === true).first()
      setActiveProgram(prog ?? null)
    } catch (err) {
      console.error('[Profile] regenerate program error:', err)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="page-container">
      <div
        className="px-4 pb-8 flex flex-col gap-5"
        style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 16px)` }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <h1 className="font-display text-[26px] text-[#f0ede6] leading-none tracking-wide">
          MON PROFIL
        </h1>

        {/* ── Avatar + Name ───────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center">
            <span className="font-display text-xl text-accent-yellow">{initials}</span>
          </div>
          <div>
            <p className="font-display text-lg text-[#f0ede6]">{profile.name}</p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.72)] mt-0.5">
              {EXPERIENCE_LABELS[profile.experience]} · {GOAL_LABELS[profile.goal]}
            </p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.6)]">
              {profile.daysPerWeek} j/semaine · {profile.age} ans
            </p>
          </div>
        </div>

        {/* ── Basic Info (editable) ────────────────────────────────────── */}
        <Card className="flex flex-col">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest mb-2">
            Informations
          </p>
          <InlineEdit
            label="Poids"
            value={profile.weight}
            unit="kg"
            type="number"
            onSave={v => updateProfile({ weight: parseFloat(v) || profile.weight })}
          />
          <InlineEdit
            label="Heure séance"
            value={profile.trainingTime}
            type="time"
            onSave={v => updateProfile({ trainingTime: v })}
          />
          <InlineEdit
            label="Jours / sem."
            value={profile.daysPerWeek}
            type="number"
            onSave={v => updateProfile({ daysPerWeek: parseInt(v) || profile.daysPerWeek })}
          />
          <InlineEdit
            label="Blessures"
            value={profile.injuries || 'Aucune'}
            onSave={v => updateProfile({ injuries: v })}
          />
        </Card>

        {/* ── Supplements ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Suppléments
          </p>
          {supplements.length === 0 ? (
            <Card>
              <p className="font-body text-sm text-[rgba(240,237,230,0.72)] text-center py-3">
                Aucun supplément configuré
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {supplements.map(sup => (
                <Card key={sup.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[#f0ede6] truncate">{sup.supplement}</p>
                    {sup.notes && (
                      <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-0.5 truncate">{sup.notes}</p>
                    )}
                  </div>

                  {/* Time input */}
                  <input
                    type="time"
                    value={sup.timeOfDay}
                    onChange={e => updateSupplementTime(sup.id, e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 font-body text-sm text-[#f0ede6] outline-none w-[90px] text-center"
                  />

                  {/* Toggle */}
                  <button
                    onClick={() => toggleSupplement(sup.id, !sup.enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      sup.enabled ? 'bg-accent-yellow' : 'bg-bg-elevated border border-border-default'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                        sup.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Program ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Programme
          </p>
          <Card className="flex flex-col gap-3">
            {activeProgram ? (
              <>
                <div>
                  <p className="font-body text-sm font-medium text-[#f0ede6]">{activeProgram.name}</p>
                  <p className="font-body text-xs text-[rgba(240,237,230,0.72)] mt-0.5">
                    Semaine {activeProgram.weekNumber} · Généré le{' '}
                    {new Date(activeProgram.generatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  loading={regenerating}
                  onClick={handleRegenerateProgram}
                  className="gap-2"
                >
                  <RefreshCw size={15} />
                  Régénérer le programme
                </Button>
              </>
            ) : (
              <>
                <p className="font-body text-sm text-[rgba(240,237,230,0.5)]">Aucun programme actif</p>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  loading={regenerating}
                  onClick={handleRegenerateProgram}
                  className="gap-2"
                >
                  <RefreshCw size={15} />
                  Générer un programme
                </Button>
              </>
            )}
          </Card>
        </div>

        {/* Weekly review */}
        <div className="card flex flex-col gap-3">
          <div>
            <p className="font-body text-sm font-semibold text-[#f0ede6]">Revue hebdomadaire</p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.6)] mt-0.5">
              APEX analyse ta semaine et ajuste tes recommandations
            </p>
          </div>
          <button
            onClick={handleGenerateWeeklyReview}
            disabled={generatingReview}
            className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generatingReview ? (
              <>
                <div className="w-4 h-4 border-2 border-accent-yellow/30 border-t-accent-yellow rounded-full animate-spin" />
                Génération...
              </>
            ) : (
              'Générer la revue →'
            )}
          </button>
        </div>

        {/* ── Past weekly reviews ─────────────────────────────────────── */}
        {weeklyReviews.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowReviews(v => !v)}
              className="flex items-center justify-between"
            >
              <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
                Revues passées ({weeklyReviews.length})
              </p>
              <span className="text-xs text-accent-yellow/70">{showReviews ? '▲' : '▼'}</span>
            </button>
            {showReviews && (
              <div className="flex flex-col gap-2">
                {weeklyReviews.map((review, i) => (
                  <div key={i} className="card flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="font-body text-xs text-[rgba(240,237,230,0.7)]">
                        Semaine du {new Date(review.weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      <span className="font-mono text-xs text-accent-yellow">{review.progressScore}/10</span>
                    </div>
                    <p className="font-body text-xs text-[rgba(240,237,230,0.5)]">
                      {review.sessionsCount} séances · {Math.round(review.totalVolume / 1000)}t volume
                    </p>
                    {review.analysis && (
                      <p className="font-body text-xs text-[rgba(240,237,230,0.7)] leading-relaxed line-clamp-3">
                        {review.analysis.slice(0, 200)}{review.analysis.length > 200 ? '…' : ''}
                      </p>
                    )}
                    {review.keyInsights.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {review.keyInsights.slice(0, 2).map((insight, j) => (
                          <p key={j} className="font-body text-xs text-accent-yellow/80">• {insight}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Data ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Données
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              size="sm"
              onClick={handleExport}
              className="gap-2"
            >
              <Download size={16} />
              Exporter mes données (JSON)
            </Button>

            {!showResetConfirm ? (
              <Button
                variant="danger"
                fullWidth
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="gap-2"
              >
                <AlertTriangle size={16} />
                Réinitialiser l'app
              </Button>
            ) : (
              <Card className="flex flex-col gap-3 border border-accent-red/30 bg-accent-red/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-accent-red flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-[rgba(240,237,230,0.8)]">
                    Toutes tes séances, ton programme et l'historique seront supprimés. Cette action est irréversible.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={handleReset}
                  >
                    Confirmer
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
