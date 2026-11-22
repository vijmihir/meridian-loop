import { useEffect, useState } from 'react';
import { api } from './api.js';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Self-reported');
const place = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);

export default function Profile({ kind, id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setP(null); setError('');
    api.get(kind === 'maker' ? `/manufacturers/${id}` : `/brands/${id}`).then(setP).catch(() => setError('This company isn’t on Meridian Loop.'));
  }, [kind, id]);

  const back = <a className="back" href="#" onClick={(e) => { e.preventDefault(); history.length > 1 ? history.back() : (window.location.hash = '/'); }}>Back</a>;
  if (error) return <div className="wrap">{back}<p className="notice">{error}</p></div>;
  if (!p) return <div className="wrap">{back}<div className="skeleton" /></div>;

  const subject = kind === 'maker' ? `Enquiry from Meridian Loop` : `${p.name} on Meridian Loop`;
  return (
    <div className="wrap">
      {back}
      <div className="profile-head">
        <div>
          <h1>{p.name}</h1>
          <p className="where">{kind === 'maker' ? 'Manufacturer' : 'Clothing brand'} in {place(p)}, since {p.founded}</p>
          <p className="about">{p.about}</p>
        </div>
        <aside className="contact" aria-label="Contact">
          <span className="label">Contact</span>
          <b>{p.contact}</b>
          <span className="muted">{p.email}</span>
          <a className="btn" href={`mailto:${p.email}?subject=${encodeURIComponent(subject)}`}>Get in touch</a>
        </aside>
      </div>

      {kind === 'maker' ? (
        <>
          <section className="section">
            <h2>What they make</h2>
            <dl className="spec">
              <div><dt>Products</dt><dd>{p.makes}</dd></div>
              <div><dt>Materials</dt><dd>{p.materials.join(', ')}</dd></div>
              <div><dt>Processes</dt><dd>{p.processes.length ? p.processes.join(', ') : 'Not listed'}</dd></div>
              <div><dt>Minimum order</dt><dd>{p.moq.toLocaleString()} units</dd></div>
              <div><dt>Lead time</dt><dd>{p.leadTimeDays} days</dd></div>
            </dl>
          </section>
          {p.certifications.length > 0 && (
            <section className="section">
              <h2>Certifications</h2>
              <table className="cert-table">
                <thead><tr><th>Standard</th><th>Issued by</th><th>Valid until</th></tr></thead>
                <tbody>{p.certifications.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.issuer}</td><td>{fmtDate(c.validUntil)}</td></tr>)}</tbody>
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
    </div>
  );
}
