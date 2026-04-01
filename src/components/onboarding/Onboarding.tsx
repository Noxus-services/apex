import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '../ui/Button'
import { useUserStore } from '../../store/userStore'
import { db } from '../../db/database'
import { generateJSON, buildFeasibilityPrompt, buildProgramPrompt } from '../../api/claude'
import type { UserProfile, Program, SupplementSchedule } from '../../types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingProps {
  onComplete: () => void
}

type Goal = UserProfile['goal']
type Experience = UserProfile['experience']

// ─── Constants ──────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  'Salle complète',
  'Haltères',
  'Barre + rack',
  'Machines',
  'Poids de corps',
  'Barres de traction',
]

const SUPPLEMENT_OPTIONS = [
  'Créatine',
  'Protéines Whey',
  'Caféine / Pré-workout',
  'Oméga-3',
  'Vitamine D',
  'Magnésium',
  'BCAA',
  'ZMA',
]

const LOADING_MESSAGES = [
  "L'IA analyse ton profil...",
  'Évaluation de la faisabilité...',
  'Construction du programme...',
  'Optimisation de la progression...',
]

const GOAL_OPTIONS: { value: Goal; emoji: string; label: string; sub: string }[] = [
  { value: 'force', emoji: '💪', label: 'FORCE', sub: 'Soulever plus lourd' },
  { value: 'hypertrophie', emoji: '🏋️', label: 'MASSE', sub: 'Prendre du muscle' },
  { value: 'perte_poids', emoji: '🔥', label: 'SÈCHE', sub: 'Perdre du gras, garder le muscle' },
  { value: 'athletisme', emoji: '⚡', label: 'ATHLÉTISME', sub: 'Performance globale' },
]

const EXPERIENCE_OPTIONS: { value: Experience; label: string; sub: string }[] = [
  { value: 'debutant', label: 'Débutant', sub: '1–2 ans' },
  { value: 'intermediaire', label: 'Intermédiaire', sub: '2–4 ans' },
  { value: 'avance', label: 'Avancé', sub: '4+ ans' },
]

// ─── Slide variants ──────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ step, total = 5 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < step ? 'bg-accent-yellow' : 'bg-border-default'
          }`}
        />
      ))}
    </div>
  )
}

function StepInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">
        {label}
      </label>
      <input
        className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
        {...props}
      />
    </div>
  )
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-md font-body text-sm font-medium transition-all duration-100 select-none active:scale-95 border ${
        selected
          ? 'bg-accent-yellow/15 border-accent-yellow text-accent-yellow'
          : 'bg-bg-elevated border-border-default text-[rgba(240,237,230,0.6)]'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Loading Overlay ──────────────────────────────────────────────────────────

function LoadingOverlay({ messageIndex }: { messageIndex: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-bg-base flex flex-col items-center justify-center gap-8 px-8"
    >
      {/* Pulsing APEX */}
      <motion.h1
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="font-display text-7xl text-accent-yellow leading-none"
      >
        APEX
      </motion.h1>

      {/* Spinner dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-accent-yellow"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{
              repeat: Infinity,
              duration: 1,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Cycling message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="font-body text-[rgba(240,237,230,0.6)] text-base text-center"
        >
          {LOADING_MESSAGES[messageIndex % LOADING_MESSAGES.length]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export function Onboarding({ onComplete }: OnboardingProps) {
  const { setProfile } = useUserStore()

  // Navigation
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)

  // Loading state
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)

  // Step 2 — Profile
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  // Step 3 — Goal
  const [goal, setGoal] = useState<Goal | null>(null)
  const [goalDescription, setGoalDescription] = useState('')

  // Step 4 — Setup
  const [experience, setExperience] = useState<Experience | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [supplements, setSupplements] = useState<string[]>([])
  const [trainingTime, setTrainingTime] = useState('18:00')

  // Step 5 — Finalization
  const [injuries, setInjuries] = useState('')
  const [error, setError] = useState<string | null>(null)

  function goNext() {
    setDirection(1)
    setStep(s => s + 1)
  }

  function goBack() {
    setDirection(-1)
    setStep(s => s - 1)
  }

  function toggleEquipment(item: string) {
    setEquipment(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    )
  }

  function toggleSupplement(item: string) {
    setSupplements(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    )
  }

  async function handleGenerate() {
    if (!goal || !experience || !daysPerWeek) return
    setError(null)

    const profile: UserProfile = {
      name: name.trim() || 'Athlète',
      age: Number(age) || 25,
      weight: Number(weight) || 75,
      height: Number(height) || 175,
      experience,
      goal,
      goalDescription: goalDescription.trim(),
      daysPerWeek,
      availableEquipment: equipment,
      supplements,
      trainingTime,
      injuries: injuries.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setIsLoading(true)

    let msgIdx = 0
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length
      setLoadingMsgIdx(msgIdx)
    }, 2000)

    try {
      // Step 1: Feasibility check
      setLoadingMsgIdx(1)
      await generateJSON<{
        feasible: boolean
        message: string
        adjustedGoal: string | null
        timeline: string
      }>(buildFeasibilityPrompt(profile))

      // Step 2: Generate program
      setLoadingMsgIdx(2)
      const rawProgram = await generateJSON<Omit<Program, 'id' | 'generatedAt' | 'weekNumber' | 'isActive'>>(
        buildProgramPrompt(profile, [])
      )

      const program: Program = {
        ...rawProgram,
        generatedAt: new Date(),
        weekNumber: 1,
        isActive: true,
      }

      setLoadingMsgIdx(3)

      await db.programs.add(program)
      await db.userProfile.add(profile)

      if (supplements.length > 0) {
        const defaultTimes: Record<string, string> = {
          Créatine: '08:00',
          'Protéines Whey': '20:00',
          'Caféine / Pré-workout': trainingTime,
          'Oméga-3': '12:00',
          'Vitamine D': '08:00',
          Magnésium: '21:00',
          BCAA: trainingTime,
          ZMA: '22:00',
        }
        const schedules: SupplementSchedule[] = supplements.map(supp => ({
          supplement: supp,
          timeOfDay: defaultTimes[supp] ?? '08:00',
          notes: '',
          enabled: true,
        }))
        await db.supplementSchedules.bulkAdd(schedules)
      }

      setProfile(profile)
      clearInterval(interval)
      setIsLoading(false)
      onComplete()
    } catch (err) {
      clearInterval(interval)
      setIsLoading(false)
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[Onboarding] generate error:', err)
      setError(`Erreur IA : ${msg.slice(0, 120)}`)
    }
  }

  return (
    <div className="h-full bg-bg-base overflow-hidden relative">
      {isLoading && <LoadingOverlay messageIndex={loadingMsgIdx} />}

      <div className="relative h-full overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col px-6 pt-16 pb-10 bg-bg-base"
            >
              {/* Background accent */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,255,71,0.07) 0%, transparent 70%)',
                }}
              />

              <div className="flex-1 flex flex-col justify-center relative z-10">
                {/* Logo */}
                <h1
                  className="font-display text-[96px] text-accent-yellow leading-none mb-2"
                  style={{ letterSpacing: '0.02em' }}
                >
                  APEX
                </h1>
                <p className="font-body text-2xl text-[#f0ede6] font-medium mb-10">
                  Ton coach IA. 0 compromis.
                </p>

                {/* Bullets */}
                <div className="flex flex-col gap-4">
                  {[
                    'Planification 100% automatique',
                    'Progression basée sur la science',
                    'Meilleur qu\'un coach humain payant',
                  ].map(text => (
                    <div key={text} className="flex items-start gap-3">
                      <span className="text-accent-yellow text-lg leading-tight mt-0.5">✓</span>
                      <p className="font-body text-base text-[rgba(240,237,230,0.8)] leading-snug">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="primary" fullWidth size="lg" onClick={goNext}>
                COMMENCER
              </Button>
            </motion.div>
          )}

          {/* ── Step 2: Base Profile ────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col px-6 pt-12 pb-10 overflow-y-auto"
            >
              <ProgressBar step={2} />
              <h2 className="font-display text-4xl text-[#f0ede6] mb-1 leading-none">
                TON PROFIL
              </h2>
              <p className="font-body text-sm text-[rgba(240,237,230,0.4)] mb-8">
                Pour personnaliser ton programme
              </p>

              <div className="flex flex-col gap-4 flex-1">
                <StepInput
                  label="Prénom"
                  type="text"
                  placeholder="Ex : Thomas"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="given-name"
                />
                <StepInput
                  label="Âge"
                  type="number"
                  inputMode="numeric"
                  placeholder="25"
                  min={14}
                  max={99}
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <StepInput
                      label="Poids (kg)"
                      type="number"
                      inputMode="decimal"
                      placeholder="80"
                      step={0.5}
                      min={30}
                      max={300}
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <StepInput
                      label="Taille (cm)"
                      type="number"
                      inputMode="numeric"
                      placeholder="178"
                      step={1}
                      min={100}
                      max={250}
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" size="md" onClick={goBack} className="w-14 flex-shrink-0">
                  ←
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={goNext}
                  disabled={!name.trim() || !age || !weight || !height}
                >
                  SUIVANT
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Goal ────────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col px-6 pt-12 pb-10 overflow-y-auto"
            >
              <ProgressBar step={3} />
              <h2 className="font-display text-4xl text-[#f0ede6] mb-1 leading-none">
                OBJECTIF
              </h2>
              <p className="font-body text-sm text-[rgba(240,237,230,0.4)] mb-6">
                Qu'est-ce qui te motive ?
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {GOAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGoal(opt.value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-all duration-150 select-none active:scale-95 ${
                      goal === opt.value
                        ? 'bg-accent-yellow/10 border-accent-yellow'
                        : 'bg-bg-elevated border-border-default'
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <div>
                      <p
                        className={`font-display text-xl leading-none ${
                          goal === opt.value ? 'text-accent-yellow' : 'text-[#f0ede6]'
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="font-body text-xs text-[rgba(240,237,230,0.5)] mt-0.5 leading-snug">
                        {opt.sub}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">
                  Décris ton objectif
                </label>
                <textarea
                  className="bg-bg-elevated border border-border-default rounded-md p-4 font-body text-sm text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors resize-none flex-1 min-h-[80px]"
                  placeholder="Ex : je veux faire 100kg au bench dans 3 mois"
                  value={goalDescription}
                  onChange={e => setGoalDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" size="md" onClick={goBack} className="w-14 flex-shrink-0">
                  ←
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={goNext}
                  disabled={!goal}
                >
                  SUIVANT
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Setup ───────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col px-6 pt-12 pb-10 overflow-y-auto"
            >
              <ProgressBar step={4} />
              <h2 className="font-display text-4xl text-[#f0ede6] mb-1 leading-none">
                SETUP
              </h2>
              <p className="font-body text-sm text-[rgba(240,237,230,0.4)] mb-6">
                Pour calibrer le programme
              </p>

              {/* Niveau */}
              <div className="mb-5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-2">
                  Niveau
                </p>
                <div className="flex gap-2">
                  {EXPERIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setExperience(opt.value)}
                      className={`flex-1 flex flex-col items-center py-3 px-2 rounded-md border text-center transition-all duration-150 select-none active:scale-95 ${
                        experience === opt.value
                          ? 'bg-accent-yellow/10 border-accent-yellow'
                          : 'bg-bg-elevated border-border-default'
                      }`}
                    >
                      <p
                        className={`font-body text-sm font-medium leading-none ${
                          experience === opt.value ? 'text-accent-yellow' : 'text-[#f0ede6]'
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5">
                        {opt.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Jours/semaine */}
              <div className="mb-5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-2">
                  Jours / semaine
                </p>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysPerWeek(d)}
                      className={`flex-1 h-12 rounded-md font-display text-xl border transition-all duration-150 select-none active:scale-95 ${
                        daysPerWeek === d
                          ? 'bg-accent-yellow text-bg-base border-transparent'
                          : 'bg-bg-elevated border-border-default text-[#f0ede6]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Équipement */}
              <div className="mb-5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-2">
                  Équipement disponible
                </p>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map(item => (
                    <Chip
                      key={item}
                      label={item}
                      selected={equipment.includes(item)}
                      onClick={() => toggleEquipment(item)}
                    />
                  ))}
                </div>
              </div>

              {/* Suppléments */}
              <div className="mb-5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-2">
                  Suppléments utilisés
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUPPLEMENT_OPTIONS.map(item => (
                    <Chip
                      key={item}
                      label={item}
                      selected={supplements.includes(item)}
                      onClick={() => toggleSupplement(item)}
                    />
                  ))}
                </div>
              </div>

              {/* Heure entraînement */}
              <div className="mb-6">
                <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest block mb-2">
                  Heure d'entraînement habituelle
                </label>
                <input
                  type="time"
                  value={trainingTime}
                  onChange={e => setTrainingTime(e.target.value)}
                  className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors w-full"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" size="md" onClick={goBack} className="w-14 flex-shrink-0">
                  ←
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={goNext}
                  disabled={!experience || !daysPerWeek || equipment.length === 0}
                >
                  SUIVANT
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 5: Finalisation ─────────────────────────────────────── */}
          {step === 5 && (
            <motion.div
              key="step5"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col px-6 pt-12 pb-10"
            >
              <ProgressBar step={5} />
              <h2 className="font-display text-4xl text-[#f0ede6] mb-1 leading-none">
                FINALISATION
              </h2>
              <p className="font-body text-sm text-[rgba(240,237,230,0.4)] mb-6">
                Dernière étape avant ton programme
              </p>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">
                  Blessures ou limitations ?
                </label>
                <textarea
                  className="bg-bg-elevated border border-border-default rounded-md p-4 font-body text-sm text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors resize-none flex-1"
                  placeholder="Ex : douleur genou droit, tendinite épaule... ou laisse vide"
                  value={injuries}
                  onChange={e => setInjuries(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="card my-5 flex flex-col gap-1.5">
                <p className="font-body text-xs text-[rgba(240,237,230,0.4)] uppercase tracking-widest mb-1">
                  Résumé
                </p>
                <p className="font-body text-sm text-[#f0ede6]">
                  <span className="text-[rgba(240,237,230,0.5)]">Profil :</span>{' '}
                  {name || 'Athlète'}, {age} ans, {weight} kg
                </p>
                <p className="font-body text-sm text-[#f0ede6]">
                  <span className="text-[rgba(240,237,230,0.5)]">Objectif :</span>{' '}
                  {GOAL_OPTIONS.find(g => g.value === goal)?.label ?? goal}
                </p>
                <p className="font-body text-sm text-[#f0ede6]">
                  <span className="text-[rgba(240,237,230,0.5)]">Programme :</span>{' '}
                  {daysPerWeek}j/sem ·{' '}
                  {EXPERIENCE_OPTIONS.find(e => e.value === experience)?.label}
                </p>
              </div>

              {error && (
                <div className="mb-3 px-4 py-3 rounded-md bg-accent-red/10 border border-accent-red/30 text-accent-red font-body text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" size="md" onClick={goBack} className="w-14 flex-shrink-0">
                  ←
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleGenerate}
                  loading={isLoading}
                >
                  GÉNÉRER MON PROGRAMME →
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
