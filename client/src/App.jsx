import { createContext, useContext, useEffect, useState } from 'react';
import { api, track } from './api.js';
import Chat from './Chat.jsx';
import Profile from './Profile.jsx';
import Directory from './Directory.jsx';
import Join from './Join.jsx';
import SignIn from './SignIn.jsx';
import Account from './Account.jsx';
import Quotes from './Quotes.jsx';
import Inbox from './Inbox.jsx';
import Metrics from './Metrics.jsx';
import WhatsApp from './WhatsApp.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const go = (to) => { window.location.hash = to; window.scrollTo({ top: 0 }); };

// Hash routes: #/ (assistant), #/directory, #/m/:id, #/b/:id, #/join, #/signin, #/account, #/quotes[/new|/:id],
// #/inbox, #/metrics, #/whatsapp
function useRoute() {
  const read = () => {
    const [path, qs = ''] = (window.location.hash.slice(1) || '/').split('?');
    return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(qs) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => { const on = () => setRoute(read()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return route;
}

export default function App() {
  const { parts, params } = useRoute();
  // Links from the landing page arrive as app.html?q=... or ?role=maker.
  const search = new URLSearchParams(window.location.search);
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(undefined);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState('');
  const notify = (t) => { setToast(t); setTimeout(() => setToast(''), 3500); };
  const refreshSession = () => api.get('/session').then((r) => setUser(r.user)).catch(() => setUser(null));
  const refreshUnread = () => (user ? api.get('/me').then((r) => setUnread(r.unread)).catch(() => {}) : setUnread(0));
  useEffect(() => { api.get('/meta').then(setMeta).catch(() => {}); refreshSession(); }, []);
  useEffect(() => { refreshUnread(); if (!user) return undefined; const t = setInterval(refreshUnread, 30_000); return () => clearInterval(t); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  const [page, id] = parts;
  const onChat = !page || page === 'search';
  const here = (p) => ((p === 'chat' ? onChat : page === p) ? 'page' : undefined);

  async function reset() {
    if (!confirm('Remove every company, quote and message added during the demo?')) return;
    try { await api.post('/reset'); notify('Demo reset.'); go('/'); refreshUnread(); } catch (e) { notify(e.message); }
  }

  const ctx = { meta, notify, user, setUser, refreshSession, unread, refreshUnread, track, refreshMeta: () => api.get('/meta').then(setMeta) };
  return (
    <Ctx.Provider value={ctx}>
      <header className="header">
        <div className="bar">
          <a className="brand" href="/" aria-label="Meridian Loop home"><span className="mark-dots" aria-hidden="true" />Meridian Loop</a>
          <nav className="nav" aria-label="Main">
            <a href="#/" aria-current={here('chat')}>Assistant</a>
            <a href="#/directory" aria-current={here('directory')}>Directory</a>
            {user && user.role !== 'team' && <a href="#/quotes" aria-current={here('quotes')}>Quotes</a>}
            {user && <a href="#/inbox" aria-current={here('inbox')} className="nav-inbox">Inbox{unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}</a>}
            {user === null && <a href="#/join" aria-current={here('join')} className="wide-only">List your company</a>}
            {user ? <a href="#/account" aria-current={here('account')} className="nav-me">{user.role === 'team' ? 'Team' : user.name.split(' ')[0]}</a>
              : <a href="#/signin" aria-current={here('signin')}>Sign in</a>}
          </nav>
        </div>
      </header>
      <main className={onChat ? 'main-chat' : 'main-page'}>
        {onChat && <Chat initial={params.get('q') || search.get('q') || ''} role={search.get('role') === 'maker' ? 'maker' : 'brand'} />}
        {page === 'm' && <Profile kind="maker" id={id} />}
        {page === 'b' && <Profile kind="brand" id={id} />}
        {page === 'directory' && <Directory tab={params.get('tab') === 'brands' ? 'brands' : 'makers'} />}
        {page === 'join' && <Join side={params.get('side') === 'brand' ? 'brand' : 'maker'} />}
        {page === 'signin' && <SignIn next={params.get('next')} />}
        {page === 'account' && <Account />}
        {page === 'quotes' && <Quotes id={id} params={params} />}
        {page === 'inbox' && <Inbox />}
        {page === 'metrics' && <Metrics />}
        {page === 'whatsapp' && <WhatsApp params={params} />}
      </main>
      {!onChat && <footer className="footer">
        <div className="wrap">
          <p>Meridian Loop grew out of <a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a> (2019). Built in Hong Kong for the HKSTP Ideation Programme 2026.</p>
          <p className="footer-links"><a href="#/metrics">Pilot metrics</a> <a href="#/whatsapp">WhatsApp channel</a> Demo data: every company here is fictional.{meta?.demo && <> <button type="button" className="link-btn" onClick={reset}>Reset demo</button></>}</p>
        </div>
      </footer>}
      {!online && <div className="offline" role="status">You’re offline. Answers will come back when your connection does.</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}
