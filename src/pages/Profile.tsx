import { useState, useEffect, useRef } from 'react'
import { Pencil, Check, X, AlertTriangle, Download, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useUserStore } from '../store/userStore'
import { useCoachStore } from '../store/coachStore'
import { db } from '../db/database'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { SupplementSchedule, Program } from '../types'

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
      <span className="font-body text-xs text-[rgba(240,237,230,0.45)] w-28 flex-shrink-0">{label}</span>
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
            className="flex-1 bg-bg-elevated border border-accent-blue/40 rounded-lg px-3 py-1.5 font-body text-sm text-[#f0ede6] outline-none"
          />
          {unit && <span className="font-body text-xs text-[rgba(240,237,230,0.4)]">{unit}</span>}
          <button onClick={handleSave} className="text-green-400 p-1">
            <Check size={16} />
          </button>
          <button onClick={handleCancel} className="text-[rgba(240,237,230,0.4)] p-1">
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
            className="text-[rgba(240,237,230,0.3)] hover:text-[rgba(240,237,230,0.6)] transition-colors p-1"
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
  const { clearMessages } = useCoachStore()

  const [supplements, setSupplements] = useState<SupplementSchedule[]>([])
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)

  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('apex_api_key') ?? ''
  })
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  const [regenerating, setRegenerating] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      const sups = await db.supplementSchedules.toArray()
      setSupplements(sups)
      const prog = await db.programs.filter(p => p.isActive === true).first()
      setActiveProgram(prog ?? null)
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

  // ── API Key ──────────────────────────────────────────────────────────────────

  function handleSaveApiKey() {
    if (apiKey.trim()) {
      localStorage.setItem('apex_api_key', apiKey.trim())
    } else {
      localStorage.removeItem('apex_api_key')
    }
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2500)
  }

  function maskedKey(key: string): string {
    if (!key || key.length < 8) return key
    return `sk-...${key.slice(-4)}`
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
    await db.workoutSessions.clear()
    await db.coachMessages.clear()
    await db.programs.clear()
    await db.weeklyReviews.clear()
    await db.supplementSchedules.clear()
    clearMessages()
    setSupplements([])
    setActiveProgram(null)
    setShowResetConfirm(false)
    window.location.reload()
  }

  // ── Regenerate program ───────────────────────────────────────────────────────

  async function handleRegenerateProgram() {
    if (!profile) return
    setRegenerating(true)
    try {
      const { generateJSON, buildProgramPrompt } = await import('../api/claude')
      const sessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray()
      const prompt = buildProgramPrompt(profile, sessions)
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
          <div className="w-16 h-16 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <span className="font-display text-xl text-accent-blue">{initials}</span>
          </div>
          <div>
            <p className="font-display text-lg text-[#f0ede6]">{profile.name}</p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.45)] mt-0.5">
              {EXPERIENCE_LABELS[profile.experience]} · {GOAL_LABELS[profile.goal]}
            </p>
            <p className="font-body text-xs text-[rgba(240,237,230,0.35)]">
              {profile.daysPerWeek} j/semaine · {profile.age} ans
            </p>
          </div>
        </div>

        {/* ── Basic Info (editable) ────────────────────────────────────── */}
        <Card className="flex flex-col">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest mb-2">
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
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
            Suppléments
          </p>
          {supplements.length === 0 ? (
            <Card>
              <p className="font-body text-sm text-[rgba(240,237,230,0.45)] text-center py-3">
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
                      <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5 truncate">{sup.notes}</p>
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
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
            Programme
          </p>
          <Card className="flex flex-col gap-3">
            {activeProgram ? (
              <>
                <div>
                  <p className="font-body text-sm font-medium text-[#f0ede6]">{activeProgram.name}</p>
                  <p className="font-body text-xs text-[rgba(240,237,230,0.45)] mt-0.5">
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

        {/* ── API Key ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
            Clé API Claude
          </p>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-bg-elevated border border-border-default rounded-lg px-3 pr-10 py-2.5 font-mono text-sm text-[#f0ede6] placeholder:text-[rgba(240,237,230,0.25)] outline-none focus:border-accent-blue/40 transition-colors"
                />
                <button
                  onClick={() => setApiKeyVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(240,237,230,0.3)]"
                >
                  {apiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <Button
                variant={apiKeySaved ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleSaveApiKey}
                className="flex-shrink-0"
              >
                {apiKeySaved ? <Check size={16} /> : 'Sauver'}
              </Button>
            </div>
            {apiKey && !apiKeyVisible && (
              <p className="font-mono text-xs text-[rgba(240,237,230,0.4)]">
                {maskedKey(apiKey)}
              </p>
            )}
            <div className="flex items-center gap-2 bg-bg-elevated rounded-lg px-3 py-2">
              <span className="text-sm">🔒</span>
              <p className="font-body text-xs text-[rgba(240,237,230,0.4)]">
                Clé stockée localement uniquement · Jamais envoyée à nos serveurs
              </p>
            </div>
          </Card>
        </div>

        {/* ── Data ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
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
