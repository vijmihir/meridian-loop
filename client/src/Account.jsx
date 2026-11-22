import { useEffect, useState } from 'react';
import { api } from './api.js';
import { go, useApp } from './App.jsx';
import { LANGS, getLang, setLang, t } from './i18n.js';

const joinList = (a) => (Array.isArray(a) ? a.join(', ') : a || '');
const kb = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default function Account() {
  const { user, setUser, notify } = useApp();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.get('/me').then(setMe).catch((e) => (e.status === 401 ? go('/signin?next=/account') : setError(e.message)));
  useEffect(() => { if (user === null) go('/signin?next=/account'); else if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() { await api.del('/session').catch(() => {}); setUser(null); notify('Signed out.'); go('/'); }
  if (!user || !me) return <div className="wrap">{error ? <p className="notice" role="alert">{error}</p> : <div className="skeleton" />}</div>;

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>{me.company ? me.company.name : 'Meridian Loop team'}</h1>
          <p>{user.role === 'maker' ? 'Manufacturer account' : user.role === 'brand' ? 'Brand account' : 'Team account: check certificates, see the email outbox and the metrics.'}</p>
        </div>
        <div className="btn-row">
          {me.company && <a className="btn btn-quiet" href={`#/${user.role === 'maker' ? 'm' : 'b'}/${user.id}`}>See your public profile</a>}
          <button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button>
        </div>
      </div>
      {user.role === 'team' ? <TeamPanel /> : (
        <div className="account-grid">
          <ProfileForm role={user.role} company={me.company} onSaved={(c) => { setMe({ ...me, company: c }); notify('Profile saved. Search results use it straight away.'); }} />
          <div className="account-side">
            <Documents docs={me.docs} onChange={load} />
            <Saved saved={me.saved} onChange={load} />
            {user.role === 'maker' && <LanguagePick />}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ k, label, f, set, errors, as, hint, type = 'text', ...rest }) {
  return (
    <label className="field">{label}
      {as === 'textarea'
        ? <textarea className="textarea" name={k} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={errors[k] ? true : undefined} />
        : <input className="input" name={k} type={type} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={errors[k] ? true : undefined} {...rest} />}
      {hint && <span className="hint">{hint}</span>}
      <span className="error">{errors[k]}</span>
    </label>
  );
}

function ProfileForm({ role, company, onSaved }) {
  const init = role === 'maker' ? {
    about: company.about, contact: company.contact, makes: company.makes, materials: joinList(company.materials), processes: joinList(company.processes),
    moq: company.moq, leadTimeDays: company.leadTimeDays, priceFrom: company.priceRange?.from, priceTo: company.priceRange?.to, priceUnit: company.priceRange?.unit || 'piece',
    sampleCost: company.sampleCost, sampleDays: company.sampleDays, capacityPerMonth: company.capacityPerMonth, moqPerColour: company.moqPerColour,
    incoterms: joinList(company.incoterms), languages: joinList(company.languages), whatsapp: company.whatsapp,
  } : { about: company.about, contact: company.contact, sells: company.sells, needs: company.needs.map((n) => ({ ...n, materials: joinList(n.materials), certifications: joinList(n.certifications), countries: joinList(n.countries) })) };
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setNeed = (i, k, v) => setF((x) => ({ ...x, needs: x.needs.map((n, j) => (j === i ? { ...n, [k]: v } : n)) }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({});
    try { const r = await api.patch('/me/profile', f); onSaved(r.company); }
    catch (err) { setErrors(err.fields || { about: err.message }); }
    setBusy(false);
  }
  const p = { f, set, errors };
  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>Profile</legend>
        <Field k="about" label="About" as="textarea" {...p} hint="Brands read this first." />
        <Field k="contact" label="Contact name" {...p} />
        {role === 'maker' ? (<>
          <Field k="makes" label="Products" {...p} />
          <Field k="materials" label="Materials" {...p} hint="Separate with commas." />
          <Field k="processes" label="Processes" {...p} hint="Separate with commas." />
        </>) : <Field k="sells" label="What you sell" {...p} />}
      </fieldset>
      {role === 'maker' ? (
        <fieldset>
          <legend>Terms brands ask about</legend>
          <div className="two"><Field k="moq" label="Minimum order" type="number" inputMode="numeric" {...p} /><Field k="moqPerColour" label="Minimum a colour" type="number" inputMode="numeric" {...p} /></div>
          <div className="two"><Field k="priceFrom" label="Price from (US$)" type="number" step="0.01" {...p} /><Field k="priceTo" label="Price to (US$)" type="number" step="0.01" {...p} /></div>
          <label className="field">Priced by the
            <select className="select" value={f.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}><option value="piece">piece</option><option value="metre">metre</option></select>
          </label>
          <div className="two"><Field k="leadTimeDays" label="Lead time (days)" type="number" {...p} /><Field k="capacityPerMonth" label="Capacity a month" type="number" {...p} /></div>
          <div className="two"><Field k="sampleCost" label="Sample cost (US$)" type="number" {...p} /><Field k="sampleDays" label="Sample time (days)" type="number" {...p} /></div>
          <Field k="incoterms" label="Shipping terms" {...p} hint="EXW, FOB, CIF, DAP or DDP, separated with commas." />
          <Field k="languages" label="Languages" {...p} hint="The first one is used for WhatsApp replies." />
          <label className="check"><input type="checkbox" checked={Boolean(f.whatsapp)} onChange={(e) => set('whatsapp', e.target.checked)} /> Brands may reach us on WhatsApp</label>
        </fieldset>
      ) : (
        <fieldset>
          <legend>What you are looking for</legend>
          {f.needs.map((n, i) => (
            <div key={i} className="need-edit">
              <label className="field">Title<input className="input" value={n.title} onChange={(e) => setNeed(i, 'title', e.target.value)} /></label>
              <label className="field">Details<textarea className="textarea" value={n.detail} onChange={(e) => setNeed(i, 'detail', e.target.value)} /></label>
              <div className="two">
                <label className="field">Quantity<input className="input" type="number" value={n.quantity} onChange={(e) => setNeed(i, 'quantity', e.target.value)} /></label>
                <label className="field">Target price<input className="input" value={n.target} onChange={(e) => setNeed(i, 'target', e.target.value)} /></label>
              </div>
              <div className="two">
                <label className="field">Materials<input className="input" value={n.materials} onChange={(e) => setNeed(i, 'materials', e.target.value)} /></label>
                <label className="field">Certificates needed<input className="input" value={n.certifications} onChange={(e) => setNeed(i, 'certifications', e.target.value)} /></label>
              </div>
              <button type="button" className="text-btn" onClick={() => set('needs', f.needs.filter((_, j) => j !== i))}>Remove this request</button>
            </div>
          ))}
          <span className="error">{errors.needs}</span>
          {f.needs.length < 6 && <button type="button" className="btn btn-quiet" onClick={() => set('needs', [...f.needs, { title: '', detail: '', quantity: '', target: '', materials: '', certifications: '', countries: '' }])}>Add a request</button>}
        </fieldset>
      )}
      <div><button type="submit" className="btn" disabled={busy}>{busy ? 'Saving' : 'Save profile'}</button></div>
    </form>
  );
}

function Documents({ docs, onChange }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('certificate');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload(e) {
    e.preventDefault(); setError('');
    if (!file) return setError('Choose a file.');
    if (file.size > 1.5e6) return setError('Choose a file under 1.5 MB.');
    setBusy(true);
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    try { await api.post('/me/documents', { name: name || file.name.replace(/\.[^.]+$/, ''), kind, dataUrl }); setName(''); setFile(null); e.target.reset(); onChange(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  return (
    <section className="panel-box">
      <h2>Documents</h2>
      <p className="muted small">Certificate scans, photographs and tech packs. Brands see them on your profile.</p>
      {docs.length > 0 && (
        <ul className="doc-list">{docs.map((d) => (
          <li key={d.id}><a href={`/api/documents/${d.id}`} target="_blank" rel="noopener">{d.name}</a><span className="where">{d.kind}, {kb(d.size)}</span>
            <button type="button" className="remove" onClick={async () => { await api.del(`/me/documents/${d.id}`); onChange(); }}>Remove</button></li>
        ))}</ul>
      )}
      <form onSubmit={upload} className="upload" noValidate>
        <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="GOTS scope certificate 2026" /></label>
        <label className="field">Kind<select className="select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="certificate">Certificate</option><option value="photo">Photograph</option><option value="techpack">Tech pack</option><option value="other">Other</option></select></label>
        <label className="field">File<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} /><span className="hint">PDF, JPEG, PNG or WebP, up to 1.5 MB.</span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-quiet" disabled={busy}>{busy ? 'Uploading' : 'Upload file'}</button>
      </form>
    </section>
  );
}

function Saved({ saved, onChange }) {
  return (
    <section className="panel-box">
      <h2>Saved searches</h2>
      {saved.length === 0 ? <p className="muted small">Save a search from the assistant and you get a note in your inbox when a new company fits it.</p> : (
        <ul className="doc-list">{saved.map((s) => (
          <li key={s.id}><a href={`#/?q=${encodeURIComponent(s.query)}`}>{s.query}</a>
            <button type="button" className="remove" onClick={async () => { await api.del(`/me/saved/${s.id}`); onChange(); }}>Remove</button></li>
        ))}</ul>
      )}
    </section>
  );
}

function LanguagePick() {
  const [lang, setL] = useState(getLang());
  return (
    <section className="panel-box">
      <h2>{t('language', lang)}</h2>
      <p className="muted small">For the listing form and quote replies on this device. WhatsApp replies use the first language on your profile.</p>
      <div className="filters">{LANGS.map(([k, label]) => <button key={k} type="button" className="filter" aria-pressed={lang === k} onClick={() => { setLang(k); setL(k); }}>{label}</button>)}</div>
    </section>
  );
}

function TeamPanel() {
  const [mail, setMail] = useState(null);
  useEffect(() => { api.get('/outbox').then(setMail).catch(() => setMail([])); }, []);
  return (
    <div className="account-grid">
      <section>
        <h2 className="section-title">Email outbox</h2>
        <p className="muted">The emails a launch would send: every notification also goes to the company’s contact. Nothing leaves this server in the demo.</p>
        {!mail ? <div className="skeleton" /> : mail.length === 0 ? <p className="empty-state">No emails yet. Send a quote request to fill it.</p> : (
          <ul className="mail-list">{mail.slice(0, 40).map((m, i) => (
            <li key={i}><b>{m.subject}</b><span className="where">To {m.name || m.to}, {new Date(m.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span><p>{m.body.split('\n')[0]}</p></li>
          ))}</ul>
        )}
      </section>
      <div className="account-side">
        <section className="panel-box"><h2>Certificates</h2><p className="muted small">Open any manufacturer’s profile and press “Check in the register” beside a certificate.</p><a className="btn btn-quiet" href="#/directory">Open the directory</a></section>
        <section className="panel-box"><h2>Pilot metrics</h2><p className="muted small">The funnel from question to award.</p><a className="btn btn-quiet" href="#/metrics">See the metrics</a></section>
      </div>
    </div>
  );
}
