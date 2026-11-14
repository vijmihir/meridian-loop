import { useState } from 'react';
import { api } from './api.js';
import Icon from './icons.jsx';
import { useApp, go } from './ui.jsx';

const ROLE_HOME = { brand: '/brand/assistant', manufacturer: '/maker/dashboard', shopper: '/shop', admin: '/emails' };
const ROLE_WORD = { brand: 'Brand', manufacturer: 'Manufacturer', shopper: 'Shopper', admin: 'Meridian Loop team' };
export const roleWord = (r) => ROLE_WORD[r] || r;

// Where to go after signing in: the page that asked, or the role's home.
export function afterSignIn(user) {
  let next = null;
  try { next = sessionStorage.getItem('after-signin'); sessionStorage.removeItem('after-signin'); } catch { /* storage unavailable */ }
  go(next || ROLE_HOME[user.role] || '/');
}
export function askToSignIn(from) {
  try { sessionStorage.setItem('after-signin', from || window.location.hash.slice(1)); } catch { /* storage unavailable */ }
  go('/signin');
}

// Shown in place of a private area.
export function Gate({ role, title, children }) {
  const { me } = useApp();
  const wrongRole = me && role && me.role !== role && me.role !== 'admin';
  return (
    <div className="empty gate">
      <Icon name="shield" size={28} />
      <h2>{title}</h2>
      <p className="muted">{wrongRole ? `You’re signed in as ${me.entityName || me.name}, a ${roleWord(me.role).toLowerCase()} account. ${children}` : children}</p>
      <div className="row wrap">
        <button type="button" className="btn primary" onClick={() => askToSignIn()}>{wrongRole ? 'Switch account' : 'Sign in'}</button>
        {role && role !== 'admin' && <a className="btn" href={`#/signup/${role}`}>Create a {roleWord(role).toLowerCase()} account</a>}
      </div>
    </div>
  );
}

export function SignIn() {
  const { signedIn, demoAccounts, meta } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('brand');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await api.post('/auth/login', { email, password }); signedIn(r.user); afterSignIn(r.user); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function demo(id) {
    setBusy(true); setError('');
    try { const r = await api.post('/auth/demo', { accountId: id }); signedIn(r.user); afterSignIn(r.user); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  const groups = [['brand', 'Brands'], ['manufacturer', 'Manufacturers'], ['shopper', 'Shopper'], ['admin', 'Team']];
  const shown = demoAccounts.filter((a) => a.role === filter);

  return (
    <div className="wrap-app page auth">
      <form className="card pad col auth-form" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <p className="muted">Brands, manufacturers and shoppers all sign in here.</p>
        <label className="field">Email<input className="input" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password<input className="input" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <p className="field-help" role="alert">{error}</p>
        <button type="submit" className="btn primary lg" disabled={busy || !email || !password} aria-busy={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
        <p className="small muted">New here? <a className="linkish" href="#/signup/brand">Create an account</a></p>
      </form>
      {meta?.demo && demoAccounts.length > 0 && (
        <section className="well col auth-demo" aria-labelledby="demo-title">
          <h2 id="demo-title" className="section-title">Demo accounts</h2>
          <p className="muted">Sign in with one click, no password needed. Every company here is fictional.</p>
          <div className="chips" role="group" aria-label="Account type">
            {groups.map(([k, l]) => <button type="button" key={k} className={`chip ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <ul className="demo-list">
            {shown.map((a) => (
              <li key={a.id}>
                <button type="button" className="demo-acct" disabled={busy} onClick={() => demo(a.id)}>
                  <b>{a.entityName || a.name}</b>
                  <span className="small muted">{a.entityName ? a.name : roleWord(a.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const CATS = ['Fashion', 'Footwear', 'Accessories', 'Home Textiles'];
const COUNTRIES = ['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia'];

export function SignUp({ role: initialRole }) {
  const { signedIn } = useApp();
  const [role, setRole] = useState(['brand', 'manufacturer', 'shopper'].includes(initialRole) ? initialRole : 'brand');
  const [f, setF] = useState({ name: '', email: '', password: '', company: '', hq: '', country: '', city: '', categories: [], materials: '', moq: '', leadTimeDays: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleCat = (c) => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] });
  const err = (k) => errors[k] && <span className="field-help" id={`err-${k}`}>{errors[k]}</span>;
  const aria = (k) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `err-${k}` } : {});

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setErrors({});
    try {
      const r = await api.post('/auth/signup', { ...f, role });
      signedIn(r.user); afterSignIn(r.user);
    } catch (ex) {
      setError(ex.message); setErrors(ex.fields || {});
      const first = Object.keys(ex.fields || {})[0];
      if (first) document.querySelector(`[name="${first}"]`)?.focus();
    }
    setBusy(false);
  }

  return (
    <div className="wrap-app page auth">
      <form className="card pad col auth-form wide" onSubmit={submit} noValidate>
        <h1>Create an account</h1>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">I am a</legend>
          <div className="chips" role="group" aria-label="I am a">
            {[['brand', 'I’m a brand'], ['manufacturer', 'I make products'], ['shopper', 'I’m shopping']].map(([k, l]) => <button type="button" key={k} className={`chip ${role === k ? 'on' : ''}`} aria-pressed={role === k} onClick={() => setRole(k)}>{l}</button>)}
          </div>
        </fieldset>
        <p className="muted">{role === 'brand' ? 'Find and compare manufacturers, keep a shortlist and request quotes.' : role === 'manufacturer' ? 'List your factory, upload certificates and answer brand requests. Your profile starts new and grows with every certificate you add.' : 'Save products and follow brands you trust.'}</p>
        <div className="field-row">
          <label className="field">Your name<input className="input" name="name" autoComplete="name" value={f.name} onChange={set('name')} {...aria('name')} />{err('name')}</label>
          <label className="field">Work email<input className="input" name="email" type="email" autoComplete="email" value={f.email} onChange={set('email')} {...aria('email')} />{err('email')}</label>
        </div>
        <label className="field">Password, 8 characters or more<input className="input" name="password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} {...aria('password')} />{err('password')}</label>
        {role !== 'shopper' && (
          <>
            <div className="field-row">
              <label className="field">{role === 'brand' ? 'Brand name' : 'Factory or company name'}<input className="input" name="company" autoComplete="organization" value={f.company} onChange={set('company')} {...aria('company')} />{err('company')}</label>
              {role === 'brand'
                ? <label className="field">Head office city<input className="input" name="hq" value={f.hq} onChange={set('hq')} placeholder="Hong Kong" /></label>
                : <label className="field">Country<select className="select" name="country" value={f.country} onChange={set('country')} {...aria('country')}><option value="">Choose</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>{err('country')}</label>}
            </div>
            {role === 'manufacturer' && (
              <div className="field-row">
                <label className="field">City<input className="input" name="city" value={f.city} onChange={set('city')} {...aria('city')} />{err('city')}</label>
                <label className="field">Materials you work with<input className="input" name="materials" value={f.materials} onChange={set('materials')} placeholder="organic cotton, linen" /></label>
                <label className="field">Minimum order (units)<input className="input" name="moq" type="number" inputMode="numeric" min="1" value={f.moq} onChange={set('moq')} placeholder="500" /></label>
                <label className="field">Lead time (days)<input className="input" name="leadTimeDays" type="number" inputMode="numeric" min="1" value={f.leadTimeDays} onChange={set('leadTimeDays')} placeholder="45" /></label>
              </div>
            )}
            <div className="field" role="group" aria-labelledby="cat-label">
              <span id="cat-label">{role === 'brand' ? 'What you sell' : 'What you make'}</span>
              <div className="chips" name="categories" tabIndex={-1}>{CATS.map((c) => <button type="button" key={c} className={`chip ${f.categories.includes(c) ? 'on' : ''}`} aria-pressed={f.categories.includes(c)} onClick={() => toggleCat(c)}>{c}</button>)}</div>
              {err('categories')}
            </div>
          </>
        )}
        <p className="field-help" role="alert">{error}</p>
        <button type="submit" className="btn primary lg" disabled={busy} aria-busy={busy}>{busy ? 'Creating your account' : 'Create account'}</button>
        <p className="small muted">Already have one? <a className="linkish" href="#/signin">Sign in</a></p>
      </form>
    </div>
  );
}

// The account control in the nav.
export function AccountMenu() {
  const { me, signOut } = useApp();
  if (!me) return <a className="btn ghost" href="#/signin" onClick={() => { try { sessionStorage.setItem('after-signin', window.location.hash.slice(1)); } catch { /* storage unavailable */ } }}>Sign in</a>;
  return (
    <details className="account">
      <summary aria-label={`Account: ${me.entityName || me.name}`}><span className="avatar-dot" aria-hidden="true">{(me.entityName || me.name).charAt(0)}</span><span className="account-name">{me.entityName || me.name}</span></summary>
      <div className="account-menu">
        <b>{me.name}</b>
        <span className="small muted">{me.email}</span>
        <span className="tag line">{roleWord(me.role)}</span>
        <a className="linkish" href={`#${ROLE_HOME[me.role]}`}>Your home</a>
        {me.role !== 'shopper' && <a className="linkish" href="#/emails">Your emails</a>}
        <button type="button" className="btn" onClick={signOut}>Sign out</button>
      </div>
    </details>
  );
}
