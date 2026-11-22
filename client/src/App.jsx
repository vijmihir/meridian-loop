import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import Search from './Search.jsx';
import Profile from './Profile.jsx';
import Directory from './Directory.jsx';
import Join from './Join.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const go = (to) => { window.location.hash = to; window.scrollTo({ top: 0 }); };

// Hash routes: #/, #/search?side=brand&q=..., #/directory, #/m/:id, #/b/:id, #/join
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
  const here = (p) => (page === p || (!page && p === 'search') || (page === 'search' && p === 'search') ? 'page' : undefined);

  async function reset() {
    if (!confirm('Remove every company that joined during the demo?')) return;
    await api.post('/reset'); notify('Demo reset.'); go('/');
  }

  return (
    <Ctx.Provider value={{ meta, notify, refreshMeta: () => api.get('/meta').then(setMeta) }}>
      <header className="header">
        <div className="wrap">
          <a className="brand" href="#/" aria-label="Meridian Loop home"><span className="brand-mark" aria-hidden="true" />Meridian Loop</a>
          <nav className="nav" aria-label="Main">
            <a href="#/" aria-current={here('search')}>Search</a>
            <a href="#/directory" aria-current={here('directory')}>Directory</a>
            <a href="#/join" aria-current={here('join')}>List your company</a>
          </nav>
        </div>
      </header>
      <main>
        {(!page || page === 'search') && <Search side={params.get('side') === 'maker' ? 'maker' : 'brand'} q={params.get('q') || ''} />}
        {page === 'm' && <Profile kind="maker" id={id} />}
        {page === 'b' && <Profile kind="brand" id={id} />}
        {page === 'directory' && <Directory tab={params.get('tab') === 'brands' ? 'brands' : 'makers'} />}
        {page === 'join' && <Join side={params.get('side') === 'brand' ? 'brand' : 'maker'} />}
      </main>
      <footer className="footer">
        <div className="wrap">
          <p>Meridian Loop grew out of <a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a> (2019). Built in Hong Kong for the HKSTP Ideation Programme 2026.</p>
          <p>Demo: every company here is fictional.{meta?.demo && <> <button type="button" className="link-btn" onClick={reset}>Reset demo</button></>}</p>
        </div>
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}
