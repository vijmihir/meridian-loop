import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// A photo that fails to load fades out and leaves its frame's paper colour, never a broken-image icon.
document.addEventListener('error', (e) => { if (e.target instanceof HTMLImageElement) e.target.classList.add('img-failed'); }, true);

// If any screen throws, show a way back instead of a blank page.
class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('Screen failed:', err); }
  render() {
    if (!this.state.failed) return this.props.children;
    const reset = () => { try { sessionStorage.clear(); } catch { /* ignore */ } window.location.hash = '/'; window.location.reload(); };
    return (
      <div className="crash" role="alert">
        <h1>Something broke on this page.</h1>
        <p>Your saved conversation may be the cause. Start fresh and it will be cleared.</p>
        <button type="button" className="btn" onClick={reset}>Start fresh</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>);
