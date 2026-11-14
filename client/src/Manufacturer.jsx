import { useEffect, useState } from 'react';
import { api } from './api.js';
import Chat from './Chat.jsx';
import Icon from './icons.jsx';
import { Reply } from './Brand.jsx';
import { Gate } from './Account.jsx';
import { useApp, go, Ring, DimBars, Radar, CertBadge, RegisterCheck, Check, Flag, Highlight, Spinner, fmtDate } from './ui.jsx';

const TABS = [['dashboard', 'Overview'], ['demand', 'Brand demand'], ['assistant', 'Ask the assistant'], ['documents', 'Certificates'], ['inbox', 'Inbox'], ['profile', 'Profile']];

export default function ManufacturerApp({ sub }) {
  const { makerId, setMakerId, makers, isTeam, canMaker } = useApp();
  const tab = sub || 'dashboard';
  const [m, setM] = useState(null);
  const [inbox, setInbox] = useState([]);
  const reload = () => { if (!makerId) return; api.get(`/manufacturers/${makerId}`).then(setM); api.get(`/rfqs?manufacturerId=${makerId}`).then(setInbox).catch(() => setInbox([])); };
  useEffect(() => { setM(null); reload(); }, [makerId, tab]);
  if (!canMaker) return (
    <div className="wrap-app page">
      <div className="page-head"><div className="grow"><h1>Show brands what you can prove</h1><p>Your factory’s profile, certificates, brand requests and quotes, in one private workspace.</p></div></div>
      <Gate role="manufacturer" title="Sign in as a manufacturer">This workspace belongs to a factory account. New here? Create one and your profile goes live straight away.</Gate>
    </div>
  );
  const unanswered = inbox.filter((r) => r.kind !== 'proposal' && !r.replies.some((x) => x.from === 'manufacturer')).length;

  return (
    <div className="wrap-app page">
      <div className="page-head">
        <div className="grow">
          <h1>Show brands what you can prove</h1>
          <p>Keep your profile and certificates current, and see which brands are looking for what you make.</p>
        </div>
        {isTeam ? (
          <label className="persona">Acting as
            <select className="select" value={makerId} onChange={(e) => setMakerId(e.target.value)}>
              {makers.map((x) => <option key={x.id} value={x.id}>{x.name}, {x.country}</option>)}
            </select>
          </label>
        ) : <span className="persona">Signed in as <b>{m?.name || '…'}</b></span>}
      </div>
      <nav className="tabs" aria-label="Manufacturer portal">
        {TABS.map(([k, l]) => (
          <a key={k} href={`#/maker/${k}`} aria-current={tab === k ? 'page' : undefined}>{l}{k === 'inbox' && unanswered > 0 && <span className="count" aria-label={`${unanswered} unanswered`}>{unanswered}</span>}</a>
        ))}
      </nav>
      {!m ? <div className="skeleton" /> : (
        <>
          {tab === 'dashboard' && <Dashboard m={m} inbox={inbox} />}
          {tab === 'demand' && <Demand m={m} />}
          {tab === 'assistant' && <Chat role="manufacturer" manufacturerId={m.id} storageKey={`chat-maker-${m.id}`}
            placeholder="For example: which brands need recycled polyester?"
            suggestions={[`Which brands need ${m.materials[0]}?`, `Brands looking for ${m.categories[0].toLowerCase()} made in ${m.country}`, 'Requests under 1,000 units', 'What does GOTS require?']}
            intro={<><h2>Which brands need what you make?</h2><p>Ask about open sourcing requests, or what a certification requires. Answers cite the brands’ own requests.</p></>} />}
          {tab === 'documents' && <Documents m={m} onChange={reload} />}
          {tab === 'inbox' && <Inbox inbox={inbox} onChange={reload} />}
          {tab === 'profile' && <Profile m={m} onSaved={setM} />}
        </>
      )}
    </div>
  );
}

function Dashboard({ m, inbox }) {
  const pc = m.profileCompleteness;
  return (
    <div className="col" style={{ gap: 'var(--space-xl)' }}>
      <div className="kpis">
        <div><span>Trust score brands see</span><b>{m.quant}</b><span>out of 100, across seven measures</span></div>
        <div><span>Profile complete</span><b>{pc.pct}%</b><div className="progress"><i style={{ width: `${pc.pct}%` }} /></div></div>
        <div><span>Conversations with brands</span><b>{inbox.length}</b><span>quote requests and proposals</span></div>
      </div>
      <div className="two">
        <section className="card pad">
          <h2 className="section-title">How brands see you</h2>
          <p className="small muted">{m.explanation}</p>
          <div className="split-score" style={{ marginTop: 'var(--space-md)' }}><Radar series={[{ scores: m.scores }]} size={250} /><DimBars scores={m.scores} /></div>
        </section>
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <section className="well">
            <h2 className="section-title">To rank higher</h2>
            <ul className="checklist">
              {pc.items.map((i) => <li key={i.label} className={i.done ? '' : 'todo'}><Icon name={i.done ? 'check' : 'x'} size={18} />{i.label}</li>)}
            </ul>
            {pc.pct < 100 && <button type="button" className="btn primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => go('/maker/documents')}>Upload a certificate</button>}
          </section>
          {m.flags.length > 0 && <section className="col"><h2 className="section-title">What brands are warned about</h2>{m.flags.map((f) => <Flag key={f.text} level={f.level}>{f.text}</Flag>)}</section>}
        </div>
      </div>
      <MakerEmails m={m} />
      <section>
        <h2 className="section-title">Certificates on file</h2>
        <div className="row wrap" style={{ gap: 'var(--space-xs)' }}>{m.certifications.map((c) => <CertBadge key={c.name} cert={{ ...c, state: c.status.state }} />)}</div>
      </section>
    </div>
  );
}

function MakerEmails({ m }) {
  const [emails, setEmails] = useState(null);
  useEffect(() => { api.get('/outbox').then((d) => setEmails(d.emails.filter((e) => e.about?.manufacturerId === m.id && e.about?.audience === 'maker').slice(0, 4))).catch(() => setEmails([])); }, [m.id]);
  if (!emails?.length) return null;
  return (
    <section className="well">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}><h2 className="section-title">Emails sent to you</h2><a className="linkish" href="#/emails">All email alerts</a></div>
      <ul className="mini-mail">
        {emails.map((e) => <li key={e.id}><a href={`#/emails/${e.id}`}><b>{e.subject}</b><span className="small muted">{new Date(e.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></a></li>)}
      </ul>
    </section>
  );
}

function Demand({ m }) {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const run = (query) => api.post('/demand', { manufacturerId: m.id, query }).then(setData);
  useEffect(() => { run(''); }, [m.id]);

  async function propose(r, message) {
    const x = await api.post('/rfqs', { brandId: r.request.brandId, manufacturerId: m.id, message, kind: 'proposal', requestTitle: r.request.title, status: 'proposal' });
    setOpen(null); toast(`Proposal sent. ${x.emailed ? `${r.request.brandName}’s sourcing team was emailed.` : ''} It appears in your Inbox.`);
  }

  return (
    <div className="col" style={{ gap: 'var(--space-md)' }}>
      <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <Icon name="search" />
        <label htmlFor="demand-q" className="visually-hidden">Search brand requests</label>
        <input id="demand-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand requests, for example: recycled throws, vegan bags, babywear" />
        <button type="submit" className="btn primary">Search</button>
      </form>
      {!data ? <div className="skeleton" /> : !data.results.length ? (
        <div className="empty"><h2>No brand requests match</h2><p className="muted">Try a material or product you make, or clear the search to see requests matched to your profile.</p><button type="button" className="btn" onClick={() => { setQ(''); run(''); }}>Show my matches</button></div>
      ) : (
        <>
          <p className="small muted">{q ? `${data.results.length} requests match “${q}”.` : `Matched to what you make: ${m.materials.slice(0, 3).join(', ')}.`}</p>
          {data.results.map((r) => (
            <article key={r.request.id} className="card demand">
              <Ring value={r.fit} label="fit" />
              <div className="col">
                <div className="row wrap"><h3 className="grow">{r.request.title}</h3><span className="tag line">{r.request.category}</span></div>
                <div className="terms"><span><b>{r.request.brandName}</b>, {r.request.brandHq}</span><span>Quantity <b>{r.request.quantity.toLocaleString()}</b></span><span>Target <b>{r.request.targetPrice || 'open'}</b></span><span>Due <b>{r.request.deadline ? fmtDate(r.request.deadline) : 'flexible'}</b></span></div>
                <p className="small muted"><Highlight text={r.request.requirements || ''} terms={(q || m.materials.join(' ')).toLowerCase().split(/\W+/)} max={400} /></p>
                <div className="row wrap" style={{ gap: 'var(--space-2xs) var(--space-md)' }}>{r.checks.map((c) => <Check key={c.label} ok={c.ok}>{c.label}</Check>)}</div>
                {open === r.request.id
                  ? <Reply placeholder={`Hi ${r.request.brandName}, we can make this at`} onSend={(t) => propose(r, t)} actions={<button type="button" className="btn ghost" onClick={() => setOpen(null)}>Cancel</button>} />
                  : <div><button type="button" className="btn primary" onClick={() => setOpen(r.request.id)}>Send a proposal</button></div>}
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(blob);
});

function Documents({ m, onChange }) {
  const { toast } = useApp();
  const [samples, setSamples] = useState([]);
  const [text, setText] = useState('');
  const [ex, setEx] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState(false);
  useEffect(() => { fetch('/samples/index.json').then((r) => r.json()).then(setSamples).catch(() => setSamples([])); }, []);
  useEffect(() => () => { if (file?.preview) URL.revokeObjectURL(file.preview); }, [file]);

  async function readFile(blob, filename) {
    setBusy(true); setError(''); setEx(null); setFile(null);
    try {
      if (blob.size > 10 * 1024 * 1024) throw new Error('That file is over 10 MB. Upload the certificate pages only.');
      const isPdfFile = blob.type === 'application/pdf' || /\.pdf$/i.test(filename);
      if (!isPdfFile && !/text|csv|markdown/.test(blob.type) && !/\.(txt|md|csv)$/i.test(filename)) throw new Error('Upload a PDF or a .txt file.');
      const r = await api.post('/documents/read', { filename, data: await toBase64(blob) });
      setText(r.text); setEx(r.extracted);
      setFile({ ...r, preview: isPdfFile ? URL.createObjectURL(blob) : null });
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  async function trySample(s) {
    try { const blob = await (await fetch(`/samples/${s.file}`)).blob(); await readFile(new Blob([blob], { type: 'application/pdf' }), s.file); }
    catch (e) { setError(e.message); }
  }
  async function extractPasted() { setBusy(true); setError(''); setFile(null); setEx(await api.post('/documents/extract', { text })); setBusy(false); }
  async function attach() {
    const before = m.quant;
    const r = await api.post('/documents', { manufacturerId: m.id, text, label: ex?.standard || file?.filename, fileId: file?.fileId, filename: file?.filename });
    toast(`Certificate attached. Trust score ${before} to ${r.manufacturer.quant}.`);
    setText(''); setEx(null); setFile(null); onChange();
  }
  const onDrop = (e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f, f.name); };

  return (
    <div className="two">
      <section className="card pad col">
        <h2 className="section-title">Upload a certificate</h2>
        <p className="muted">Drop in a certificate, audit summary or lab report. Meridian Loop reads the standard, number, issuer and expiry, checks they match your profile, and makes it searchable for brands.</p>
        <label className={`dropzone ${drag ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} aria-busy={busy}>
          <Icon name="upload" size={32} />
          <b>{busy ? 'Reading the document…' : 'Drop a PDF here, or choose a file'}</b>
          <span className="small muted">PDF or .txt, up to 10 MB</span>
          <input type="file" accept=".pdf,application/pdf,.txt,text/plain" className="visually-hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, f.name); e.target.value = ''; }} />
        </label>
        {samples.length > 0 && (
          <div className="col" style={{ gap: 'var(--space-xs)' }}>
            <span className="small muted">No PDF to hand? Try a sample:</span>
            <div className="chips">{samples.map((s) => <button type="button" key={s.file} className="chip" disabled={busy} onClick={() => trySample(s)}><Icon name="file" size={16} />{s.label}</button>)}</div>
          </div>
        )}
        {error && <div className="flag" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
        <button type="button" className="linkish" style={{ alignSelf: 'flex-start' }} aria-expanded={paste} onClick={() => setPaste(!paste)}>{paste ? 'Hide the text box' : 'Or paste the text instead'}</button>
        {paste && (
          <>
            <label htmlFor="doc-text" className="visually-hidden">Document text</label>
            <textarea id="doc-text" className="textarea code" value={text} onChange={(e) => { setText(e.target.value); setEx(null); setFile(null); }} placeholder="Paste the document text here" />
            <div><button type="button" className="btn primary" disabled={!text.trim() || busy} aria-busy={busy} onClick={extractPasted}>Read and check</button></div>
          </>
        )}
      </section>
      <div className="col" style={{ gap: 'var(--space-lg)' }}>
        {ex ? (
          <section className="card pad extract" aria-live="polite">
            <div className="row wrap"><h2 className="section-title grow">What it says</h2><span className="tag mint">{ex.confidence}% confident</span></div>
            {file && (
              <div className="row wrap small">
                <span className="tag line"><Icon name="file" size={14} />{file.filename}{file.pages ? `, ${file.pages} page${file.pages > 1 ? 's' : ''}` : ''}</span>
                <span className="muted">{file.method === 'claude' ? 'Read by Claude from the original PDF' : file.method === 'pdf-text' ? 'Read from the PDF’s text' : 'Read from the text file'}</span>
                {file.preview && <a className="linkish" href={file.preview} target="_blank" rel="noopener">Open the original</a>}
              </div>
            )}
            {file?.notice && <p className="small muted">{file.notice}</p>}
            <table className="tbl"><tbody>{ex.fields.map((f) => <tr key={f.label}><td className="muted">{f.label}</td><td><b>{f.value}</b></td><td className="mono muted">{Math.round(f.confidence * 100)}%</td></tr>)}</tbody></table>
            {ex.registry && <div className="col" style={{ gap: 'var(--space-xs)' }}><h3>Issuer’s register</h3><RegisterCheck reg={ex.registry} /></div>}
            {ex.findings.length > 0 && <div><h3>Key lines</h3><ul style={{ paddingLeft: 'var(--space-lg)', margin: 'var(--space-xs) 0 0' }}>{ex.findings.map((f) => <li key={f}>{f}</li>)}</ul></div>}
            {ex.matchedManufacturerId && ex.matchedManufacturerId !== m.id && <Flag>This document names a different company than {m.name}. Switch to that maker, or upload their own certificate.</Flag>}
            {ex.issues.map((i) => <Flag key={i}>{i}</Flag>)}
            {ex.standard && ex.expires && ex.registry && !['confirmed', 'manual'].includes(ex.registry.status) && <p className="small muted">You can still attach it, but brands will see it as not confirmed until the issuer’s record matches.</p>}
            {ex.standard && ex.expires && <p>Attaching will {m.certifications.some((c) => c.name.toLowerCase().startsWith(ex.standard.toLowerCase().split(' ')[0])) ? 'renew' : 'add'} <b>{ex.standard}</b> on your profile, valid until <span className="mono">{fmtDate(ex.expires)}</span>.</p>}
            <div><button type="button" className="btn primary" disabled={Boolean(ex.matchedManufacturerId && ex.matchedManufacturerId !== m.id)} onClick={attach}>Attach to {m.name}</button></div>
          </section>
        ) : (
          <section className="well">
            <h2 className="section-title">On file now</h2>
            <div className="col" style={{ gap: 'var(--space-xs)' }}>{m.certifications.map((c) => <div key={c.name} className="row small wrap"><CertBadge cert={{ ...c, state: c.status.state }} /><RegisterCheck reg={c.registry} compact /><span className="mono muted grow">{c.id}</span><span className="mono muted">until {fmtDate(c.expires)}</span></div>)}</div>
          </section>
        )}
        {m.documents.length > 0 && <section className="well"><h2 className="section-title">Uploaded</h2>{m.documents.map((d) => <div key={d.id} className="row small wrap" style={{ marginTop: 'var(--space-xs)' }}><Icon name="file" size={16} /><b>{d.label}</b><span className="muted grow">{d.extracted?.standard || 'unclassified'}, {fmtDate(d.createdAt)}</span>{d.fileId && <a className="linkish" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener">Open PDF</a>}</div>)}</section>}
      </div>
    </div>
  );
}

function Inbox({ inbox, onChange }) {
  const { toast } = useApp();
  if (!inbox.length) return <div className="empty"><h2>No conversations yet</h2><p className="muted">Quote requests from brands land here. You can also send proposals from Brand demand.</p><button type="button" className="btn primary" onClick={() => go('/maker/demand')}>See brand demand</button></div>;
  return (
    <div className="col" style={{ gap: 'var(--space-md)' }}>
      {inbox.map((r) => (
        <div key={r.id} className="card pad">
          <div className="row wrap"><b className="grow">{r.kind === 'proposal' ? `Your proposal to ${r.brandName}` : `Quote request from ${r.brandName}`}{r.requestTitle ? `: ${r.requestTitle}` : ''}</b><span className="tag line">{r.status}</span><span className="small muted mono">{fmtDate(r.createdAt)}</span></div>
          <div className="thread">
            <div className={`m ${r.kind === 'proposal' ? '' : 'them'}`}>{r.message}</div>
            {r.replies.map((x, i) => <div key={i} className={`m ${x.from === 'brand' ? 'them' : ''}`}><span className="from">{x.from === 'brand' ? r.brandName : 'You'}</span>{x.text}</div>)}
          </div>
          <Reply placeholder="Reply with a quote, for example: US$15.20 a set FOB, 40 days, samples in 7" onSend={(text) => api.post(`/rfqs/${r.id}/reply`, { from: 'manufacturer', text, status: 'quoted' }).then((x) => { onChange(); if (x.emailed) toast(`Quote sent. ${r.brandName}’s sourcing team was emailed.`); })} />
        </div>
      ))}
    </div>
  );
}

function Profile({ m, onSaved }) {
  const { toast } = useApp();
  const [f, setF] = useState({ description: m.description, products: m.products, moq: m.moq, leadTimeDays: m.leadTimeDays, sampleDays: m.sampleDays, capacity: m.capacity, contact: m.contact });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) { e.preventDefault(); const r = await api.patch(`/manufacturers/${m.id}`, f); onSaved(r); toast('Profile saved. Brands searching now see the new details.'); }
  return (
    <form className="card pad col" style={{ maxWidth: 760 }} onSubmit={save}>
      <h2 className="section-title">Your profile</h2>
      <p className="small muted">Brands search these details. Changes show up in their next search.</p>
      <label className="field">About your company<textarea className="textarea" value={f.description} onChange={set('description')} /></label>
      <label className="field">What you make<input className="input" value={f.products} onChange={set('products')} /></label>
      <div className="field-row">
        <label className="field">Minimum order (units)<input className="input" type="number" inputMode="numeric" value={f.moq} onChange={set('moq')} /></label>
        <label className="field">Lead time (days)<input className="input" type="number" inputMode="numeric" value={f.leadTimeDays} onChange={set('leadTimeDays')} /></label>
        <label className="field">Sample time (days)<input className="input" type="number" inputMode="numeric" value={f.sampleDays} onChange={set('sampleDays')} /></label>
        <label className="field">Monthly capacity (units)<input className="input" type="number" inputMode="numeric" value={f.capacity} onChange={set('capacity')} /></label>
      </div>
      <label className="field">Contact<input className="input" value={f.contact} onChange={set('contact')} /></label>
      <div><button type="submit" className="btn primary">Save profile</button></div>
    </form>
  );
}
