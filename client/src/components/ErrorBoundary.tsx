import React from 'react'

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center p-8">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            onClick={() => this.setState({ hasError: false })}
          >
            Erneut versuchen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
