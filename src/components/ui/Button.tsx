import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading,
      fullWidth,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'flex items-center justify-center gap-2 rounded-md font-body font-medium transition-all duration-100 select-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none'

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'bg-accent-yellow text-bg-base',
      secondary: 'bg-bg-elevated border border-border-default text-[#f0ede6]',
      danger: 'bg-accent-red/10 border border-accent-red/30 text-accent-red',
      ghost: 'text-[rgba(240,237,230,0.5)] hover:text-[#f0ede6]',
    }

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-10 px-4 text-sm',
      md: 'h-14 px-6 text-base',
      lg: 'h-16 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <span className="animate-spin text-sm">⟳</span> : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
