import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
  ai?: boolean
}

export function Card({ elevated, ai, className = '', children, ...props }: CardProps) {
  if (ai) {
    return (
      <div className={`ai-card ${className}`} {...props}>
        {children}
      </div>
    )
  }
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} ${className}`} {...props}>
      {children}
    </div>
  )
}
