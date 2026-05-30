import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level React error boundary.
 *
 * Without this, any uncaught render-time error blanks the entire app to a
 * white screen and operators have nothing to inspect short of the browser
 * devtools. The boundary catches the throw, logs it for diagnosis, and
 * renders a small fallback so the user has a recovery path (page reload).
 *
 * Class component required: error boundaries depend on
 * `componentDidCatch` / `getDerivedStateFromError`, neither of which has a
 * hook equivalent.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaces in browser devtools / production error tracker.

    console.error('ErrorBoundary caught', { error, componentStack: info.componentStack })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          role="alert"
          className="m-8 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl mx-auto"
        >
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm mb-3">
            The UI hit an unexpected error and could not continue. Reload to recover; if the problem
            repeats, please report it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
