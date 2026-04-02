import type { WeeklyReview } from '../../types'

interface WeeklyReviewProps {
  review: WeeklyReview
}

function ScoreColor(score: number): string {
  if (score >= 7) return 'text-green-400'
  if (score >= 4) return 'text-yellow-400'
  return 'text-red-400'
}

function ScoreBg(score: number): string {
  if (score >= 7) return 'border-green-400/30 bg-green-400/5'
  if (score >= 4) return 'border-yellow-400/30 bg-yellow-400/5'
  return 'border-red-400/30 bg-red-400/5'
}

function ScoreLabel(score: number): string {
  if (score >= 8) return 'Excellente semaine'
  if (score >= 6) return 'Bonne progression'
  if (score >= 4) return 'Semaine correcte'
  return 'Semaine difficile'
}

export function WeeklyReviewCard({ review }: WeeklyReviewProps) {
  const weekStart = new Date(review.weekStart)
  const weekEnd = new Date(review.weekEnd)

  const dateRange = `${weekStart.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })} – ${weekEnd.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })}`

  const analysisLines = review.analysis
    .split('\n')
    .filter(line => line.trim().length > 0)

  return (
    <div className="card flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest mb-0.5">
            Bilan de la semaine
          </p>
          <p className="font-body text-sm text-[rgba(240,237,230,0.55)]">{dateRange}</p>
        </div>
        {/* Score badge */}
        <div
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${ScoreBg(review.progressScore)}`}
        >
          <span
            className={`font-display text-3xl leading-none ${ScoreColor(review.progressScore)}`}
          >
            {review.progressScore}
          </span>
          <span className="font-body text-[9px] text-[rgba(240,237,230,0.7)] mt-0.5">/10</span>
        </div>
      </div>

      {/* Score label */}
      <p className={`font-body text-sm font-medium ${ScoreColor(review.progressScore)}`}>
        {ScoreLabel(review.progressScore)}
      </p>

      {/* Stats row */}
      <div className="flex gap-3">
        <div className="flex-1 bg-bg-elevated rounded-lg px-3 py-2 flex flex-col items-center">
          <span className="font-display text-xl text-[#f0ede6]">{review.sessionsCount}</span>
          <span className="font-body text-[10px] text-[rgba(240,237,230,0.7)]">séances</span>
        </div>
        <div className="flex-1 bg-bg-elevated rounded-lg px-3 py-2 flex flex-col items-center">
          <span className="font-display text-xl text-[#f0ede6]">
            {review.totalVolume >= 1000
              ? `${(review.totalVolume / 1000).toFixed(1)}t`
              : `${Math.round(review.totalVolume)}kg`}
          </span>
          <span className="font-body text-[10px] text-[rgba(240,237,230,0.7)]">volume</span>
        </div>
      </div>

      {/* Analysis text */}
      {analysisLines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Analyse
          </p>
          {analysisLines.map((line, i) => {
            // Render markdown-style bold headings
            const isHeading = line.startsWith('## ')
            const isBullet = line.startsWith('- ') || line.startsWith('• ')
            const text = line.replace(/^##\s+/, '').replace(/^\-\s+/, '').replace(/^•\s+/, '')

            if (isHeading) {
              return (
                <p key={i} className="font-body text-xs font-semibold text-[rgba(240,237,230,0.7)] mt-2">
                  {text}
                </p>
              )
            }
            if (isBullet) {
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-accent-yellow mt-0.5 text-xs flex-shrink-0">•</span>
                  <p className="font-body text-sm text-[rgba(240,237,230,0.75)] leading-relaxed">{text}</p>
                </div>
              )
            }
            return (
              <p key={i} className="font-body text-sm text-[rgba(240,237,230,0.75)] leading-relaxed">
                {text}
              </p>
            )
          })}
        </div>
      )}

      {/* Key insights */}
      {review.keyInsights && review.keyInsights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Points clés
          </p>
          {review.keyInsights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-bg-elevated rounded-lg px-3 py-2"
            >
              <span className="text-accent-yellow text-sm flex-shrink-0 mt-0.5">✦</span>
              <p className="font-body text-sm text-[rgba(240,237,230,0.75)] leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Next week adjustments */}
      {review.nextWeekAdjustments && (
        <div className="flex flex-col gap-2">
          <p className="font-body text-[10px] text-[rgba(240,237,230,0.6)] uppercase tracking-widest">
            Semaine prochaine
          </p>
          <div className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-3 py-3">
            <p className="font-body text-sm text-[rgba(240,237,230,0.8)] leading-relaxed whitespace-pre-wrap">
              {review.nextWeekAdjustments}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
