import { useState } from 'react'
import { MessageCircle, ChevronRight } from 'lucide-react'
import { useCoachStore } from '../store/coachStore'
import { useCoach } from '../hooks/useCoach'
import { CoachChat } from '../components/coach/CoachChat'
import { WeeklyReviewCard } from '../components/coach/WeeklyReview'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { CoachMessage } from '../types'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function ContextBadge({ context }: { context: CoachMessage['context'] }) {
  const labels: Record<CoachMessage['context'], string> = {
    chat: 'Chat',
    post_workout: 'Post-séance',
    weekly_review: 'Bilan',
    program_gen: 'Programme',
  }
  const colors: Record<CoachMessage['context'], string> = {
    chat: 'text-accent-blue/70 bg-accent-blue/10',
    post_workout: 'text-green-400/70 bg-green-400/10',
    weekly_review: 'text-accent-yellow/70 bg-accent-yellow/10',
    program_gen: 'text-violet-400/70 bg-violet-400/10',
  }
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 rounded ${colors[context]}`}>
      {labels[context]}
    </span>
  )
}

const QUICK_ACTION_CARDS = [
  {
    icon: '🎯',
    title: 'Mon programme actuel',
    description: 'Explications et ajustements',
    message: 'Explique-moi mon programme actuel et si des ajustements sont nécessaires cette semaine.',
  },
  {
    icon: '😴',
    title: 'Analyse ma récupération',
    description: 'Conseils personnalisés',
    message: 'Analyse mon état de récupération actuel et donne-moi des conseils pour optimiser mes performances.',
  },
  {
    icon: '📈',
    title: 'Progression cette semaine',
    description: 'Analyse des chiffres',
    message: 'Analyse ma progression cette semaine et dis-moi ce que je dois ajuster pour continuer à progresser.',
  },
]

export function CoachPage() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { messages, weeklyReview } = useCoachStore()
  const { sendMessage } = useCoach()

  // Last 5 non-streaming messages for display
  const recentMessages = [...messages].reverse().slice(0, 5)

  async function handleQuickAction(msg: string) {
    setIsChatOpen(true)
    // Small delay so the bottom sheet opens first
    setTimeout(() => {
      sendMessage(msg, 'chat')
    }, 400)
  }

  return (
    <div className="page-container">
      <div
        className="px-4 pb-6 flex flex-col gap-5"
        style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 16px)` }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[26px] text-[#f0ede6] leading-none tracking-wide">
              MON COACH IA
            </h1>
            <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-1">
              APEX · Préparateur physique d'élite
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-2xl">
            🤖
          </div>
        </div>

        {/* ── Open Chat Button ────────────────────────────────────────── */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => setIsChatOpen(true)}
          className="gap-3"
        >
          <MessageCircle size={20} />
          OUVRIR LE CHAT
        </Button>

        {/* ── Weekly Review ───────────────────────────────────────────── */}
        {weeklyReview && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
              Bilan de la semaine
            </p>
            <WeeklyReviewCard review={weeklyReview} />
          </div>
        )}

        {/* ── Quick Action Cards ──────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
            Actions rapides
          </p>
          {QUICK_ACTION_CARDS.map(action => (
            <button
              key={action.title}
              onClick={() => handleQuickAction(action.message)}
              className="card w-full text-left flex items-center gap-4 active:scale-[0.98] transition-transform"
            >
              <span className="text-2xl flex-shrink-0">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-[#f0ede6]">{action.title}</p>
                <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-0.5">
                  {action.description}
                </p>
              </div>
              <ChevronRight size={18} className="text-[rgba(240,237,230,0.3)] flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* ── Recent Messages ─────────────────────────────────────────── */}
        {recentMessages.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-[10px] text-[rgba(240,237,230,0.35)] uppercase tracking-widest">
              Échanges récents
            </p>
            {recentMessages.map((msg, idx) => (
              <Card key={msg.id ?? idx} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {msg.role === 'user' ? '🧑' : '🤖'}
                    </span>
                    <span className="font-body text-xs text-[rgba(240,237,230,0.5)]">
                      {msg.role === 'user' ? 'Toi' : 'APEX'}
                    </span>
                    <ContextBadge context={msg.context} />
                  </div>
                  <span className="font-body text-[10px] text-[rgba(240,237,230,0.3)] flex-shrink-0">
                    {formatRelativeTime(msg.timestamp)}
                  </span>
                </div>
                <p className="font-body text-sm text-[rgba(240,237,230,0.75)] leading-relaxed line-clamp-3">
                  {msg.content}
                </p>
                {msg.content.length > 200 && (
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="font-body text-xs text-accent-blue self-start mt-0.5"
                  >
                    Voir plus →
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {recentMessages.length === 0 && !weeklyReview && (
          <Card ai className="flex flex-col items-center gap-3 py-8">
            <span className="text-4xl">🤖</span>
            <div className="text-center">
              <p className="font-body text-sm text-[rgba(240,237,230,0.7)]">
                Ton coach IA est prêt
              </p>
              <p className="font-body text-xs text-[rgba(240,237,230,0.4)] mt-1">
                Commence une conversation pour obtenir des conseils personnalisés sur ton entraînement, ta récupération et ta nutrition.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* ── Coach Chat Bottom Sheet ──────────────────────────────────── */}
      <CoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
