import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="auth-page">
        <div className="modal" style={{ maxWidth: 520 }}>
          <h3>Something broke on this screen</h3>
          <p className="muted">{this.state.error.message}</p>
          <button className="btn" onClick={() => { this.setState({ error: null }); window.location.href = '/home' }}>Back to Home</button>
        </div>
      </div>
    )
  }
}
