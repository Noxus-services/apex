/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a0a',
          surface: '#111111',
          elevated: '#1a1a1a',
          overlay: '#242424',
        },
        accent: {
          yellow: '#e8ff47',
          orange: '#ff6b35',
          green: '#4ade80',
          red: '#ff4444',
          blue: '#38b8ff',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { sm: '8px', md: '14px', lg: '20px', xl: '28px' },
      animation: {
        'spring-in': 'spring-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'fade-up': 'fade-up 0.3s ease-out',
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
      },
      keyframes: {
        'spring-in': { '0%': { transform: 'scale(0.85)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'fade-up': { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'pulse-ring': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-8px)' }, '75%': { transform: 'translateX(8px)' } },
      },
    },
  },
  plugins: [],
}
