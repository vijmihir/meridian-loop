import { useEffect, useState } from 'react';
import { api, fmtMoney, certLabel } from './api.js';
import { go, useApp } from './App.jsx';
import { t, getLang } from './i18n.js';

const ago = (iso) => {
  const h = (Date.now() - new Date(iso)) / 36e5;
  return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`;
};
const STATUS = { open: 'Open', awarded: 'Awarded', closed: 'Closed' };

export default function Quotes({ id, params }) {
  const { user } = useApp();
  useEffect(() => { if (user === null) go(`/signin?next=${encodeURIComponent(window.location.hash.slice(1))}`); }, [user]);
  if (!user) return <div className="wrap"><div className="skeleton" /></div>;
  if (user.role === 'team') return <div className="wrap"><p className="notice">The team account does not send or answer quote requests. Sign in as a brand or a manufacturer.</p></div>;
  if (id === 'new') return <NewRequest params={params} />;
  if (id) return <Detail id={id} />;
  return <List />;
}

function List() {
  const { user } = useApp();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/rfqs').then(setRows).catch((e) => setError(e.message)); }, []);
  const brand = user.role === 'brand';
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>{brand ? 'Your quote requests' : 'Quote requests for you'}</h1>
          <p>{brand ? 'Send one brief to several manufacturers and compare their replies side by side.' : 'Brands that asked you to quote. Reply here or on WhatsApp.'}</p>
        </div>
        {brand && <a className="btn" href="#/quotes/new">New quote request</a>}
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {!rows ? <div className="skeleton" /> : rows.length === 0 ? (
        <div className="empty-state"><p>{brand ? 'No requests yet. Save manufacturers to your shortlist in the assistant, then ask them all for a quote at once.' : 'No requests yet. Brands find you through the assistant and the directory.'}</p>
          {brand && <a className="link" href="#/">Open the assistant</a>}</div>
      ) : (
        <ul className="rfq-list">
          {rows.map((r) => (
            <li key={r.id}>
              <a href={`#/quotes/${r.id}`}>
                <span className="rfq-main"><b>{r.title}</b><span className="where">{brand ? `${r.counts.invited} manufacturers asked, ${ago(r.createdAt)}` : `${r.brand?.name}, ${r.brand?.city}, ${ago(r.createdAt)}`}</span></span>
                <span className="rfq-qty num">{r.quantity.toLocaleString()} units</span>
                {brand
                  ? <span className="rfq-state"><span className={`state state--${r.status}`}>{STATUS[r.status]}</span><span className="where">{r.counts.quoted} quoted, {r.counts.waiting} waiting{r.bestPrice != null ? `, best ${fmtMoney(r.bestPrice)}` : ''}</span></span>
                  : <span className="rfq-state"><span className={`state state--${r.myQuote?.status || 'requested'}`}>{r.myQuote?.status === 'quoted' ? `You quoted ${fmtMoney(r.myQuote.unitPrice)}` : r.myQuote?.status === 'declined' ? 'You declined' : r.status === 'open' ? 'Waiting for your quote' : STATUS[r.status]}</span></span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewRequest({ params }) {
  const { notify } = useApp();
  const pre = (params.get('makers') || '').split(',').filter(Boolean);
  const [makers, setMakers] = useState(null);
  const [f, setF] = useState({ title: params.get('title') || '', detail: '', quantity: params.get('qty') || '', target: '', materials: '', certifications: params.get('certs') || '', deadline: '', makerIds: pre });
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/manufacturers').then(setMakers).catch(() => setMakers([])); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (mid) => setF((x) => ({ ...x, makerIds: x.makerIds.includes(mid) ? x.makerIds.filter((y) => y !== mid) : x.makerIds.length >= 8 ? x.makerIds : [...x.makerIds, mid] }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({});
    try { const r = await api.post('/rfqs', f); notify(`Sent to ${r.counts.invited} manufacturers.`); go(`/quotes/${r.id}`); }
    catch (err) { setErrors(err.fields || { title: err.message }); }
    setBusy(false);
  }
  const words = q.trim().toLowerCase();
  const pickable = (makers || []).filter((m) => f.makerIds.includes(m.id) || (words && `${m.name} ${m.makes} ${m.country} ${m.materials.join(' ')}`.toLowerCase().includes(words)));
  return (
    <div className="wrap narrow-page">
      <a className="back" href="#/quotes">All quote requests</a>
      <div className="page-head"><div><h1>New quote request</h1><p>One brief, up to eight manufacturers. Each one gets a note in their inbox and an email.</p></div></div>
      <form className="account-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>The brief</legend>
          <label className="field">What you want made<input className="input" name="title" value={f.title} onChange={set('title')} aria-invalid={errors.title ? true : undefined} placeholder="Organic cotton crew tees" /><span className="error">{errors.title}</span></label>
          <label className="field">Details<textarea className="textarea" value={f.detail} onChange={set('detail')} placeholder="Fit, weight, colours, packing, timing" /></label>
          <div className="two">
            <label className="field">Quantity<input className="input" name="quantity" type="number" inputMode="numeric" value={f.quantity} onChange={set('quantity')} aria-invalid={errors.quantity ? true : undefined} /><span className="error">{errors.quantity}</span></label>
            <label className="field">Target price<input className="input" value={f.target} onChange={set('target')} placeholder="US$4 to 6" /></label>
          </div>
          <div className="two">
            <label className="field">Materials<input className="input" value={f.materials} onChange={set('materials')} placeholder="organic cotton" /></label>
            <label className="field">Certificates needed<input className="input" value={f.certifications} onChange={set('certifications')} placeholder="GOTS" /></label>
          </div>
          <label className="field">Reply by<input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></label>
        </fieldset>
        <fieldset>
          <legend>Manufacturers ({f.makerIds.length} of 8)</legend>
          <label className="field">Find a manufacturer<input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, product or country" /></label>
          <span className="error">{errors.makerIds}</span>
          <ul className="pick-list pick-list--check">
            {pickable.slice(0, 20).map((m) => (
              <li key={m.id}><label>
                <input type="checkbox" checked={f.makerIds.includes(m.id)} onChange={() => toggle(m.id)} />
                <span><b>{m.name}</b><span className="where">{m.city}, {m.country}. {m.makes}. From {m.moq.toLocaleString()}, {m.leadTimeDays} days{m.priceRange ? `, ${fmtMoney(m.priceRange.from)} to ${fmtMoney(m.priceRange.to)}` : ''}</span></span>
              </label></li>
            ))}
            {!pickable.length && <li className="muted small">Type above to find manufacturers, or open one from the assistant’s shortlist.</li>}
          </ul>
        </fieldset>
        <div><button type="submit" className="btn" disabled={busy}>{busy ? 'Sending' : `Send to ${f.makerIds.length || ''} manufacturers`.replace('  ', ' ')}</button></div>
      </form>
    </div>
  );
}

function Detail({ id }) {
  const { user, notify, track } = useApp();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => api.get(`/rfqs/${id}`).then((x) => { setR(x); if (user.role === 'brand' && x.counts.quoted >= 2) track('quotes_compared', id); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(path, body, msg) {
    setBusy(path);
    try { await api.post(`/rfqs/${id}/${path}`, body); if (msg) notify(msg); await load(); } catch (e) { notify(e.message); }
    setBusy('');
  }
  if (error) return <div className="wrap"><a className="back" href="#/quotes">All quote requests</a><p className="notice" role="alert">{error}</p></div>;
  if (!r) return <div className="wrap"><div className="skeleton" /></div>;
  const brand = user.role === 'brand';
  const byMaker = Object.fromEntries(r.quotes.map((q) => [q.makerId, q]));
  const quoted = r.makers.filter((m) => byMaker[m.id]?.status === 'quoted');
  const best = (k, dir = 1) => (quoted.length ? quoted.map((m) => byMaker[m.id][k]).filter((v) => v != null).sort((a, b) => dir * (a - b))[0] : null);
  const bestPrice = best('unitPrice'), fastest = best('leadTimeDays'), lowestMoq = best('moq');

  return (
    <div className="wrap">
      <a className="back" href="#/quotes">All quote requests</a>
      <div className="page-head">
        <div>
          <h1>{r.title}</h1>
          <p>{r.quantity.toLocaleString()} units{r.target ? `, target ${r.target}` : ''}{r.certifications.length ? `, needs ${r.certifications.join(', ')}` : ''}. {brand ? `Sent ${ago(r.createdAt)}.` : `From ${r.brand?.name}, ${r.brand?.city}.`}</p>
        </div>
        <span className={`state state--${r.status} state--lg`}>{STATUS[r.status]}{r.awardedTo ? `: ${r.makers.find((m) => m.id === r.awardedTo)?.name}` : ''}</span>
      </div>
      {r.detail && <p className="lead-text">{r.detail}</p>}

      {brand ? (<>
        <div className="sheet-head">
          <h2>{r.counts.quoted} of {r.counts.invited} quoted{r.counts.waiting ? `, ${r.counts.waiting} waiting` : ''}</h2>
          {r.status === 'open' && r.counts.waiting > 0 && <button type="button" className="btn btn-quiet" disabled={Boolean(busy)} onClick={() => act('simulate', {}, 'Replies are in.')}>{busy === 'simulate' ? 'Asking' : 'Simulate replies'}</button>}
          {r.status === 'open' && <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => act('close', {}, 'Request closed.')}>Close request</button>}
        </div>
        <div className="compare-wrap" role="region" aria-label="Quotes side by side" tabIndex={0}>
          <table className="compare quotes-table">
            <thead><tr><td />{r.makers.map((m) => <th key={m.id} scope="col"><a href={`#/m/${m.id}`}>{m.name}</a><span className="where">{m.city}, {m.country}</span></th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Reply</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id}><span className={`state state--${q?.status || 'requested'}`}>{q?.status === 'quoted' ? 'Quoted' : q?.status === 'declined' ? 'Declined' : 'Waiting'}</span>{q && q.status !== 'requested' && <span className="where"> {ago(q.at)}{q.via === 'whatsapp' ? ', on WhatsApp' : ''}</span>}</td>; })}</tr>
              <tr><th scope="row">Price a piece</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id} className={q?.unitPrice === bestPrice && q?.status === 'quoted' ? 'best' : ''}>{q?.status === 'quoted' ? <span className="num">{fmtMoney(q.unitPrice)}</span> : ''}</td>; })}</tr>
              <tr><th scope="row">Order total</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id}>{q?.status === 'quoted' ? <span className="num">{fmtMoney(Math.round(q.unitPrice * Math.max(r.quantity, q.moq)))}</span> : ''}</td>; })}</tr>
              <tr><th scope="row">Minimum order</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id} className={q?.moq === lowestMoq && q?.status === 'quoted' ? 'best' : ''}>{q?.status === 'quoted' ? <span className="num">{q.moq.toLocaleString()}</span> : ''}</td>; })}</tr>
              <tr><th scope="row">Lead time</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id} className={q?.leadTimeDays === fastest && q?.status === 'quoted' ? 'best' : ''}>{q?.status === 'quoted' ? <span className="num">{q.leadTimeDays} days</span> : ''}</td>; })}</tr>
              <tr><th scope="row">Samples</th>{r.makers.map((m) => { const q = byMaker[m.id]; return <td key={m.id}>{q?.status === 'quoted' && q.sampleCost != null ? <span className="num">{fmtMoney(q.sampleCost)}, {q.sampleDays} days</span> : ''}</td>; })}</tr>
              <tr><th scope="row">Terms</th>{r.makers.map((m) => <td key={m.id}>{byMaker[m.id]?.incoterm || ''}</td>)}</tr>
              <tr><th scope="row">Certificates</th>{r.makers.map((m) => <td key={m.id}>{m.certifications.map((c) => <span key={c.name} className={`cert-chip cert-chip--${c.state}`} title={certLabel[c.state]}>{c.name}</span>)}</td>)}</tr>
              <tr><th scope="row">Note</th>{r.makers.map((m) => <td key={m.id} className="note-cell">{byMaker[m.id]?.note || ''}</td>)}</tr>
            </tbody>
            {r.status === 'open' && quoted.length > 0 && (
              <tfoot><tr><td />{r.makers.map((m) => <td key={m.id}>{byMaker[m.id]?.status === 'quoted' && <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => { if (confirm(`Choose ${m.name}? The others are told you went with another quote.`)) act('award', { makerId: m.id }, `You chose ${m.name}.`); }}>Choose</button>}</td>)}</tr></tfoot>
            )}
          </table>
        </div>
        <p className="muted small">The best price, lowest minimum and fastest lead time are marked. “Simulate replies” asks the dummy manufacturers to answer from their profiles: some decline when the run is too small or a certificate is missing.</p>
      </>) : <MakerReply r={r} mine={byMaker[user.id]} onSent={load} />}
    </div>
  );
}

function MakerReply({ r, mine, onSent }) {
  const { notify } = useApp();
  const lang = getLang();
  const [f, setF] = useState({ unitPrice: '', moq: '', leadTimeDays: '', sampleCost: '', sampleDays: '', incoterm: 'FOB', note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function send(status) {
    setBusy(true); setErrors({});
    try { await api.post(`/rfqs/${r.id}/quote`, { ...f, status }); notify(status === 'declined' ? 'Request declined.' : 'Quote sent.'); onSent(); }
    catch (err) { setErrors(err.fields || { note: err.message }); }
    setBusy(false);
  }
  if (mine?.status === 'quoted' || mine?.status === 'declined' || r.status !== 'open') {
    return (
      <section className="panel-box">
        <h2>{t('yourQuote', lang)}</h2>
        {mine?.status === 'quoted' ? <dl className="spec">
          <div><dt>{t('price', lang)}</dt><dd className="num">{fmtMoney(mine.unitPrice)}</dd></div>
          <div><dt>{t('moq', lang)}</dt><dd className="num">{mine.moq.toLocaleString()}</dd></div>
          <div><dt>{t('lead', lang)}</dt><dd className="num">{mine.leadTimeDays}</dd></div>
          {mine.note && <div><dt>{t('note', lang)}</dt><dd>{mine.note}</dd></div>}
        </dl> : mine?.status === 'declined' ? <p>You declined this request.{mine.note ? ` “${mine.note}”` : ''}</p> : <p>This request is {r.status}.</p>}
      </section>
    );
  }
  const F = (k, type = 'number') => <label className="field">{t(k === 'unitPrice' ? 'price' : k === 'leadTimeDays' ? 'lead' : k, lang)}<input className="input" name={k} type={type} step="0.01" inputMode="decimal" value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} /><span className="error">{errors[k]}</span></label>;
  return (
    <form className="account-form panel-box" onSubmit={(e) => { e.preventDefault(); send('quoted'); }} noValidate>
      <h2>{t('yourQuote', lang)}</h2>
      <div className="two">{F('unitPrice')}{F('moq')}</div>
      <div className="two">{F('leadTimeDays')}<label className="field">{t('terms', lang)}<select className="select" value={f.incoterm} onChange={set('incoterm')}>{['EXW', 'FOB', 'CIF', 'DAP', 'DDP'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
      <div className="two">{F('sampleCost')}{F('sampleDays')}</div>
      <label className="field">{t('note', lang)}<textarea className="textarea" value={f.note} onChange={set('note')} /><span className="error">{errors.note}</span></label>
      <div className="btn-row">
        <button type="submit" className="btn" disabled={busy}>{t('sendQuote', lang)}</button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => send('declined')}>{t('decline', lang)}</button>
      </div>
      <p className="muted small">You can also reply on WhatsApp: QUOTE {r.id.slice(-4)} price minimum days.</p>
    </form>
  );
}
