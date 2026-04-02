import { AnimatePresence, motion } from 'framer-motion'
import { ProgressRing } from '../ui/ProgressRing'
import type { useTimer } from '../../hooks/useTimer'

interface RestTimerProps {
  timer: ReturnType<typeof useTimer>
}

export function RestTimer({ timer }: RestTimerProps) {
  const { seconds, totalSeconds, isRunning, stop, addTime } = timer

  return (
    <AnimatePresence>
      {isRunning && seconds !== null && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.92 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="fixed bottom-28 left-4 right-4 z-30 flex justify-center pointer-events-none"
        >
          <div className="bg-bg-elevated border border-border-default rounded-xl shadow-2xl px-6 py-5 flex flex-col items-center gap-3 pointer-events-auto w-full max-w-sm">
            {/* Label */}
            <span className="text-xs font-mono uppercase tracking-widest text-[rgba(240,237,230,0.7)]">
              REPOS
            </span>

            {/* Ring + time */}
            <ProgressRing seconds={seconds} totalSeconds={totalSeconds} size={100} />

            {/* Controls */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => addTime(30)}
                className="flex-1 h-11 rounded-md bg-bg-overlay border border-border-default text-[#f0ede6] text-sm font-mono font-semibold active:scale-95 transition-transform"
              >
                +30s
              </button>
              <button
                onClick={stop}
                className="flex-1 h-11 rounded-md bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-sm font-mono font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1"
              >
                PASSER →
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
