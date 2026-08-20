import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken component can't blank the whole app.
 * The editor keeps its state in localStorage, so reloading recovers the poster.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[posterfy] render error', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="container container--narrow section" role="alert">
        <div className="card stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          <Icon name="alert" size={40} style={{ color: 'var(--danger)' }} />
          <h1 className="section-title">Something went wrong</h1>
          <p className="lead">Reloading usually fixes it. Your saved poster is untouched.</p>
          <pre
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-subtle)',
              maxWidth: '100%',
              overflowX: 'auto',
              textAlign: 'left',
            }}
          >
            {error.message}
          </pre>
          <button type="button" className="btn btn--primary" onClick={this.handleReload}>
            <Icon name="refresh" size={16} />
            Reload
          </button>
        </div>
      </div>
    );
  }
}
