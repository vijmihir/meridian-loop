import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { AppCtx, useHashRoute, go } from './ui.jsx';
import Landing from './Landing.jsx';
import BrandApp, { ManufacturerDrawer, CompareModal } from './Brand.jsx';
import ManufacturerApp from './Manufacturer.jsx';
import Shop from './Shop.jsx';
import HowItWorks from './HowItWorks.jsx';
import Outbox from './Outbox.jsx';
import { SignIn, SignUp, AccountMenu, askToSignIn } from './Account.jsx';

const stored = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const persist = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export default function App() {
  const route = useHashRoute();
  const [, section = '', sub, id] = route.split('/');
  const [meta, setMeta] = useState(null);
  const [brands, setBrands] = useState([]);
  const [makers, setMakers] = useState([]);
  const [me, setMe] = useState(undefined); // undefined while loading, null when signed out
  const [demoAccounts, setDemoAccounts] = useState([]);
  // The team account can act for any company; everyone else acts for their own.
  const [teamBrand, setTeamBrand] = useState(() => stored('brandId', 'b-meadow-thread'));
  const [teamMaker, setTeamMaker] = useState(() => stored('makerId', 'm-tirupur-organics'));
  const isTeam = me?.role === 'admin';
  const brandId = me?.role === 'brand' ? me.entityId : isTeam ? teamBrand : null;
  const makerId = me?.role === 'manufacturer' ? me.entityId : isTeam ? teamMaker : null;
  const [weights, setWeightsState] = useState(() => stored('weights', null));
  const [shortlist, setShortlist] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [compare, setCompare] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const loadLists = () => { api.get('/brands').then(setBrands); api.get('/manufacturers').then(setMakers); };
  useEffect(() => {
    api.get('/meta').then((m) => { setMeta(m); setWeightsState((w) => w || m.defaultWeights); });
    api.get('/auth/me').then((r) => { setMe(r.user); setDemoAccounts(r.demoAccounts); }).catch(() => setMe(null));
    loadLists();
  }, []);
  useEffect(() => {
    if (brandId) api.get(`/shortlist?brandId=${brandId}`).then(setShortlist).catch(() => setShortlist([]));
    else setShortlist([]);
  }, [brandId]);

  // Close overlays when the page changes or Escape is pressed.
  useEffect(() => { setDrawer(null); setCompare(null); }, [route]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setDrawer(null); setCompare(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ctx = useMemo(() => ({
    meta, brands, makers, brandId, makerId, weights: weights || meta?.defaultWeights, shortlist, setShortlist,
    me, demoAccounts, isTeam,
    canBrand: Boolean(brandId), canMaker: Boolean(makerId),
    signedIn: (user) => { setMe(user); loadLists(); },
    signOut: async () => { await api.post('/auth/logout'); setMe(null); go('/'); },
    setBrandId: (v) => { setTeamBrand(v); persist('brandId', v); },
    setMakerId: (v) => { setTeamMaker(v); persist('makerId', v); },
    setWeights: (v) => { setWeightsState(v); persist('weights', v); },
    openManufacturer: setDrawer,
    setCompare,
    toggleShortlist: async (mid) => {
      if (!brandId) return askToSignIn();
      setShortlist(shortlist.some((s) => s.manufacturerId === mid) ? await api.del(`/shortlist/${mid}?brandId=${brandId}`) : await api.post('/shortlist', { manufacturerId: mid, brandId }));
    },
    toast: (t) => { setToastMsg(t); setTimeout(() => setToastMsg(null), 3600); },
  }), [meta, brands, makers, brandId, makerId, weights, shortlist, me, demoAccounts, isTeam]);

  async function reset() {
    if (!confirm('Reset the demo? This clears shortlists, quotes, uploaded documents, posted requests and any accounts created at sign-up.')) return;
    await api.post('/reset');
    try { sessionStorage.clear(); } catch { /* storage unavailable */ }
    window.location.hash = '/';
    window.location.reload();
  }

  const ready = meta && ctx.weights && brands.length && makers.length && me !== undefined;
  const here = (s) => (section === s ? 'page' : undefined);
  return (
    <AppCtx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <div className="nav-pill">
          <a className="wordmark" href="#/" aria-label="Meridian Loop home"><span className="wordmark-mark" aria-hidden="true" />Meridian Loop</a>
          <nav className="nav-links" aria-label="Main">
            <a href="#/brand/assistant" aria-current={here('brand')}>For brands</a>
            <a href="#/maker/dashboard" aria-current={here('maker')}>For manufacturers</a>
            <a href="#/shop" aria-current={here('shop')}>Shop</a>
            <a href="#/how" aria-current={here('how')}>How it works</a>
            {(brandId || makerId) && <a href="#/emails" aria-current={here('emails')}>Email alerts</a>}
          </nav>
          <span className="nav-spacer" />
          {meta && <span className="engine" title={meta.llm ? `Answers written by ${meta.model}` : 'Answers composed by the built-in engine. Add an API key to use Claude.'}>{meta.llm ? 'Answers by Claude' : 'Built-in AI engine'}</span>}
          <AccountMenu />
          {!me && <a className="btn primary" href="#/brand/assistant">Start sourcing</a>}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {!ready ? <div className="wrap-app page"><div className="skeleton" /></div> : (
          <>
            {section === '' && <Landing />}
            {section === 'brand' && <BrandApp sub={sub} />}
            {section === 'maker' && <ManufacturerApp sub={sub} />}
            {section === 'shop' && <Shop sub={sub} id={id} />}
            {section === 'how' && <HowItWorks />}
            {section === 'emails' && <Outbox id={sub} />}
            {section === 'signin' && <SignIn />}
            {section === 'signup' && <SignUp role={sub} />}
          </>
        )}
      </main>
      <footer className={`footer ${section === '' ? 'flush' : ''}`}>
        <div className="wrap-app">
          <div className="foot-grid">
            <div className="col">
              <a className="wordmark" href="#/" aria-label="Meridian Loop home"><span className="wordmark-mark" aria-hidden="true" />Meridian Loop</a>
              <p className="small muted" style={{ maxWidth: '34ch' }}>Sourcing and shopping you can check, from Asia’s sustainable makers. Built in Hong Kong for the HKSTP Ideation Programme 2026.</p>
            </div>
            <nav aria-label="Brands"><h2>Brands</h2><ul><li><a href="#/brand/assistant">Ask the assistant</a></li><li><a href="#/brand/discover">Rank manufacturers</a></li><li><a href="#/brand/post">Post a request</a></li></ul></nav>
            <nav aria-label="Manufacturers"><h2>Manufacturers</h2><ul><li><a href="#/maker/dashboard">Your overview</a></li><li><a href="#/maker/demand">Brand demand</a></li><li><a href="#/maker/documents">Upload a certificate</a></li><li><a href="#/emails">Email alerts</a></li></ul></nav>
            <nav aria-label="Shoppers"><h2>Shoppers</h2><ul><li><a href="#/shop">Shop</a></li><li><a href="#/how">How answers are made</a></li><li><a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a></li></ul></nav>
          </div>
          <div className="foot-note">
            <span className="grow">Demo build. Every company, product and certificate number on this site is fictional.</span>
            {meta?.demo && <button type="button" className="linkish" onClick={reset}>Reset demo data</button>}
          </div>
        </div>
      </footer>
      {drawer && <ManufacturerDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {compare && <CompareModal ids={compare} onClose={() => setCompare(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
