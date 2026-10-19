import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last line of defence: if something blows up while rendering — a readable screen instead of a blank page */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ghost-bureau]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bsod" role="alert">
        <div className="bsod-inner">
          <p className="bsod-title">&nbsp;GHOSTS&nbsp;</p>
          <p>
            A fatal exception 0E has occurred at 0028:C0011E36. The bureau was unable to draw the screen.
          </p>
          <p className="bsod-msg">* {this.state.error.message}</p>
          <p>* Press "Try again" to redraw the screen.</p>
          <p>* Press "Restart" to open the bureau again with demo data. Unsaved changes will be lost.</p>
          <div className="row-actions">
            <button className="bsod-btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button
              className="bsod-btn"
              onClick={() => location.reload()}
            >
              Restart
            </button>
          </div>
        </div>
      </div>
    );
  }
}
