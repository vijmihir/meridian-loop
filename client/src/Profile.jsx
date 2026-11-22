import { useEffect, useState } from 'react';
import { api, fmtMoney, certLabel } from './api.js';
import { go, useApp } from './App.jsx';
import { materialPhoto } from './photos.js';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not given');
const place = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);
const certState = (c) => (c.validUntil && new Date(c.validUntil) < new Date() ? 'expired' : c.check?.status || 'given');
const LEVEL = { documented: 'Documented', 'self-declared': 'Self-declared', unknown: 'Not known' };

export default function Profile({ kind, id }) {
  const { user, notify, track } = useApp();
  const [p, setP] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState('');
  const load = () => {
    setError('');
    api.get(kind === 'maker' ? `/manufacturers/${id}` : `/brands/${id}`).then(setP).catch((e) => setError(e.status === 404 ? 'This company isn’t on Meridian Loop.' : e.message));
    api.get(`/companies/${id}/documents`).then(setDocs).catch(() => setDocs([]));
  };
  useEffect(() => { setP(null); load(); track('profile_view', id); }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function check(cert) {
    setChecking(cert);
    try { const r = await api.post('/certificates/check', { makerId: id, cert }); notify(r.certificate.check.status === 'checked' ? `${cert} confirmed in the register.` : `${cert} was not found in the register.`); load(); }
    catch (e) { notify(e.message); }
    setChecking('');
  }

  const back = <a className="back" href="#" onClick={(e) => { e.preventDefault(); history.length > 1 ? history.back() : (window.location.hash = '/'); }}>Back</a>;
  if (error) return <div className="wrap">{back}<p className="notice">{error}</p></div>;
  if (!p) return <div className="wrap">{back}<div className="skeleton" /></div>;

  const subject = kind === 'maker' ? 'Enquiry from Meridian Loop' : `${p.name} on Meridian Loop`;
  const canCheck = user && (user.role === 'team' || user.id === id);
  const quoteHref = `#/quotes/new?makers=${id}`;
  return (
    <div className="wrap">
      {back}
      <div className="profile-head">
        <div>
          <h1>{p.name}</h1>
          <p className="where">{kind === 'maker' ? 'Manufacturer' : 'Clothing brand'} in {place(p)}, since {p.founded}</p>
          {kind === 'maker' && (
            <div className="tags">
              {p.dppReady && <span className="pill">Passport-ready</span>}
              {p.certifications.some((c) => certState(c) === 'checked') && <span className="pill">Certificates checked</span>}
              {p.certifications.some((c) => ['expired', 'not-found'].includes(certState(c))) && <span className="pill pill--warn">A certificate needs attention</span>}
              {p.whatsapp && <span className="pill plain">Replies on WhatsApp</span>}
            </div>
          )}
          <p className="about">{p.about}</p>
        </div>
        <aside className="contact" aria-label="Contact">
          <span className="label">Contact</span>
          <b>{p.contact}</b>
          {kind === 'maker' && p.languages && <span className="muted">Speaks {p.languages.join(', ')}</span>}
          <div className="btn-row">
            {kind === 'maker' && user?.role === 'brand' && <a className="btn" href={quoteHref}>Request a quote</a>}
            {kind === 'maker' && !user && <a className="btn" href={`#/signin?next=${encodeURIComponent(quoteHref.slice(1))}`}>Sign in to request a quote</a>}
            {p.email && <a className={kind === 'maker' && user?.role !== 'maker' ? 'btn btn-quiet' : 'btn'} href={`mailto:${p.email}?subject=${encodeURIComponent(subject)}`} onClick={() => track('enquiry', id)}>Email {p.contact.split(' ')[0]}</a>}
            {kind === 'maker' && p.whatsapp && <a className="link" href={`#/whatsapp?as=${id}`}>Ask on WhatsApp</a>}
          </div>
        </aside>
      </div>
      {(() => {
        const ph = materialPhoto(kind === 'maker' ? `${p.makes} ${p.materials.join(' ')}` : p.needs.map((n) => `${n.title} ${n.materials.join(' ')}`).join(' '));
        const own = docs.find((d) => d.kind === 'photo' && d.type.startsWith('image/'));
        return own ? (
          <figure className="photo"><div className="photo-frame"><img src={`/api/documents/${own.id}`} alt={own.name} /></div><figcaption>{own.name}</figcaption></figure>
        ) : (
          <figure className="photo">
            <div className="photo-frame" data-slot="company"><img src={ph.src} srcSet={ph.srcSet} sizes="(min-width: 72rem) 68rem, 100vw" alt={ph.alt} style={{ objectPosition: ph.position }} /></div>
            <figcaption>Stand-in photograph of {ph.subject}, shown until {p.name} adds its own. Photo: <a href={ph.page} rel="noopener">{ph.credit}</a>, {ph.license}.</figcaption>
          </figure>
        );
      })()}

      {kind === 'maker' ? (
        <>
          <section className="section">
            <h2>What they make and on what terms</h2>
            <dl className="spec">
              <div><dt>Products</dt><dd>{p.makes}</dd></div>
              <div><dt>Materials</dt><dd>{p.materials.join(', ')}</dd></div>
              <div><dt>Processes</dt><dd>{p.processes.length ? p.processes.join(', ') : 'Not listed'}</dd></div>
              <div><dt>Price</dt><dd className="num">{p.priceRange ? `${fmtMoney(p.priceRange.from)} to ${fmtMoney(p.priceRange.to)} a ${p.priceRange.unit}` : 'On request'}</dd></div>
              <div><dt>Minimum order</dt><dd className="num">{p.moq.toLocaleString()} units, {p.moqPerColour?.toLocaleString()} a colour</dd></div>
              <div><dt>Lead time</dt><dd className="num">{p.leadTimeDays} days</dd></div>
              <div><dt>Samples</dt><dd className="num">{p.sampleCost != null ? `${fmtMoney(p.sampleCost)}, ready in ${p.sampleDays} days` : 'On request'}</dd></div>
              <div><dt>Capacity</dt><dd className="num">{p.capacityPerMonth?.toLocaleString()} units a month</dd></div>
              <div><dt>Shipping terms</dt><dd>{(p.incoterms || []).join(', ')}</dd></div>
            </dl>
          </section>
          {p.traceability && (
            <section className="section">
              <h2>Traceability, fibre to garment</h2>
              <ol className="trace">{p.traceability.map((t) => <li key={t.stage} className={`trace--${t.level}`}><b>{t.stage}</b><span>{LEVEL[t.level]}</span></li>)}</ol>
              <p className="muted small">{p.dppReady ? 'Every stage is documented and a fibre certificate is confirmed in its register, so this manufacturer can supply the data an EU digital product passport needs.' : 'Not every stage is documented yet, so a digital product passport would have gaps.'}</p>
            </section>
          )}
          {p.certifications.length > 0 && (
            <section className="section">
              <h2>Certificates</h2>
              <table className="cert-table">
                <thead><tr><th>Standard</th><th>Issued by</th><th>Valid until</th><th>Status</th>{canCheck && <th><span className="visually-hidden">Action</span></th>}</tr></thead>
                <tbody>{p.certifications.map((c) => { const st = certState(c); return (
                  <tr key={c.name}><td>{c.name}</td><td>{c.issuer}</td><td>{fmtDate(c.validUntil)}</td>
                    <td><span className={`cert-chip cert-chip--${st}`}>{certLabel[st]}</span>{c.check?.on && st !== 'expired' && <span className="where"> {fmtDate(c.check.on)}</span>}</td>
                    {canCheck && <td>{st !== 'expired' && <button type="button" className="text-btn" disabled={checking === c.name} onClick={() => check(c.name)}>{checking === c.name ? 'Checking' : 'Check in the register'}</button>}</td>}
                  </tr>); })}</tbody>
              </table>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="section">
            <h2>What they’re looking for</h2>
            <div className="needs">
              {p.needs.map((n) => (
                <article key={n.title} className="need">
                  <h3>{n.title}</h3>
                  {n.detail && <p>{n.detail}</p>}
                  <p className="facts"><span>Quantity <b>{n.quantity.toLocaleString()}</b></span><span>Target <b>{n.target}</b></span>{n.countries.length > 0 && <span>Prefers <b>{n.countries.join(', ')}</b></span>}</p>
                  {(n.materials.length > 0 || n.certifications.length > 0) && <div className="tags">{[...n.materials, ...n.certifications].map((t) => <span key={t} className="pill plain">{t}</span>)}</div>}
                  <a className="link" href={`#/?q=${encodeURIComponent(`${n.title}, ${n.quantity} units${n.certifications.length ? `, ${n.certifications.join(' ')}` : ''}`)}`}>Find manufacturers for this</a>
                </article>
              ))}
            </div>
          </section>
          <section className="section">
            <h2>About the brand</h2>
            <dl className="spec">
              <div><dt>Sells</dt><dd>{p.sells}</dd></div>
              {p.values.length > 0 && <div><dt>Cares about</dt><dd>{p.values.join(', ')}</dd></div>}
            </dl>
          </section>
        </>
      )}
      {docs.length > 0 && (
        <section className="section">
          <h2>Documents</h2>
          <ul className="doc-list">{docs.map((d) => <li key={d.id}><a href={`/api/documents/${d.id}`} target="_blank" rel="noopener">{d.name}</a><span className="where">{d.kind}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
