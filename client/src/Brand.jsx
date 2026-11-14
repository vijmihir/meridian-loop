import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Chat from './Chat.jsx';
import Icon from './icons.jsx';
import { Gate, askToSignIn } from './Account.jsx';
import { useApp, go, Ring, DimBars, Radar, CertBadge, RegisterCheck, Check, Flag, Highlight, Spinner, dollars, fmtDate, DIM_LABELS } from './ui.jsx';

const PRESETS = {
  Balanced: { cost: 15, sustainability: 25, reliability: 15, quality: 15, leadTime: 10, compliance: 10, risk: 10 },
  'Impact first': { cost: 5, sustainability: 45, reliability: 10, quality: 10, leadTime: 5, compliance: 20, risk: 5 },
  'Cost first': { cost: 45, sustainability: 10, reliability: 15, quality: 10, leadTime: 10, compliance: 5, risk: 5 },
  'Speed to market': { cost: 10, sustainability: 15, reliability: 20, quality: 10, leadTime: 35, compliance: 5, risk: 5 },
};

const BRAND_SUGGESTIONS = [
  'GOTS organic cotton loungewear, small MOQ, India or Cambodia',
  'Vegan sneakers with natural rubber soles in Vietnam',
  'Recycled polyester activewear with bluesign chemistry',
  'Plastic-free jute tote bags at low cost',
  'What is the difference between GRS and RCS?',
];

const TABS = [['assistant', 'Ask the assistant'], ['discover', 'Rank manufacturers'], ['shortlist', 'Shortlist'], ['rfqs', 'Quotes'], ['post', 'Post a request']];

export default function BrandApp({ sub }) {
  const { brandId, setBrandId, brands, shortlist, weights, isTeam, canBrand } = useApp();
  const tab = sub || 'assistant';
  const [rfqCount, setRfqCount] = useState(0);
  useEffect(() => { if (canBrand) api.get(`/rfqs?brandId=${brandId}`).then((r) => setRfqCount(r.filter((x) => x.replies.length).length)).catch(() => {}); }, [brandId, tab, canBrand]);
  const gated = (el) => (canBrand ? el : <Gate role="brand" title="Sign in as a brand">Shortlists, quote requests and sourcing requests belong to a brand account. The assistant and the ranking stay open to everyone.</Gate>);
  const brand = brands.find((b) => b.id === brandId);

  return (
    <div className="wrap-app page">
      <div className="page-head">
        <div className="grow">
          <h1>Find a manufacturer you can check</h1>
          <p>Describe what you’re making. Meridian Loop searches every supplier profile and certificate, ranks the matches and shows its sources.</p>
        </div>
        {isTeam ? (
          <label className="persona">Acting as
            <select className="select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}, {b.hq}</option>)}
            </select>
          </label>
        ) : canBrand ? <span className="persona">Signed in as <b>{brand?.name}</b></span>
          : <span className="persona"><button type="button" className="linkish" onClick={() => askToSignIn()}>Sign in as a brand</button> to keep a shortlist and request quotes</span>}
      </div>
      <nav className="tabs" aria-label="Brand workspace">
        {TABS.map(([k, l]) => (
          <a key={k} href={`#/brand/${k}`} aria-current={tab === k ? 'page' : undefined}>
            {k === 'shortlist' && shortlist.length ? `${l} (${shortlist.length})` : l}
            {k === 'rfqs' && rfqCount > 0 && <span className="count" aria-label={`${rfqCount} replies`}>{rfqCount}</span>}
          </a>
        ))}
      </nav>
      {tab === 'assistant' && (
        <Chat role="brand" weights={weights} storageKey={`chat-brand-${brandId}`} suggestions={BRAND_SUGGESTIONS}
          placeholder="For example: GOTS organic cotton hoodies, MOQ under 500, India or Cambodia"
          intro={<><h2>What are you making{brand ? `, ${brand.name}` : ''}?</h2><p>Name the product, material, certifications, quantity and where you’d like it made. Try one of these:</p></>} />
      )}
      {tab === 'discover' && <Discover />}
      {tab === 'shortlist' && gated(<Shortlist />)}
      {tab === 'rfqs' && gated(<BrandRfqs brandId={brandId} />)}
      {tab === 'post' && gated(<PostRequest brand={brand} />)}
    </div>
  );
}

// ---------------- Discover ----------------
function Discover() {
  const { weights, setWeights, openManufacturer, shortlist, toggleShortlist, setCompare } = useApp();
  const [query, setQuery] = useState(() => sessionStorage.getItem('discover-q') || '');
  const [submitted, setSubmitted] = useState(query);
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    try { sessionStorage.setItem('discover-q', submitted); } catch { /* storage unavailable */ }
    let live = true;
    const t = setTimeout(() => api.post('/match', { query: submitted, weights }).then((d) => live && setData(d)), 120);
    return () => { live = false; clearTimeout(t); };
  }, [submitted, weights]);

  const terms = useMemo(() => (submitted + ' ' + (data?.expansions || []).join(' ')).toLowerCase().split(/[^a-z0-9-]+/), [submitted, data]);
  const activePreset = Object.entries(PRESETS).find(([, w]) => JSON.stringify(w) === JSON.stringify(weights))?.[0];

  return (
    <div className="discover">
      <aside className="well weights" aria-label="Decision weights">
        <h2>What matters most?</h2>
        <p className="small muted">Each manufacturer is scored on seven things. Move a slider and the ranking updates.</p>
        <div className="chips" style={{ marginTop: 'var(--space-sm)' }}>
          {Object.keys(PRESETS).map((p) => <button type="button" key={p} className={`chip ${activePreset === p ? 'on' : ''}`} aria-pressed={activePreset === p} onClick={() => setWeights(PRESETS[p])}>{p}</button>)}
        </div>
        {Object.entries(DIM_LABELS).map(([k, l]) => (
          <label className="slider" key={k}>
            <span>{l}</span><b>{weights[k]}</b>
            <input type="range" min="0" max="50" value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
          </label>
        ))}
      </aside>
      <section aria-label="Results">
        <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(query); }}>
          <Icon name="search" />
          <label htmlFor="discover-q" className="visually-hidden">Describe what you need</label>
          <input id="discover-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Material, product, certification, MOQ, country" />
          {submitted && <button type="button" className="btn ghost sm" onClick={() => { setQuery(''); setSubmitted(''); }}>Clear</button>}
          <button type="submit" className="btn primary">Search</button>
        </form>
        <div className="chips" style={{ margin: 'var(--space-sm) 0 var(--space-lg)' }}>
          {['organic cotton India MOQ under 300', 'vegan leather bags', 'recycled polyester outerwear', 'waste cotton', 'biodegradable fabric', 'organic fabric'].map((s) => <button type="button" key={s} className="chip" onClick={() => { setQuery(s); setSubmitted(s); }}>{s}</button>)}
        </div>
        {!data ? <div className="skeleton" /> : !data.results.length ? (
          <div className="empty"><h2>No manufacturer matches that</h2><p className="muted">Try naming a material or product, or remove a requirement such as the country.</p><button type="button" className="btn" onClick={() => { setQuery(''); setSubmitted(''); }}>Show all manufacturers</button></div>
        ) : (
          <>
            <div className="understood">
              <span className="small muted">{data.results.length} manufacturers{submitted ? ' matched' : ' on the platform'}</span>
              {data.constraintText.map((c) => <span key={c} className="tag mint">{c}</span>)}
              {data.expansions.slice(0, 4).map((c) => <span key={c} className="tag line">also: {c}</span>)}
            </div>
            <div className="results">
              {data.results.map((r) => {
                const listed = shortlist.some((s) => s.manufacturerId === r.manufacturer.id);
                return (
                  <article key={r.manufacturer.id} className="card result">
                    <div className="col">
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <Ring value={r.match} />
                        <div className="grow col" style={{ gap: 'var(--space-2xs)' }}>
                          <h3><button type="button" onClick={() => openManufacturer(r.manufacturer.id)}>{r.manufacturer.name}</button></h3>
                          <span className="place">{r.manufacturer.city}, {r.manufacturer.country}. Since {r.manufacturer.founded}. {r.manufacturer.categories.join(', ')}</span>
                          <div className="terms"><span>MOQ <b>{r.manufacturer.moq}</b></span><span>Lead time <b>{r.manufacturer.leadTimeDays}</b> days</span><span>Price <b>{dollars(r.manufacturer.priceIndex)}</b></span></div>
                        </div>
                      </div>
                      <div className="row wrap" style={{ gap: 'var(--space-2xs)' }}>{r.manufacturer.certifications.map((c) => <CertBadge key={c.name} cert={c} />)}</div>
                      {r.checks.length > 0 && <div className="row wrap" style={{ gap: 'var(--space-2xs) var(--space-md)' }}>{r.checks.map((c) => <Check key={c.label} ok={c.ok}>{c.label}</Check>)}</div>}
                      {r.evidence[0] && <div className="evidence"><span className="src">Why it matched: {r.evidence[0].title.split(': ').slice(1).join(': ')}</span><Highlight text={r.evidence[0].text} terms={terms} /></div>}
                      {r.flags.filter((f) => f.level !== 'low').slice(0, 2).map((f) => <Flag key={f.text}>{f.text}</Flag>)}
                      <div className="row wrap">
                        <button type="button" className="btn" onClick={() => openManufacturer(r.manufacturer.id)}>Open profile</button>
                        <button type="button" className={`btn ${listed ? 'on' : ''}`} aria-pressed={listed} onClick={() => toggleShortlist(r.manufacturer.id)}><Icon name="star" size={16} />{listed ? 'Shortlisted' : 'Shortlist'}</button>
                        <label className="compare-label"><input type="checkbox" checked={picked.includes(r.manufacturer.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.manufacturer.id].slice(-4) : picked.filter((x) => x !== r.manufacturer.id))} />Compare</label>
                      </div>
                    </div>
                    <div className="side-scores">
                      <div className="pair">Fit to your brief <b>{r.relevance}</b></div>
                      <div className="pair">Weighted score <b>{r.quant}</b></div>
                      <DimBars scores={r.scores} />
                      <p className="small muted">{r.explanation}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
      {picked.length >= 2 && (
        <div className="compare-bar" role="region" aria-label="Compare selection">
          <span className="small">{picked.length} selected</span>
          <button type="button" className="btn" onClick={() => setCompare(picked)}>Compare side by side</button>
          <button type="button" className="btn ghost" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}
    </div>
  );
}

// ---------------- Manufacturer drawer ----------------
export function ManufacturerDrawer({ id, onClose }) {
  const { weights, brandId, canBrand, me, shortlist, toggleShortlist, toast } = useApp();
  const [m, setM] = useState(null);
  const [rfq, setRfq] = useState('');
  useEffect(() => { setM(null); api.get(`/manufacturers/${id}?w=${encodeURIComponent(JSON.stringify(weights))}`).then(setM); }, [id, weights]);
  const listed = shortlist.some((s) => s.manufacturerId === id);

  async function sendRfq() {
    const r = await api.post('/rfqs', { brandId, manufacturerId: id, message: rfq, kind: 'rfq' });
    setRfq(''); toast(`Quote request sent. ${r.emailed ? `${r.emailed.toName} at ${m.name} was emailed.` : ''} Their reply will appear under Quotes.`);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={m ? m.name : 'Manufacturer profile'} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        {!m ? <Spinner /> : (
          <div className="col" style={{ gap: 'var(--space-xl)' }}>
            <div className="col" style={{ gap: 'var(--space-xs)' }}>
              <span className="place">{m.city}, {m.country}{m.isNew ? '. New on Meridian Loop' : ''}</span>
              <h2>{m.name}</h2>
              <p className="muted">{m.description}</p>
              <div className="row wrap">
                <button type="button" className={`btn ${listed ? 'on' : ''}`} aria-pressed={listed} onClick={() => toggleShortlist(id)}><Icon name="star" size={16} />{listed ? 'Shortlisted' : 'Add to shortlist'}</button>
                <span className="small muted">Contact: {m.contact}</span>
              </div>
            </div>
            <dl className="facts">
              <div><dt>Minimum order</dt><dd>{m.moq} units</dd></div>
              <div><dt>Lead time</dt><dd>{m.leadTimeDays} days</dd></div>
              <div><dt>Samples</dt><dd>{m.sampleDays} days</dd></div>
              <div><dt>Monthly capacity</dt><dd>{m.capacity.toLocaleString()}</dd></div>
              <div><dt>On-time delivery</dt><dd>{Math.round(m.onTimeRate * 100)}%</dd></div>
              <div><dt>Defect rate</dt><dd>{(m.defectRate * 100).toFixed(1)}%</dd></div>
              <div><dt>Renewable energy</dt><dd>{m.renewableEnergy}%</dd></div>
              <div><dt>Water recycled</dt><dd>{m.waterRecycled}%</dd></div>
            </dl>
            <section className="card pad split-score" aria-label="Scores">
              <Radar series={[{ scores: m.scores }]} />
              <div className="col">
                <div className="row"><Ring value={m.quant} label="score" /><p className="small muted grow">{m.explanation} Weighted by your current priorities.</p></div>
                <DimBars scores={m.scores} />
              </div>
            </section>
            {m.flags.length > 0 && <section className="col"><h3>Check before you order</h3>{m.flags.map((f) => <Flag key={f.text} level={f.level}>{f.text}</Flag>)}</section>}
            <section>
              <h3>Certificates</h3>
              <div className="scroll-x">
                <table className="tbl" style={{ marginTop: 'var(--space-sm)' }}>
                  <thead><tr><th>Standard</th><th>Certificate no.</th><th>Valid until</th><th>Status</th><th>Issuer’s register</th></tr></thead>
                  <tbody>{m.certifications.map((c) => (
                    <tr key={c.name + c.id}><td><b>{c.name}</b><div className="small muted">{c.issuer}</div></td><td className="mono">{c.id}</td><td className="mono">{fmtDate(c.expires)}</td><td><CertBadge cert={{ ...c, state: c.status.state }} stateOnly />{c.evidence && <div className="small muted">from an uploaded document</div>}</td><td><RegisterCheck reg={c.registry} compact />{c.registry?.register && <div><a className="linkish" href={c.registry.register.url} target="_blank" rel="noopener" title={c.registry.note}>Look it up</a></div>}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
            <section className="field-row">
              <div><h3>Materials</h3><div className="chips" style={{ marginTop: 'var(--space-xs)' }}>{m.materials.map((x) => <span key={x} className="tag line">{x}</span>)}</div></div>
              <div><h3>Processes</h3><div className="chips" style={{ marginTop: 'var(--space-xs)' }}>{m.processes.map((x) => <span key={x} className="tag line">{x}</span>)}</div></div>
            </section>
            <section><h3>Makes</h3><p className="muted" style={{ marginTop: 'var(--space-2xs)' }}>{m.products}. Exports to {m.exportMarkets.join(', ')}.</p></section>
            {m.productsMade.length > 0 && <section><h3>Products made here</h3><div className="chips" style={{ marginTop: 'var(--space-xs)' }}>{m.productsMade.map((p) => <a key={p.id} className="chip" href={`#/shop/p/${p.id}`} onClick={onClose}>{p.name}, {p.brandName}</a>)}</div></section>}
            {m.documents.length > 0 && <section><h3>Uploaded documents</h3>{m.documents.map((d) => <div key={d.id} className="row small wrap" style={{ marginTop: 'var(--space-xs)' }}><Icon name="file" size={16} /><span className="grow">{d.label}, {fmtDate(d.createdAt)}</span>{d.fileId && <a className="linkish" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener">Open PDF</a>}</div>)}</section>}
            {!canBrand ? (
              <section className="well col">
                <h3>Request a quote</h3>
                <p className="muted">{me ? 'Quote requests come from brand accounts.' : 'Sign in as a brand to request a quote and keep a shortlist.'}</p>
                <div><button type="button" className="btn primary" onClick={() => askToSignIn()}>{me ? 'Switch to a brand account' : 'Sign in'}</button></div>
              </section>
            ) : (
            <section className="well col">
              <h3>Request a quote</h3>
              <label htmlFor="rfq-text" className="visually-hidden">Your message</label>
              <textarea id="rfq-text" className="textarea" value={rfq} onChange={(e) => setRfq(e.target.value)} placeholder={`Hi ${m.contact.split(',')[0]}, we’re looking for (style, quantity, target price, deadline)`} />
              <div><button type="button" className="btn primary" disabled={!rfq.trim()} onClick={sendRfq}>Send quote request</button></div>
            </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Compare ----------------
export function CompareModal({ ids, onClose }) {
  const { weights, openManufacturer } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.post('/compare', { ids, weights }).then(setRows); }, [ids, weights]);
  const best = (vals, higher = true) => { const v = higher ? Math.max(...vals) : Math.min(...vals); return vals.map((x) => x === v); };
  const line = (label, get, higher = true, fmt = (x) => x) => {
    const vals = rows.map(get); const b = best(vals, higher);
    return <tr key={label}><td className="muted">{label}</td>{vals.map((v, i) => <td key={i} className={`mono ${b[i] && rows.length > 1 ? 'best' : ''}`}>{fmt(v)}</td>)}</tr>;
  };
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Side-by-side comparison" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Side by side</h2>
        {!rows ? <Spinner /> : (
          <div className="two" style={{ gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)' }}>
            <div className="card pad">
              <Radar series={rows.map((r) => ({ scores: r.scores }))} />
              <div className="col" style={{ gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>{rows.map((r, i) => <div key={r.id} className="row small"><i className={`key s${i % 4}`} />{r.name}</div>)}</div>
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th><span className="visually-hidden">Measure</span></th>{rows.map((r) => <th key={r.id}><button type="button" className="linkish" onClick={() => openManufacturer(r.id)}>{r.name}</button><div className="small muted">{r.country}</div></th>)}</tr></thead>
                <tbody>
                  {line('Weighted score', (r) => r.quant)}
                  {Object.entries(DIM_LABELS).map(([k, l]) => line(l, (r) => r.scores[k]))}
                  {line('Minimum order', (r) => r.moq, false)}
                  {line('Lead time (days)', (r) => r.leadTimeDays, false)}
                  {line('Price tier', (r) => r.priceIndex, false, dollars)}
                  {line('On-time delivery', (r) => r.onTimeRate, true, (x) => `${Math.round(x * 100)}%`)}
                  {line('Defect rate', (r) => r.defectRate, false, (x) => `${(x * 100).toFixed(1)}%`)}
                  {line('Renewable energy', (r) => r.renewableEnergy, true, (x) => `${x}%`)}
                  <tr><td className="muted">Certificates</td>{rows.map((r) => <td key={r.id}><div className="col" style={{ gap: 'var(--space-2xs)', alignItems: 'flex-start' }}>{r.certifications.map((c) => <CertBadge key={c.name} cert={{ ...c, state: c.status.state }} />)}</div></td>)}</tr>
                  <tr><td className="muted">Check first</td>{rows.map((r) => <td key={r.id}>{r.flags.filter((f) => f.level !== 'low').map((f) => <div key={f.text}>{f.text}</div>)}{!r.flags.some((f) => f.level !== 'low') && <span className="muted">Nothing flagged</span>}</td>)}</tr>
                </tbody>
              </table>
              <p className="small muted" style={{ marginTop: 'var(--space-sm)' }}>“best” marks the strongest value in each row, using your current priorities.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Shortlist workspace ----------------
function Shortlist() {
  const { shortlist, setShortlist, openManufacturer, setCompare, toggleShortlist, brandId } = useApp();
  const [details, setDetails] = useState({});
  useEffect(() => {
    for (const s of shortlist) if (!details[s.manufacturerId]) api.get(`/manufacturers/${s.manufacturerId}`).then((m) => setDetails((d) => ({ ...d, [m.id]: m })));
  }, [shortlist]);
  if (!shortlist.length) return <div className="empty"><h2>Your shortlist is empty</h2><p className="muted">Star manufacturers from the assistant or the ranking to compare them here and keep notes for your team.</p><button type="button" className="btn primary" onClick={() => go('/brand/discover')}>Rank manufacturers</button></div>;
  return (
    <div className="col" style={{ gap: 'var(--space-md)' }}>
      <div className="row"><p className="muted grow">Notes save when you click away.</p>{shortlist.length >= 2 && <button type="button" className="btn primary" onClick={() => setCompare(shortlist.map((s) => s.manufacturerId).slice(0, 4))}>Compare {Math.min(4, shortlist.length)} side by side</button>}</div>
      {shortlist.map((s) => { const m = details[s.manufacturerId]; return (
        <div key={s.manufacturerId} className="card pad row" style={{ alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
          {m ? <Ring value={m.quant} label="score" /> : <Spinner />}
          <div className="grow col">
            <div className="row"><h3 className="grow">{m?.name || 'Loading…'}</h3><button type="button" className="btn sm" onClick={() => openManufacturer(s.manufacturerId)}>Open profile</button><button type="button" className="btn ghost sm" onClick={() => toggleShortlist(s.manufacturerId)}>Remove</button></div>
            {m && <span className="small muted">{m.city}, {m.country}. MOQ {m.moq}, {m.leadTimeDays} days, {m.certifications.length} certificates{m.flags.some((f) => f.level === 'high') ? ', one has expired' : ''}.</span>}
            <label htmlFor={`note-${s.manufacturerId}`} className="visually-hidden">Team notes</label>
            <textarea id={`note-${s.manufacturerId}`} className="textarea" placeholder="Team notes, for example: ask for lab dips in sage green" defaultValue={s.note} onBlur={(e) => api.patch(`/shortlist/${s.manufacturerId}`, { note: e.target.value, brandId }).then(setShortlist)} />
          </div>
        </div>
      ); })}
    </div>
  );
}

// ---------------- Quotes (RFQs) ----------------
function BrandRfqs({ brandId }) {
  const { toast } = useApp();
  const [rfqs, setRfqs] = useState(null);
  const load = () => api.get(`/rfqs?brandId=${brandId}`).then(setRfqs);
  useEffect(() => { load(); }, [brandId]);
  if (!rfqs) return <div className="skeleton" />;
  if (!rfqs.length) return <div className="empty"><h2>No quote requests yet</h2><p className="muted">Open a manufacturer’s profile and send a quote request. Replies and proposals from manufacturers appear here.</p><button type="button" className="btn primary" onClick={() => go('/brand/discover')}>Rank manufacturers</button></div>;
  return (
    <div className="col" style={{ gap: 'var(--space-md)' }}>
      {rfqs.map((r) => (
        <div key={r.id} className="card pad">
          <div className="row wrap"><b className="grow">{r.kind === 'proposal' ? `Proposal from ${r.manufacturerName}` : `Quote request to ${r.manufacturerName}`}{r.requestTitle ? `: ${r.requestTitle}` : ''}</b><span className={`tag ${r.status === 'quoted' ? 'mint' : 'line'}`}>{r.status}</span><span className="small muted mono">{fmtDate(r.createdAt)}</span></div>
          <div className="thread">
            <div className={`m ${r.kind === 'proposal' ? 'them' : ''}`}>{r.message}</div>
            {r.replies.map((x, i) => <div key={i} className={`m ${x.from === 'manufacturer' ? 'them' : ''}`}><span className="from">{x.from === 'manufacturer' ? r.manufacturerName : 'You'}</span>{x.text}</div>)}
          </div>
          <Reply onSend={(text) => api.post(`/rfqs/${r.id}/reply`, { from: 'brand', text }).then((x) => { load(); if (x.emailed) toast(`Reply sent. ${x.emailed.toName} was emailed.`); })} />
        </div>
      ))}
    </div>
  );
}

export function Reply({ onSend, placeholder = 'Write a reply', actions }) {
  const [t, setT] = useState('');
  return (
    <form className="row" style={{ marginTop: 'var(--space-sm)' }} onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onSend(t); setT(''); } }}>
      <input className="input" aria-label="Reply" value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} />
      {actions}
      <button type="submit" className="btn" disabled={!t.trim()}>Send</button>
    </form>
  );
}

// ---------------- Post a sourcing request ----------------
function PostRequest({ brand }) {
  const { toast } = useApp();
  const empty = { title: '', category: 'Fashion', materials: '', quantity: 500, targetPrice: '', deadline: '', requirements: '', preferredCountries: [] };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    await api.post('/requests', { ...f, brandId: brand.id, materials: f.materials.split(',').map((x) => x.trim()) });
    setF(empty); toast('Request posted. Manufacturers who fit it will see it in their demand feed.');
  }
  return (
    <div className="two">
      <form className="card pad col" onSubmit={submit}>
        <h2 className="section-title">New sourcing request</h2>
        <p className="small muted">Manufacturers searching for work will find it, ranked by how well they fit.</p>
        <label className="field">What do you need?<input className="input" required value={f.title} onChange={set('title')} placeholder="For example: organic linen summer shirt" /></label>
        <div className="field-row">
          <label className="field">Category<select className="select" value={f.category} onChange={set('category')}>{['Fashion', 'Footwear', 'Accessories', 'Home Textiles'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Quantity (units)<input className="input" type="number" inputMode="numeric" min="1" required value={f.quantity} onChange={set('quantity')} /></label>
        </div>
        <label className="field">Materials, separated by commas<input className="input" value={f.materials} onChange={set('materials')} placeholder="linen, organic cotton" /></label>
        <div className="field-row">
          <label className="field">Target price<input className="input" value={f.targetPrice} onChange={set('targetPrice')} placeholder="US$12 to 15" /></label>
          <label className="field">Deadline<input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></label>
        </div>
        <label className="field">Requirements<textarea className="textarea" value={f.requirements} onChange={set('requirements')} placeholder="Certifications, finishes, packaging" /></label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 'var(--space-2xs)' }}>Preferred countries</legend>
          <div className="chips">{['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia'].map((c) => <button type="button" key={c} className={`chip ${f.preferredCountries.includes(c) ? 'on' : ''}`} aria-pressed={f.preferredCountries.includes(c)} onClick={() => setF({ ...f, preferredCountries: f.preferredCountries.includes(c) ? f.preferredCountries.filter((x) => x !== c) : [...f.preferredCountries, c] })}>{c}</button>)}</div>
        </fieldset>
        <div><button type="submit" className="btn primary">Post request</button></div>
      </form>
      <div className="col">
        <h2 className="section-title">{brand?.name}’s open requests</h2>
        {brand?.sourcingRequests.map((r) => (
          <div key={r.id} className="well">
            <b>{r.title}</b>
            <div className="small muted">{r.category}, {r.quantity} units, {r.targetPrice || 'price open'}, due {r.deadline || 'when ready'}</div>
            <p className="small" style={{ marginTop: 'var(--space-xs)' }}>{r.requirements}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
