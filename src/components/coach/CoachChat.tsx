import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { X, Send } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { useCoach } from '../../hooks/useCoach'
import { useCoachStore } from '../../store/coachStore'
import type { CoachMessage } from '../../types'

interface CoachChatProps {
  isOpen: boolean
  onClose: () => void
}

const QUICK_SUGGESTIONS = [
  { label: '📊 Analyser ma progression', message: 'Analyse ma progression récente et dis-moi comment continuer à progresser.' },
  { label: '😴 Conseils récupération', message: 'Quels sont tes conseils pour optimiser ma récupération entre les séances ?' },
  { label: '💊 Mes suppléments', message: 'Explique-moi les meilleurs moments pour prendre mes suppléments et leur utilité.' },
  { label: '🔄 Adapter la séance', message: 'Comment adapter ma prochaine séance selon mes performances récentes ?' },
  { label: '🤕 J\'ai une douleur', message: 'J\'ai une douleur musculaire/articulaire. Comment dois-je adapter mon entraînement ?' },
  { label: '😴 J\'ai mal dormi', message: 'J\'ai mal dormi cette nuit. Est-ce que je devrais quand même m\'entraîner et comment adapter la séance ?' },
]

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className={`px-4 py-3 max-w-[80%] ${
          isUser
            ? 'bg-bg-elevated rounded-xl rounded-tr-sm border border-border-default'
            : 'bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl rounded-tl-sm max-w-[85%]'
        }`}
      >
        <p className="font-body text-sm text-[#f0ede6] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
      <span className="font-body text-[10px] text-[rgba(240,237,230,0.55)] px-1">
        {formatTime(message.timestamp)}
      </span>
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="px-4 py-3 bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl rounded-tl-sm max-w-[85%]">
        <p className="font-body text-sm text-[#f0ede6] leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="inline-block w-[2px] h-4 bg-accent-yellow ml-0.5 animate-pulse align-middle">▌</span>
        </p>
      </div>
      <span className="font-body text-[10px] text-[rgba(240,237,230,0.55)] px-1">
        Maintenant
      </span>
    </div>
  )
}

export function CoachChat({ isOpen, onClose }: CoachChatProps) {
  const { sendMessage } = useCoach()
  const { messages, isStreaming, isSearching, streamingContent } = useCoachStore()
  const [inputText, setInputText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Filter to chat-context messages only (exclude post_workout analysis, weekly_review, etc.)
  const chatMessages = messages.filter(m => m.context === 'chat' || m.context === undefined)

  // Determine if we should show suggestions
  const lastMessage = chatMessages[chatMessages.length - 1]
  const showSuggestions =
    !isStreaming &&
    (chatMessages.length === 0 || lastMessage?.role === 'assistant')

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isStreaming])

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  async function handleSend(text?: string) {
    const msg = (text ?? inputText).trim()
    if (!msg || isStreaming) return
    setSendError(null)
    setInputText('')
    try {
      await sendMessage(msg, 'chat')
    } catch {
      setInputText(msg)
      setSendError('Erreur de connexion. Réessaye.')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSuggestion(suggestion: { label: string; message: string }) {
    handleSend(suggestion.message)
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="92vh">
      <div className="flex flex-col h-full" style={{ height: 'calc(92vh - 24px)' }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pb-3 pt-1 border-b border-border-subtle flex-shrink-0">
          <div>
            <h2 className="font-display text-xl text-[#f0ede6] tracking-wide">
              APEX IA
            </h2>
            <p className="font-body text-xs text-[rgba(240,237,230,0.7)] mt-0.5">
              Coach musculation &amp; récupération d'élite
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[rgba(240,237,230,0.7)] hover:text-[#f0ede6] transition-colors p-1 -mr-1 mt-0.5"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        {/* ── Messages ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {chatMessages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center text-3xl">
                🤖
              </div>
              <p className="font-body text-sm text-[rgba(240,237,230,0.5)] text-center max-w-xs leading-relaxed">
                Salut ! Je suis APEX, ton coach IA. Pose-moi une question sur ton entraînement, ta récupération ou tes suppléments.
              </p>
            </div>
          )}

          {chatMessages.map((msg, idx) => (
            <MessageBubble key={msg.id ?? idx} message={msg} />
          ))}

          {/* Google Search indicator */}
          {isSearching && (
            <div className="flex items-center gap-2 px-2 py-1">
              <span
                className="w-2 h-2 rounded-full bg-accent-yellow"
                style={{ animation: 'pulse 1s ease-in-out infinite' }}
              />
              <span className="text-xs text-[rgba(240,237,230,0.72)] italic font-body">
                APEX vérifie les dernières données...
              </span>
            </div>
          )}

          {isStreaming && streamingContent && (
            <StreamingBubble content={streamingContent} />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-start gap-2">
              <div className="px-4 py-3 bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl rounded-tl-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 rounded-full bg-accent-yellow/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-accent-yellow/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-accent-yellow/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Quick suggestions */}
          {showSuggestions && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="font-body text-[10px] text-[rgba(240,237,230,0.55)] uppercase tracking-widest">
                Suggestions rapides
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestion(s)}
                    className="font-body text-xs text-[rgba(240,237,230,0.7)] bg-bg-elevated border border-border-default rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Row ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border-subtle bg-bg-surface">
          {sendError && (
            <div className="flex items-center justify-between px-3 py-2 bg-accent-red/10 border border-accent-red/20 rounded-xl mb-2">
              <span className="font-body text-xs text-accent-red">{sendError}</span>
              <button
                onClick={() => { setSendError(null); handleSend(inputText) }}
                className="font-mono text-xs text-accent-red/70 underline ml-2"
              >
                Réessayer
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Parle à ton coach..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-bg-elevated border border-border-default rounded-xl px-4 py-3 font-body text-sm text-[#f0ede6] placeholder:text-[rgba(240,237,230,0.55)] resize-none outline-none focus:border-accent-yellow/50 transition-colors disabled:opacity-50"
              style={{ minHeight: '46px', maxHeight: '120px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !inputText.trim()}
              className="w-12 h-12 rounded-xl bg-accent-yellow flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Envoyer"
            >
              <Send size={18} className="text-bg-base" />
            </button>
          </div>
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.45)] text-center mt-2">
            Entrée pour envoyer · Maj+Entrée pour sauter une ligne
          </p>
        </div>
      </div>
    </BottomSheet>
  )
}
