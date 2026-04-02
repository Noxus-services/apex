import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { useUserStore } from '../../store/userStore'
import { db } from '../../db/database'
import { generateJSON, buildProgramPrompt, callInterview } from '../../api/gemini'
import { supabase } from '../../lib/supabase'
import { getUserId } from '../../services/snapshotSync'
import type { UserProfile, Program } from '../../types'

interface OnboardingProps {
  onComplete: () => void
}

type Goal = UserProfile['goal']

// ── Constants ─────────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  'Salle complète', 'Barre + rack', 'Haltères',
  'Machines', 'Poids de corps', 'Barres de traction',
]

const GOAL_OPTIONS: { value: Goal; emoji: string; label: string; sub: string }[] = [
  { value: 'force',        emoji: '💪', label: 'FORCE',  sub: 'Soulever plus lourd' },
  { value: 'hypertrophie', emoji: '🏋️', label: 'MASSE',  sub: 'Prendre du muscle' },
  { value: 'perte_poids',  emoji: '🔥', label: 'SÈCHE',  sub: 'Perdre du gras' },
  { value: 'athletisme',   emoji: '⚡', label: 'PERF',   sub: 'Performance globale' },
]

const LOADING_STEPS = [
  { label: 'Synthèse de l\'entretien…',    sub: 'APEX analyse tes réponses' },
  { label: 'Calcul des volumes…',           sub: 'MEV → MAV → MRV calibrés pour toi' },
  { label: 'Construction du programme…',   sub: 'Périodisation 4 semaines personnalisée' },
  { label: 'Optimisation finale…',          sub: 'Ajustements basés sur ton profil exact' },
]

const INTERVIEW_TOTAL = 5

// ── Animations ────────────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
}
const trans = { type: 'tween' as const, duration: 0.32, ease: [0.32, 0.72, 0, 1] as [number,number,number,number] }

// ── Loading Overlay ───────────────────────────────────────────────────────────

function LoadingOverlay({ stepIdx }: { stepIdx: number }) {
  const step = LOADING_STEPS[Math.min(stepIdx, LOADING_STEPS.length - 1)]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-bg-base flex flex-col items-center justify-center gap-8 px-8"
    >
      <motion.h1
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="font-display text-7xl text-accent-yellow leading-none tracking-wider"
      >
        APEX
      </motion.h1>
      <div className="w-full max-w-xs h-0.5 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-yellow rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-center"
        >
          <p className="font-body text-[#f0ede6] text-base font-medium">{step.label}</p>
          <p className="font-mono text-xs text-[rgba(240,237,230,0.6)] mt-1 uppercase tracking-widest">{step.sub}</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
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

function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i < step ? 'bg-accent-yellow' : 'bg-border-default'}`} />
      ))}
    </div>
  )
}

// ── Interview Chat ────────────────────────────────────────────────────────────

interface ChatMsg { role: 'apex' | 'user'; text: string }

function InterviewStep({
  profile,
  onDone,
}: {
  profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>
  onDone: (qa: ChatMsg[]) => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [answerCount, setAnswerCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch first question on mount
  useEffect(() => {
    let cancelled = false
    async function fetchFirst() {
      setIsTyping(true)
      try {
        const q = await callInterview(profile, [], 1)
        if (!cancelled) {
          setMessages([{ role: 'apex', text: q }])
        }
      } catch {
        if (!cancelled) setError("APEX n'a pas pu démarrer l'entretien. Réessaie.")
      } finally {
        if (!cancelled) setIsTyping(false)
      }
    }
    fetchFirst()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length > 0 && messages[messages.length - 1].role === 'apex') {
      inputRef.current?.focus()
    }
  }, [messages, isTyping])

  async function handleSend() {
    const text = input.trim()
    if (!text || isTyping) return

    const newMessages: ChatMsg[] = [...messages, { role: 'user', text }]
    setMessages(newMessages)
    setInput('')
    const newAnswerCount = answerCount + 1
    setAnswerCount(newAnswerCount)

    if (newAnswerCount >= INTERVIEW_TOTAL) {
      // Done — pass all Q&A to parent
      onDone(newMessages)
      return
    }

    setIsTyping(true)
    setError(null)
    try {
      const nextQ = await callInterview(profile, newMessages, newAnswerCount + 1)
      setMessages(prev => [...prev, { role: 'apex', text: nextQ }])
    } catch {
      setError("Erreur réseau — réessaie.")
    } finally {
      setIsTyping(false)
    }
  }

  const progressPct = Math.round((answerCount / INTERVIEW_TOTAL) * 100)

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-12 pb-4 border-b border-border-subtle">
        <p className="font-mono text-xs text-[rgba(240,237,230,0.6)] uppercase tracking-widest mb-1">
          ENTRETIEN APEX — {answerCount}/{INTERVIEW_TOTAL}
        </p>
        <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-yellow rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-2">
          Réponds librement — APEX adapte ses questions en temps réel
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'apex' && (
                <span className="font-display text-accent-yellow text-xs mr-2 mt-1 flex-shrink-0 leading-tight">
                  AP
                </span>
              )}
              <div
                className={`max-w-[84%] rounded-2xl px-4 py-3 font-body text-sm leading-relaxed ${
                  msg.role === 'apex'
                    ? 'bg-bg-elevated text-[#f0ede6] rounded-tl-sm'
                    : 'bg-accent-yellow text-bg-base font-medium rounded-tr-sm'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <span className="font-display text-accent-yellow text-xs mr-1 leading-tight">AP</span>
              <div className="bg-bg-elevated rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[rgba(240,237,230,0.7)]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-center font-body text-xs text-[rgba(248,113,113,0.8)]">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border-subtle px-4 py-3 safe-bottom">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="Réponds à APEX…"
            disabled={isTyping || answerCount >= INTERVIEW_TOTAL}
            className="flex-1 bg-bg-elevated border border-border-default rounded-xl px-4 py-3 font-body text-sm text-[#f0ede6] placeholder-[rgba(240,237,230,0.5)] outline-none focus:border-accent-yellow/50 transition-colors resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || answerCount >= INTERVIEW_TOTAL}
            className="w-11 h-11 rounded-xl bg-accent-yellow flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:scale-95 transition-all"
          >
            <Send size={16} className="text-bg-base" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Onboarding ───────────────────────────────────────────────────────────

export function Onboarding({ onComplete }: OnboardingProps) {
  const { setProfile } = useUserStore()

  const [step, setStep]         = useState(1)
  const [direction, setDirection] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError]       = useState<string | null>(null)

  // Step 2
  const [name, setName]         = useState('')
  const [weight, setWeight]     = useState('')
  const [goal, setGoal]         = useState<Goal | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [equipment, setEquipment]     = useState<string[]>([])
  const [age, setAge]               = useState('')
  const [height, setHeight]         = useState('')
  const [trainingTime, setTrainingTime] = useState('18:00')
  const [injuries, setInjuries]     = useState('')

  // Interview context (kept for potential future use / memory storage)
  const [, setInterviewQA] = useState<ChatMsg[]>([])

  function goNext() { setDirection(1);  setStep(s => s + 1) }
  function goBack() { setDirection(-1); setStep(s => s - 1) }

  function toggleEquipment(item: string) {
    setEquipment(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item])
  }

  const minimalProfile = {
    name: name.trim() || 'Athlète',
    age: Number(age) || 25,
    weight: Number(weight) || 80,
    height: Number(height) || 175,
    experience: 'intermediaire' as const,
    goal: goal ?? 'hypertrophie' as Goal,
    goalDescription: '',
    daysPerWeek: daysPerWeek ?? 4,
    availableEquipment: equipment.length > 0 ? equipment : ['Salle complète'],
    supplements: [],
    trainingTime: trainingTime || '18:00',
    injuries: injuries.trim(),
  }

  async function handleInterviewDone(qa: ChatMsg[]) {
    setInterviewQA(qa)
    setIsLoading(true)
    setLoadingStep(0)
    setError(null)

    const profile: UserProfile = {
      ...minimalProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    let tick = 0
    const interval = setInterval(() => {
      tick++
      setLoadingStep(Math.min(tick, LOADING_STEPS.length - 1))
    }, 2500)

    try {
      setLoadingStep(1)

      // Build interview context string for the prompt
      const interviewContext = qa
        .map((m, i) => {
          if (m.role === 'apex') return `Q${Math.floor(i / 2) + 1}: ${m.text}`
          return `R: ${m.text}`
        })
        .join('\n')

      // Save interview context locally for future program regenerations
      localStorage.setItem('apex_interview_context', interviewContext)

      const rawProgram = await generateJSON<Omit<Program, 'id' | 'generatedAt' | 'weekNumber' | 'isActive'>>(
        buildProgramPrompt(profile, [], interviewContext)
      )

      setLoadingStep(3)
      const program: Program = { ...rawProgram, generatedAt: new Date(), weekNumber: 1, isActive: true }

      await db.programs.add(program)
      await db.userProfile.add(profile)
      setProfile(profile)

      // Store interview Q&A as APEX memories in Supabase (background, non-blocking)
      const athleteId = getUserId(profile.name)
      const interviewContent = qa
        .map(m => m.role === 'apex' ? `Q: ${m.text}` : `R: ${m.text}`)
        .join('\n')
      supabase.from('memories').insert({
        athlete_id: athleteId,
        content: interviewContent,
        memory_type: 'preference',
        importance: 5,
        source: 'chat',
        metadata: { source_event: 'onboarding_interview', goal: profile.goal },
      }).then(() => {
        // Also store individual answers as separate memories for better RAG
        qa.filter(m => m.role === 'user').forEach((m, i) => {
          const question = qa[i * 2]?.text ?? ''
          supabase.from('memories').insert({
            athlete_id: athleteId,
            content: `${question} → ${m.text}`,
            memory_type: 'preference',
            importance: 4,
            source: 'chat',
            metadata: { question_number: i + 1 },
          })
        })
      })

      clearInterval(interval)
      setIsLoading(false)
      onComplete()
    } catch (err) {
      clearInterval(interval)
      setIsLoading(false)
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(`Erreur IA : ${msg.slice(0, 160)}`)
      // Go back to interview step on error
      setStep(3)
    }
  }

  return (
    <div className="h-full bg-bg-base overflow-hidden relative">
      {isLoading && <LoadingOverlay stepIdx={loadingStep} />}

      <div className="relative h-full overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">

          {/* ── Step 1 : Welcome ───────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}
              className="absolute inset-0 flex flex-col px-6 pt-16 pb-10 bg-bg-base"
            >
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,255,71,0.07) 0%, transparent 70%)' }}
              />
              <div className="flex-1 flex flex-col justify-center relative z-10">
                <h1 className="font-display text-[96px] text-accent-yellow leading-none mb-2" style={{ letterSpacing: '0.02em' }}>
                  APEX
                </h1>
                <p className="font-body text-2xl text-[#f0ede6] font-medium mb-3">
                  Ton IA. Ton coach. 0 compromis.
                </p>
                <p className="font-body text-sm text-[rgba(240,237,230,0.72)] mb-10 leading-relaxed">
                  APEX ne remplit pas un formulaire.<br />
                  Il t'interviewe. Il apprend. Il adapte.
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: '🎙️', text: 'Entretien IA — il pose les vraies questions' },
                    { icon: '📈', text: 'Apprend à te connaître à chaque séance' },
                    { icon: '⚡', text: 'Agit, adapte, anticipe — sans qu\'on lui demande' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <span className="text-lg leading-tight mt-0.5">{icon}</span>
                      <p className="font-body text-base text-[rgba(240,237,230,0.8)] leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="primary" fullWidth size="lg" onClick={goNext}>COMMENCER</Button>
            </motion.div>
          )}

          {/* ── Step 2 : L'essentiel ───────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}
              className="absolute inset-0 flex flex-col px-6 pt-12 pb-10 overflow-y-auto"
            >
              <ProgressBar step={1} />
              <h2 className="font-display text-4xl text-[#f0ede6] mb-1 leading-none">LE MINIMUM</h2>
              <p className="font-body text-sm text-[rgba(240,237,230,0.7)] mb-8">
                Juste ce qu'APEX ne peut pas deviner.
              </p>

              {/* Nom + Poids */}
              <div className="flex gap-3 mb-7">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Prénom</label>
                  <input type="text" placeholder="Thomas" autoComplete="given-name"
                    value={name} onChange={e => setName(e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-28">
                  <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Poids kg</label>
                  <input type="number" inputMode="decimal" placeholder="80" min={30} max={300}
                    value={weight} onChange={e => setWeight(e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                  />
                </div>
              </div>

              {/* Âge + Taille + Heure */}
              <div className="flex gap-3 mb-7">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Âge</label>
                  <input type="number" inputMode="numeric" placeholder="25" min={14} max={80}
                    value={age} onChange={e => setAge(e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Taille cm</label>
                  <input type="number" inputMode="decimal" placeholder="175" min={140} max={230}
                    value={height} onChange={e => setHeight(e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-md h-14 px-4 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-28">
                  <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Séance</label>
                  <input type="time"
                    value={trainingTime} onChange={e => setTrainingTime(e.target.value)}
                    className="bg-bg-elevated border border-border-default rounded-md h-14 px-3 font-body text-base text-[#f0ede6] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                  />
                </div>
              </div>

              {/* Objectif */}
              <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-3">Objectif</p>
              <div className="grid grid-cols-2 gap-3 mb-7">
                {GOAL_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setGoal(opt.value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-all duration-150 select-none active:scale-95 ${
                      goal === opt.value ? 'bg-accent-yellow/10 border-accent-yellow' : 'bg-bg-elevated border-border-default'
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <div>
                      <p className={`font-display text-xl leading-none ${goal === opt.value ? 'text-accent-yellow' : 'text-[#f0ede6]'}`}>{opt.label}</p>
                      <p className="font-body text-xs text-[rgba(240,237,230,0.5)] mt-0.5 leading-snug">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Jours */}
              <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-3">Jours / semaine</p>
              <div className="flex gap-2 mb-7">
                {[2, 3, 4, 5, 6].map(d => (
                  <button key={d} type="button" onClick={() => setDaysPerWeek(d)}
                    className={`flex-1 h-14 rounded-md font-display text-2xl border transition-all duration-150 select-none active:scale-95 ${
                      daysPerWeek === d ? 'bg-accent-yellow text-bg-base border-transparent' : 'bg-bg-elevated border-border-default text-[#f0ede6]'
                    }`}
                  >{d}</button>
                ))}
              </div>

              {/* Équipement */}
              <p className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest mb-3">Équipement</p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(item => (
                  <Chip key={item} label={item} selected={equipment.includes(item)} onClick={() => toggleEquipment(item)} />
                ))}
              </div>

              {/* Blessures / Limitations */}
              <div className="flex flex-col gap-1.5 mt-5 mb-2">
                <label className="font-body text-xs text-[rgba(240,237,230,0.5)] uppercase tracking-widest">Blessures / limitations (optionnel)</label>
                <input type="text" placeholder="Ex: douleur épaule droite, genou fragile..."
                  value={injuries} onChange={e => setInjuries(e.target.value)}
                  className="bg-bg-elevated border border-border-default rounded-md h-12 px-4 font-body text-sm text-[#f0ede6] placeholder:text-[rgba(240,237,230,0.35)] focus:outline-none focus:border-accent-yellow/60 transition-colors"
                />
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" size="md" onClick={goBack} className="w-14 flex-shrink-0">←</Button>
                <Button variant="primary" fullWidth size="lg" onClick={goNext}
                  disabled={!name.trim() || !weight || !goal || !daysPerWeek}
                >
                  SUIVANT — ENTRETIEN APEX
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3 : Interview IA ──────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}
              className="absolute inset-0 flex flex-col"
            >
              <InterviewStep
                profile={minimalProfile}
                onDone={handleInterviewDone}
              />
              {error && (
                <div className="absolute bottom-24 left-4 right-4 px-4 py-3 rounded-md bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] text-[#f87171] font-body text-sm">
                  {error}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
