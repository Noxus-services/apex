import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, fullWidth, children, className = '', disabled, ...props }, ref) => {

    const base = 'flex items-center justify-center gap-2 font-body font-semibold select-none cursor-pointer transition-all duration-75 active:scale-[0.96] disabled:opacity-35 disabled:pointer-events-none'

    const variants = {
      primary:   'bg-accent-yellow text-bg-base rounded-[14px] tracking-tight',
      secondary: 'bg-white/[0.05] border border-white/10 text-[#f0ede6] rounded-[14px]',
      danger:    'bg-accent-red/8 border border-accent-red/20 text-accent-red rounded-[14px]',
      ghost:     'text-[rgba(240,237,230,0.72)] rounded-[14px]',
    }

    const sizes = {
      sm: 'h-10 px-4 text-sm',
      md: 'h-[52px] px-5 text-[15px]',
      lg: 'h-14 px-6 text-[15px]',
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading
          ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : children
        }
      </button>
    )
  }
)
Button.displayName = 'Button'
