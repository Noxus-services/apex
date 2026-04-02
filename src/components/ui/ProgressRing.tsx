interface ProgressRingProps {
  seconds: number
  totalSeconds: number
  size?: number
}

export function ProgressRing({ seconds, totalSeconds, size = 200 }: ProgressRingProps) {
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 0
  const dashOffset = circumference * (1 - progress)
  const pct = progress * 100
  const color = pct > 50 ? '#4ade80' : pct > 20 ? '#e8ff47' : '#ff4444'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const isLow = seconds <= 5 && seconds > 0

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <div className={`absolute flex flex-col items-center ${isLow ? 'animate-pulse' : ''}`}>
        <span className="font-display text-5xl leading-none text-[#f0ede6]">
          {m}:{s.toString().padStart(2, '0')}
        </span>
        <span className="text-xs text-[rgba(240,237,230,0.7)] uppercase tracking-widest mt-1">
          repos
        </span>
      </div>
    </div>
  )
}
