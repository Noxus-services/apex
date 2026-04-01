import { useRef, useCallback } from 'react'
import { useVibration } from '../../hooks/useVibration'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  label: string
  unit?: string
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  unit,
}: NumberInputProps) {
  const vibration = useVibration()
  const longPressRef = useRef<number | null>(null)
  const longPressActive = useRef(false)

  const adjust = useCallback(
    (delta: number) => {
      vibration.tap()
      onChange(Math.max(min, Math.min(max, Math.round((value + delta) * 100) / 100)))
    },
    [value, onChange, min, max, vibration]
  )

  const startLongPress = (delta: number) => {
    longPressActive.current = false
    longPressRef.current = window.setTimeout(() => {
      longPressActive.current = true
      adjust(delta * 5)
    }, 500)
  }

  const endLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-[rgba(240,237,230,0.4)] font-body">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          className="w-14 h-14 rounded-md bg-bg-elevated border border-border-default text-[#f0ede6] text-2xl flex items-center justify-center active:scale-90 transition-transform select-none"
          onClick={() => adjust(-step)}
          onPointerDown={() => startLongPress(-step)}
          onPointerUp={endLongPress}
          onPointerLeave={endLongPress}
        >
          −
        </button>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={e => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
            }}
            className="w-28 h-16 text-center bg-bg-overlay border border-border-strong rounded-md font-display text-3xl text-[#f0ede6] focus:outline-none focus:border-accent-yellow"
          />
          {unit && (
            <span className="absolute right-3 bottom-3 text-xs text-[rgba(240,237,230,0.35)] font-mono">
              {unit}
            </span>
          )}
        </div>
        <button
          className="w-14 h-14 rounded-md bg-bg-elevated border border-border-default text-[#f0ede6] text-2xl flex items-center justify-center active:scale-90 transition-transform select-none"
          onClick={() => adjust(step)}
          onPointerDown={() => startLongPress(step)}
          onPointerUp={endLongPress}
          onPointerLeave={endLongPress}
        >
          +
        </button>
      </div>
    </div>
  )
}
