import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import Chat from './Chat.jsx';
import Profile from './Profile.jsx';
import Directory from './Directory.jsx';
import Join from './Join.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const go = (to) => { window.location.hash = to; window.scrollTo({ top: 0 }); };

// Hash routes: #/ (the assistant, #/?q=... starts with a question), #/directory, #/m/:id, #/b/:id, #/join
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
  const [meta, setMeta] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { api.get('/meta').then(setMeta).catch(() => {}); }, []);
  const notify = (t) => { setToast(t); setTimeout(() => setToast(''), 3500); };
  const [page, id] = parts;
  const onChat = !page || page === 'search';
  const here = (p) => ((p === 'chat' ? onChat : page === p) ? 'page' : undefined);

  async function reset() {
    if (!confirm('Remove every company that joined during the demo?')) return;
    await api.post('/reset'); notify('Demo reset.'); go('/');
  }

  return (
    <Ctx.Provider value={{ meta, notify, refreshMeta: () => api.get('/meta').then(setMeta) }}>
      <header className="header">
        <div className="bar">
          <a className="brand" href="#/" aria-label="Meridian Loop, the assistant">Meridian Loop</a>
          <nav className="nav" aria-label="Main">
            <a href="#/" aria-current={here('chat')}>Assistant</a>
            <a href="#/directory" aria-current={here('directory')}>Directory</a>
            <a href="#/join" aria-current={here('join')}><span className="wide-only">List your company</span><span className="narrow-only">Join</span></a>
          </nav>
        </div>
      </header>
      <main className={onChat ? 'main-chat' : 'main-page'}>
        {onChat && <Chat initial={params.get('q') || ''} />}
        {page === 'm' && <Profile kind="maker" id={id} />}
        {page === 'b' && <Profile kind="brand" id={id} />}
        {page === 'directory' && <Directory tab={params.get('tab') === 'brands' ? 'brands' : 'makers'} />}
        {page === 'join' && <Join side={params.get('side') === 'brand' ? 'brand' : 'maker'} />}
      </main>
      {!onChat && <footer className="footer">
        <div className="wrap">
          <p>Meridian Loop grew out of <a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a> (2019). Built in Hong Kong for the HKSTP Ideation Programme 2026.</p>
          <p>Demo: every company here is fictional.{meta?.demo && <> <button type="button" className="link-btn" onClick={reset}>Reset demo</button></>}</p>
        </div>
      </footer>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}
