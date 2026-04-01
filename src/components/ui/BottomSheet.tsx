import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  height?: string
  title?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  height = '80vh',
  title,
}: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-bg-surface border-t border-border-default rounded-t-xl overflow-hidden"
            style={{ maxHeight: height }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border-strong" />
            </div>
            {title && (
              <div className="px-5 pb-3 flex items-center justify-between border-b border-border-subtle">
                <span className="font-display text-lg tracking-wide">{title}</span>
                <button
                  onClick={onClose}
                  className="text-[rgba(240,237,230,0.4)] text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            )}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: `calc(${height} - 60px)` }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
