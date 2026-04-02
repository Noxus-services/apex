import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-6 px-6 text-center">
          <span className="text-5xl">⚠️</span>
          <div>
            <h1 className="font-display text-3xl text-[#f0ede6] mb-2">QUELQUE CHOSE S'EST CASSÉ</h1>
            <p className="font-body text-sm text-[rgba(240,237,230,0.5)] leading-relaxed max-w-xs">
              Une erreur inattendue s'est produite. Recharge la page pour continuer.
            </p>
            {this.state.error && (
              <p className="font-mono text-xs text-accent-red/70 mt-3 max-w-xs break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            RECHARGER
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
