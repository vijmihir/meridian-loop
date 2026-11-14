import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useApp, Highlight } from './ui.jsx';

const KIND_LABEL = { manufacturer: 'Supplier profiles and certificates', request: 'Brand sourcing requests', brand: 'Brand stories', product: 'Product passports', glossary: 'Standards explained' };

const STEPS = [
  ['Read the brief', 'Plain words become filters: material, product type, country, certificates, minimum order, lead time, price.'],
  ['Search everything', 'Every profile, certificate, audit, request and product is one searchable library. Related terms are added, and typos still match.'],
  ['Score the options', 'Each manufacturer gets seven scores. Your priorities weight them into one ranking.'],
  ['Check the proof', 'Each certificate number is looked up in its issuer’s register. Withdrawn, expired or mismatched ones are flagged before anyone orders.'],
  ['Answer with sources', 'The reply names the top options and their trade-off, and numbers each fact back to the passage it came from.'],
];

export default function HowItWorks() {
  const { meta } = useApp();
  const [q, setQ] = useState('low water denim with ZDHC chemistry');
  const [kind, setKind] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [registers, setRegisters] = useState([]);
  useEffect(() => { api.get('/registers').then(setRegisters); }, []);
  async function run(e) { e?.preventDefault(); setBusy(true); setRes(await api.post('/search', { query: q, kinds: kind ? [kind] : undefined })); setBusy(false); }

  return (
    <div className="wrap-app page">
      <div className="page-head">
        <div className="grow">
          <h1>What happens when you ask a question</h1>
          <p>Meridian Loop answers from its own library of supplier data, not from the open web. Here is each step, and a live view of the search.</p>
        </div>
      </div>

      <ol className="card pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)', listStyle: 'none', margin: '0 0 var(--space-xl)' }}>
        {STEPS.map(([t, d], i) => (
          <li key={t} className="col" style={{ gap: 'var(--space-2xs)' }}>
            <span className="mono muted">{i + 1}</span>
            <b>{t}</b>
            <span className="small muted">{d}</span>
          </li>
        ))}
      </ol>

      {meta && (
        <div className="kpis">
          <div><span>Passages in the library</span><b>{meta.kb.chunks}</b><span>{Object.entries(meta.kb.byKind).map(([k, v]) => `${v} ${KIND_LABEL[k]?.toLowerCase() || k}`).join(', ')}</span></div>
          <div><span>Words and phrases indexed</span><b>{meta.kb.vocabulary.toLocaleString()}</b><span>single words and two-word phrases</span></div>
          <div><span>Answers written by</span><b>{meta.llm ? 'Claude' : 'Built-in'}</b><span>{meta.llm ? meta.model : 'add an API key to switch to Claude'}</span></div>
        </div>
      )}

      <section className="card pad">
        <h2 className="section-title">Try the search</h2>
        <form className="row wrap" onSubmit={run}>
          <label htmlFor="kb-q" className="visually-hidden">Search the library</label>
          <input id="kb-q" className="input grow" style={{ minWidth: 260 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <label htmlFor="kb-kind" className="visually-hidden">Which sources</label>
          <select id="kb-kind" className="select" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All sources</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{busy ? 'Searching' : 'Search'}</button>
        </form>
        {!res ? <p className="small muted" style={{ marginTop: 'var(--space-md)' }}>Run the search to see which passages come back and how each is scored.</p> : (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div className="understood">
              <span className="small muted">Read as:</span>{res.constraints.length ? res.constraints.map((c) => <span key={c} className="tag mint">{c}</span>) : <span className="small muted">no filters</span>}
              <span className="small muted">Also searched:</span>{res.expansions.length ? res.expansions.slice(0, 8).map((c) => <span key={c} className="tag line">{c}</span>) : <span className="small muted">nothing extra</span>}
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>Rank</th><th>Passage</th><th>Keyword score</th><th>Spelling match</th><th>Combined</th></tr></thead>
                <tbody>{res.results.map((r, i) => (
                  <tr key={r.id}><td className="mono">{i + 1}</td><td><b>{r.title}</b><div className="small muted" style={{ marginTop: 'var(--space-2xs)' }}><Highlight text={r.text} terms={q.toLowerCase().split(/\W+/)} max={220} /></div></td><td className="mono">{r.bm25}</td><td className="mono">{r.fuzzy}</td><td className="mono"><b>{r.score}</b></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card pad" style={{ marginTop: 'var(--space-xl)' }}>
        <h2 className="section-title">Where certificates are checked</h2>
        <p className="muted" style={{ maxWidth: '64ch' }}>Each certificate number is looked up in the register kept by the body that issued it. In this demo a stand-in register plays that role, because the certificates are fictional. In the pilot it is replaced by each issuer’s own records. Every check links to the real public lookup so anyone can confirm it by hand.</p>
        <div className="scroll-x" style={{ marginTop: 'var(--space-md)' }}>
          <table className="tbl">
            <thead><tr><th>Standard</th><th>Issuer’s register</th><th>Public lookup</th></tr></thead>
            <tbody>{registers.map((r) => <tr key={r.name}><td><b>{r.standards}</b></td><td>{r.name}</td><td><a className="linkish" href={r.url} target="_blank" rel="noopener">{r.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></td></tr>)}</tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--space-sm)' }}>Standards without a public register (ISO 14001, Higg FEM, Better Cotton membership and others) are marked “No public register” and need a check with the issuing body.</p>
      </section>

      <div className="two" style={{ marginTop: 'var(--space-xl)' }}>
        <section className="well">
          <h2 className="section-title">The seven scores</h2>
          <table className="tbl"><tbody>
            {[['Cost', 'price tier against the platform'], ['Sustainability', 'certificates, renewable energy, water recycled'], ['Reliability', 'on-time delivery and years operating'], ['Quality', 'defect rate'], ['Lead time', 'production days'], ['Compliance', 'audit score, less expired or unverified certificates'], ['Low risk', 'country, capacity, certificate expiry, export spread']].map(([a, b]) => <tr key={a}><td><b>{a}</b></td><td className="muted">{b}</td></tr>)}
          </tbody></table>
          <p className="small muted" style={{ marginTop: 'var(--space-sm)' }}>Match = 55% fit to the brief + 45% weighted score, less 12 points for each requirement it misses.</p>
        </section>
        <section className="well">
          <h2 className="section-title">Why it gets better with use</h2>
          <p className="small">Every profile edit, uploaded certificate and posted request is searchable straight away. More brands and manufacturers mean richer data, sharper matches and better decisions.</p>
          <p className="small muted" style={{ marginTop: 'var(--space-sm)' }}>For the pilot: vector search in a managed store, delivery history feeding the reliability score, and quote outcomes feeding the ranking.</p>
        </section>
      </div>
    </div>
  );
}
