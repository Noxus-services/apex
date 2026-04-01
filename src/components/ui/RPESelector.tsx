interface RPESelectorProps {
  value: number | null
  onChange: (rpe: number) => void
}

export function RPESelector({ value, onChange }: RPESelectorProps) {
  const rpeLabels: Record<number, string> = {
    6: 'Facile',
    7: 'Modéré',
    8: 'Difficile',
    9: 'Très dur',
    10: 'Max',
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-[rgba(240,237,230,0.4)]">RPE</span>
      <div className="flex gap-2">
        {[6, 7, 8, 9, 10].map(rpe => (
          <button
            key={rpe}
            onClick={() => onChange(rpe)}
            className={`flex-1 h-10 rounded-md text-sm font-mono font-semibold transition-all duration-100 active:scale-90 ${
              value === rpe
                ? 'bg-accent-yellow text-bg-base'
                : 'bg-bg-elevated border border-border-default text-[rgba(240,237,230,0.5)]'
            }`}
          >
            {rpe}
          </button>
        ))}
      </div>
      {value != null && (
        <span className="text-xs text-[rgba(240,237,230,0.4)] text-center">
          {rpeLabels[value] ?? ''}
        </span>
      )}
    </div>
  )
}
