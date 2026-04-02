import { useState, useEffect } from 'react'
import { Plus, Bell, BellOff, ChevronRight, Trash2, X, Check } from 'lucide-react'
import { db } from '../db/database'
import { useUserStore } from '../store/userStore'
import {
  SUPPLEMENT_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  calculateSupplementTime,
  getSupplementInfo,
  type SupplementCategory,
} from '../utils/supplementScheduler'
import type { SupplementSchedule } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getTakenIds(): number[] {
  try {
    const raw = localStorage.getItem(`apex_taken_${todayKey()}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function markTaken(id: number) {
  const taken = getTakenIds()
  if (!taken.includes(id)) {
    localStorage.setItem(`apex_taken_${todayKey()}`, JSON.stringify([...taken, id]))
  }
}

function markUntaken(id: number) {
  const taken = getTakenIds().filter(t => t !== id)
  localStorage.setItem(`apex_taken_${todayKey()}`, JSON.stringify(taken))
}

function parseMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// ─── NotifPermission ─────────────────────────────────────────────────────────

async function requestNotifPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const res = await Notification.requestPermission()
  return res === 'granted'
}

function scheduleLocalNotifications(schedules: SupplementSchedule[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  schedules.filter(s => s.enabled).forEach(s => {
    const targetMins = parseMinutes(s.timeOfDay)
    const diffMins = targetMins - nowMins
    if (diffMins <= 0 || diffMins > 8 * 60) return // only next 8h

    const info = getSupplementInfo(s.supplement)
    const emoji = info?.emoji ?? '💊'
    setTimeout(() => {
      try {
        new Notification(`${emoji} ${s.supplement}`, {
          body: s.dose ? `${s.dose} — ${info?.timingLabel ?? ''}` : info?.timingLabel ?? '',
          icon: '/icon-192.png',
          tag: `supplement-${s.id}`,
        })
      } catch { /* silent */ }
    }, diffMins * 60 * 1000)
  })
}

// ─── Timeline item ───────────────────────────────────────────────────────────

function TimelineItem({
  schedule,
  isTaken,
  onToggle,
  onTap,
}: {
  schedule: SupplementSchedule
  isTaken: boolean
  onToggle: () => void
  onTap: () => void
}) {
  const info = getSupplementInfo(schedule.supplement)
  const emoji = info?.emoji ?? '💊'

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-white/[0.05] last:border-0 transition-opacity ${isTaken ? 'opacity-40' : ''}`}>
      {/* Time */}
      <div className="w-12 flex-shrink-0 text-right">
        <span className="font-mono text-xs text-[rgba(240,237,230,0.7)]">{schedule.timeOfDay}</span>
      </div>
      {/* Dot line */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isTaken ? 'bg-accent-green' : `bg-white/20`}`} />
      {/* Info — tappable */}
      <button onClick={onTap} className="flex-1 flex items-center gap-2 text-left min-w-0">
        <span className="text-lg">{emoji}</span>
        <div className="min-w-0">
          <p className={`font-body text-sm font-medium leading-tight truncate ${isTaken ? 'line-through text-[rgba(240,237,230,0.7)]' : 'text-[#f0ede6]'}`}>
            {schedule.supplement}
          </p>
          {schedule.dose && (
            <p className="font-mono text-xs text-[rgba(240,237,230,0.55)]">{schedule.dose}</p>
          )}
        </div>
      </button>
      {/* Check button */}
      <button
        onClick={onToggle}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 active:scale-90 transition-all ${
          isTaken
            ? 'bg-accent-green/20 border-accent-green/40 text-accent-green'
            : 'bg-white/[0.04] border-white/10 text-[rgba(240,237,230,0.55)]'
        }`}
      >
        <Check size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function DetailSheet({
  schedule,
  onClose,
  onDelete,
}: {
  schedule: SupplementSchedule
  onClose: () => void
  onDelete: (id: number) => void
}) {
  const info = getSupplementInfo(schedule.supplement)
  const emoji = info?.emoji ?? '💊'
  const cat = schedule.category ?? info?.category ?? 'health'

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-bg-surface border-t border-border-subtle rounded-t-3xl px-5 py-5 flex flex-col gap-4 animate-slide-up"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div className="flex-1">
            <h3 className="font-display text-2xl text-[#f0ede6]">{schedule.supplement}</h3>
            <p className={`font-mono text-xs uppercase tracking-widest ${CATEGORY_COLORS[cat as SupplementCategory]}`}>
              {CATEGORY_LABELS[cat as SupplementCategory]}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl text-accent-yellow">{schedule.dose || info?.defaultDose}</p>
            <p className="font-mono text-xs text-[rgba(240,237,230,0.6)]">{schedule.timeOfDay}</p>
          </div>
        </div>

        {/* Why */}
        {info?.why && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <p className="section-label mb-2">POURQUOI CE MOMENT ?</p>
            <p className="font-body text-sm text-[rgba(240,237,230,0.7)] leading-relaxed">{info.why}</p>
          </div>
        )}

        {/* Benefits */}
        {info?.benefits && info.benefits.length > 0 && (
          <div>
            <p className="section-label mb-2">BÉNÉFICES</p>
            <div className="flex flex-wrap gap-2">
              {info.benefits.map((b, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 font-body text-xs text-accent-yellow">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        {info?.warnings && (
          <div className="flex gap-2 bg-accent-orange/5 border border-accent-orange/20 rounded-xl px-3 py-2.5">
            <span className="text-accent-orange text-sm flex-shrink-0">⚠️</span>
            <p className="font-body text-xs text-[rgba(240,237,230,0.6)] leading-relaxed">{info.warnings}</p>
          </div>
        )}

        {/* Timing label */}
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
          <span className="text-sm">🕐</span>
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)]">{info?.timingLabel ?? schedule.notes}</p>
        </div>

        {/* Delete */}
        <button
          onClick={() => schedule.id !== undefined && onDelete(schedule.id)}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-accent-red/[0.08] border border-accent-red/20 font-body text-sm text-accent-red active:opacity-70 transition-opacity"
        >
          <Trash2 size={15} />
          Retirer du stack
        </button>
      </div>
    </div>
  )
}

// ─── Add supplement modal ─────────────────────────────────────────────────────

function AddModal({
  trainingTime,
  onAdd,
  onClose,
}: {
  trainingTime: string
  onAdd: (s: Omit<SupplementSchedule, 'id'>) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<SupplementCategory | 'all'>('all')

  const cats: Array<{ value: SupplementCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Tous' },
    { value: 'performance', label: 'Perf' },
    { value: 'recovery', label: 'Récup' },
    { value: 'health', label: 'Santé' },
    { value: 'sleep', label: 'Sommeil' },
  ]

  const filtered = SUPPLEMENT_CATALOG.filter(s => {
    if (selectedCat !== 'all' && s.category !== selectedCat) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function addSupplement(info: typeof SUPPLEMENT_CATALOG[0]) {
    const timeOfDay = calculateSupplementTime(info.name, trainingTime, true)
    onAdd({
      supplement: info.name,
      timeOfDay,
      notes: info.timingLabel,
      enabled: true,
      dose: info.defaultDose,
      category: info.category,
      timingAnchor: info.anchor,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col" onClick={onClose}>
      <div
        className="mt-auto bg-bg-surface border-t border-border-subtle rounded-t-3xl flex flex-col animate-slide-up"
        style={{ maxHeight: '85vh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 mb-3 flex-shrink-0">
          <h3 className="font-display text-2xl text-[#f0ede6]">AJOUTER</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[rgba(240,237,230,0.5)]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 mb-3 flex-shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full h-11 bg-bg-elevated border border-border-default rounded-xl px-4 font-body text-sm text-[#f0ede6] placeholder:text-[rgba(240,237,230,0.55)] outline-none focus:border-accent-yellow/40"
            autoFocus
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-5 mb-3 flex-shrink-0 overflow-x-auto pb-1">
          {cats.map(c => (
            <button key={c.value} onClick={() => setSelectedCat(c.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-body text-xs font-medium transition-all ${
                selectedCat === c.value
                  ? 'bg-accent-yellow text-bg-base'
                  : 'bg-white/[0.05] border border-white/[0.08] text-[rgba(240,237,230,0.5)]'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5">
          <div className="flex flex-col gap-2 pb-4">
            {filtered.map(info => (
              <button
                key={info.name}
                onClick={() => addSupplement(info)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left active:scale-[0.98] transition-transform"
              >
                <span className="text-2xl flex-shrink-0">{info.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-[#f0ede6] truncate">{info.name}</p>
                  <p className="font-mono text-xs text-[rgba(240,237,230,0.6)] truncate">{info.defaultDose} · {info.timingLabel}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`font-mono text-[10px] uppercase ${CATEGORY_COLORS[info.category]}`}>
                    {CATEGORY_LABELS[info.category]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SupplementsPage() {
  const { profile } = useUserStore()
  const [schedules, setSchedules] = useState<SupplementSchedule[]>([])
  const [takenIds, setTakenIds] = useState<number[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<SupplementSchedule | null>(null)
  const [notifsEnabled, setNotifsEnabled] = useState(Notification.permission === 'granted')

  const trainingTime = profile?.trainingTime ?? '18:00'

  useEffect(() => {
    db.supplementSchedules.toArray().then(all => {
      const sorted = all.sort((a, b) => {
        const am = parseMinutes(a.timeOfDay)
        const bm = parseMinutes(b.timeOfDay)
        return am - bm
      })
      setSchedules(sorted)
      scheduleLocalNotifications(sorted)
    })
    setTakenIds(getTakenIds())
  }, [])

  async function handleAdd(data: Omit<SupplementSchedule, 'id'>) {
    const id = await db.supplementSchedules.add(data)
    const newSup: SupplementSchedule = { ...data, id: id as number }
    const updated = [...schedules, newSup].sort((a, b) => parseMinutes(a.timeOfDay) - parseMinutes(b.timeOfDay))
    setSchedules(updated)
    scheduleLocalNotifications(updated)
    setShowAdd(false)
  }

  async function handleDelete(id: number) {
    await db.supplementSchedules.delete(id)
    const updated = schedules.filter(s => s.id !== id)
    setSchedules(updated)
    setDetail(null)
  }

  async function handleToggleEnabled(id: number | undefined) {
    if (id === undefined) return
    const s = schedules.find(x => x.id === id)
    if (!s) return
    await db.supplementSchedules.update(id, { enabled: !s.enabled })
    setSchedules(prev => prev.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x))
  }

  function handleToggleTaken(id: number | undefined) {
    if (id === undefined) return
    const taken = getTakenIds()
    if (taken.includes(id)) {
      markUntaken(id)
      setTakenIds(getTakenIds())
    } else {
      markTaken(id)
      setTakenIds(getTakenIds())
    }
  }

  async function handleEnableNotifs() {
    const ok = await requestNotifPermission()
    setNotifsEnabled(ok)
    if (ok) scheduleLocalNotifications(schedules)
  }

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  // Split today's schedule into past/upcoming
  const enabledSchedules = schedules.filter(s => s.enabled)
  const taken = takenIds.length
  const total = enabledSchedules.length

  // Next upcoming supplement
  const nextUp = enabledSchedules
    .filter(s => s.id !== undefined && !takenIds.includes(s.id!))
    .find(s => parseMinutes(s.timeOfDay) >= nowMins - 15)

  return (
    <div className="page-container">
    <div
      className="pb-8"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 mb-5">
        <div>
          <h1 className="font-display text-[28px] text-[#f0ede6] leading-none">Mon Stack</h1>
          <p className="font-body text-sm text-[rgba(240,237,230,0.7)] mt-0.5">
            {total > 0 ? `${taken}/${total} pris aujourd'hui` : 'Aucun supplément configuré'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notif toggle */}
          <button
            onClick={notifsEnabled ? undefined : handleEnableNotifs}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              notifsEnabled
                ? 'bg-accent-yellow/15 border-accent-yellow/30 text-accent-yellow'
                : 'bg-white/[0.04] border-white/[0.08] text-[rgba(240,237,230,0.7)]'
            }`}
            title={notifsEnabled ? 'Notifications actives' : 'Activer les notifications'}
          >
            {notifsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
          {/* Add */}
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-xl bg-accent-yellow flex items-center justify-center text-bg-base active:scale-90 transition-transform"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Next up highlight ── */}
      {nextUp && (
        <div className="mx-4 mb-4">
          <div className="ai-card flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">
              {getSupplementInfo(nextUp.supplement)?.emoji ?? '💊'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="section-label text-accent-yellow/70 mb-0.5">PROCHAIN</p>
              <p className="font-body text-sm font-medium text-[#f0ede6] truncate">{nextUp.supplement}</p>
              <p className="font-mono text-xs text-[rgba(240,237,230,0.7)]">
                {nextUp.dose && `${nextUp.dose} · `}{nextUp.timeOfDay}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              {(() => {
                const diffMins = parseMinutes(nextUp.timeOfDay) - nowMins
                if (diffMins <= 0) return <span className="font-mono text-sm text-accent-yellow font-semibold">Maintenant</span>
                if (diffMins < 60) return <span className="font-mono text-sm text-accent-yellow font-semibold">Dans {diffMins}min</span>
                return <span className="font-mono text-sm text-accent-yellow font-semibold">Dans {Math.round(diffMins/60)}h</span>
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {total > 0 && (
        <div className="mx-4 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="section-label">AUJOURD'HUI</span>
            <span className="font-mono text-xs text-accent-yellow">{taken}/{total}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-yellow rounded-full transition-all duration-500"
              style={{ width: total > 0 ? `${(taken / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {enabledSchedules.length > 0 ? (
        <div className="mx-4 mb-4 card-elevated">
          {enabledSchedules.map(s => (
            <TimelineItem
              key={s.id}
              schedule={s}
              isTaken={s.id !== undefined && takenIds.includes(s.id)}
              onToggle={() => handleToggleTaken(s.id)}
              onTap={() => setDetail(s)}
            />
          ))}
        </div>
      ) : (
        <div className="mx-4 mb-4 card flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">💊</span>
          <p className="font-body text-sm text-[rgba(240,237,230,0.72)] text-center">
            Ajoute tes suppléments pour voir ton planning quotidien
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary px-6 h-11 font-body text-sm">
            + Ajouter un supplément
          </button>
        </div>
      )}

      {/* ── Full stack (disabled + all) ── */}
      {schedules.filter(s => !s.enabled).length > 0 && (
        <div className="mx-4 mb-4">
          <p className="section-label mb-2">INACTIFS</p>
          <div className="flex flex-col gap-2">
            {schedules.filter(s => !s.enabled).map(s => {
              const info = getSupplementInfo(s.supplement)
              return (
                <button key={s.id}
                  onClick={() => setDetail(s)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-left opacity-50 active:opacity-70">
                  <span className="text-xl">{info?.emoji ?? '💊'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-[#f0ede6] truncate">{s.supplement}</p>
                    <p className="font-mono text-xs text-[rgba(240,237,230,0.6)]">{s.dose ?? info?.defaultDose} · {s.timeOfDay}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleToggleEnabled(s.id) }}
                    className="px-3 h-7 rounded-lg bg-white/[0.06] border border-white/[0.09] font-body text-xs text-[rgba(240,237,230,0.5)] flex-shrink-0">
                    Activer
                  </button>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notif info banner ── */}
      {!notifsEnabled && total > 0 && (
        <div className="mx-4 mt-2">
          <button onClick={handleEnableNotifs}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-accent-yellow/5 border border-accent-yellow/20 text-left active:scale-[0.98] transition-transform">
            <Bell size={18} className="text-accent-yellow flex-shrink-0" />
            <div className="flex-1">
              <p className="font-body text-sm text-[#f0ede6]">Activer les rappels</p>
              <p className="font-body text-xs text-[rgba(240,237,230,0.72)]">Reçois une notification au bon moment pour chaque supplément</p>
            </div>
            <ChevronRight size={16} className="text-[rgba(240,237,230,0.55)] flex-shrink-0" />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <AddModal
          trainingTime={trainingTime}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
      {detail && (
        <DetailSheet
          schedule={detail}
          onClose={() => setDetail(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
    </div>
  )
}
