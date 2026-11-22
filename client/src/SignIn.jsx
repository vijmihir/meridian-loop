import { useEffect, useState } from 'react';
import { api } from './api.js';
import { go, useApp } from './App.jsx';

// Demo sign-in: choose any dummy company and act as it. A launch replaces this with an emailed link.
export default function SignIn({ next }) {
  const { setUser, notify, refreshUnread, user } = useApp();
  const [accounts, setAccounts] = useState(null);
  const [tab, setTab] = useState('brand');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.get('/demo-accounts').then(setAccounts).catch((e) => setError(e.message)); }, []);

  async function choose(id) {
    setBusy(id); setError('');
    try {
      const r = await api.post('/session', { id });
      setUser(r.user); refreshUnread(); notify(`Signed in as ${r.user.name}.`);
      go(next || (r.user.role === 'team' ? '/metrics' : '/quotes'));
    } catch (e) { setError(e.message); }
    setBusy('');
  }
  async function signOut() { await api.del('/session').catch(() => {}); setUser(null); notify('Signed out.'); }

  const rows = accounts ? (tab === 'brand' ? accounts.brands : accounts.makers) : [];
  const shown = rows.filter((x) => !q.trim() || `${x.name} ${x.city} ${x.sells || x.makes}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="wrap narrow-page">
      <div className="page-head">
        <div>
          <h1>Sign in to the demo</h1>
          <p>Act as any company in the dummy data to send quote requests, reply to them and edit a profile. No password is needed.</p>
        </div>
      </div>
      {user && <p className="notice-ok">Signed in as <b>{user.name}</b>. <button type="button" className="link-btn" onClick={signOut}>Sign out</button></p>}
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="dir-tools">
        <div className="toggle" role="group" aria-label="Account type">
          <button type="button" aria-pressed={tab === 'brand'} onClick={() => setTab('brand')}>Brands</button>
          <button type="button" aria-pressed={tab === 'maker'} onClick={() => setTab('maker')}>Manufacturers</button>
        </div>
        <label className="dir-search"><span className="visually-hidden">Filter companies</span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, city or product" /></label>
      </div>
      {!accounts ? <div className="skeleton" /> : (
        <ul className="pick-list">
          {shown.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => choose(x.id)} disabled={Boolean(busy)}>
                <span><b>{x.name}</b><span className="where">{x.city}, {x.sells || x.makes}</span></span>
                <span className="pick-go">{busy === x.id ? 'Signing in' : 'Sign in'}</span>
              </button>
            </li>
          ))}
          {accounts && (
            <li><button type="button" onClick={() => choose('team')} disabled={Boolean(busy)}>
              <span><b>Meridian Loop team</b><span className="where">Checks certificates, sees metrics and the email outbox</span></span>
              <span className="pick-go">{busy === 'team' ? 'Signing in' : 'Sign in'}</span>
            </button></li>
          )}
        </ul>
      )}
    </div>
  );
}
