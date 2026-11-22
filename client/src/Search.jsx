import { Fragment, useEffect, useState } from 'react';
import { api } from './api.js';
import { go } from './App.jsx';

const EXAMPLES = {
  brand: ['GOTS organic cotton loungewear, small MOQ, India or Cambodia', 'Biodegradable fabric', 'Low-water denim in Bangladesh', 'Recycled polyester activewear'],
  maker: ['We make organic cotton babywear', 'Waste cotton yarn and fabric', 'Peace silk scarves in Vietnam', 'Recycled polyester, MOQ under 1000'],
};
const PLACEHOLDER = {
  brand: 'What do you want made? Garment, material, MOQ, country',
  maker: 'What do you make? Garments, fabrics, materials',
};

// Bold names and numbered citations inside an answer.
function Rich({ text, sources }) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const n = /^\[(\d+)\]$/.exec(part);
    if (n) { const s = sources.find((x) => x.n === Number(n[1])); return <span key={i} className="cite" title={s ? `${s.title}: ${s.text}` : ''}>{n[1]}</span>; }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function Search({ side, q }) {
  const [input, setInput] = useState(q);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setInput(q); }, [q, side]);
  useEffect(() => {
    if (!q) { setResult(null); return; }
    let live = true;
    setBusy(true); setError('');
    api.post('/search', { side, query: q })
      .then((r) => live && setResult(r))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [side, q]);

  const run = (text, s = side) => { const t = (text ?? input).trim(); if (t) go(`/search?side=${s}&q=${encodeURIComponent(t)}`); };
  const switchSide = (s) => { setResult(null); go(q ? `/search?side=${s}&q=${encodeURIComponent(q)}` : `/search?side=${s}`); };

  return (
    <div className="wrap">
      <section className={`hero ${q ? 'compact' : ''}`}>
        <h1>{q ? (side === 'brand' ? 'Find a manufacturer' : 'Find a brand') : <>Find who makes it.<br /><em>Find who needs it.</em></>}</h1>
        <p className="lead">Meridian Loop connects sustainable clothing brands with manufacturers across Asia. Ask in plain words, and every answer shows where it came from.</p>
        <div className="searchbox">
          <div className="toggle" role="group" aria-label="I am a">
            <button type="button" aria-pressed={side === 'brand'} onClick={() => switchSide('brand')}>I’m a brand</button>
            <button type="button" aria-pressed={side === 'maker'} onClick={() => switchSide('maker')}>I’m a manufacturer</button>
          </div>
          <form className="search-row" role="search" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <label htmlFor="q" className="visually-hidden">{PLACEHOLDER[side]}</label>
            <input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder={PLACEHOLDER[side]} autoComplete="off" />
            <button type="submit" className="btn" disabled={!input.trim() || busy}>{busy ? 'Searching' : 'Search'}</button>
          </form>
          {!q && <div className="examples">{EXAMPLES[side].map((e) => <button type="button" key={e} className="example" onClick={() => run(e)}>{e}</button>)}</div>}
        </div>
      </section>

      {q && (
        <section className="results" aria-live="polite" aria-busy={busy}>
          {error && <p className="notice">{error}</p>}
          {busy && !result && <><div className="skeleton" /><div className="skeleton" /></>}
          {result && (
            <>
              <article className="answer">
                {(result.understood.length > 0 || result.expansions.length > 0) && (
                  <div className="read-as">
                    <span>Read as</span>
                    {result.understood.map((u) => <span key={u} className="pill">{u}</span>)}
                    {result.expansions.filter((x) => !q.toLowerCase().includes(x.toLowerCase()) && !result.understood.some((u) => u.toLowerCase().includes(x.toLowerCase()))).slice(0, 3).map((x) => <span key={x} className="pill plain" title="Related term also searched">{x}</span>)}
                  </div>
                )}
                {result.answer.split('\n\n').map((p, i) => <p key={i}><Rich text={p} sources={result.sources} /></p>)}
                {result.sources.length > 0 && (
                  <details className="answer-foot">
                    <summary>{result.sources.length} sources, answer by {result.mode === 'claude' ? 'Claude' : 'the built-in engine'}</summary>
                    <ol className="sources">{result.sources.map((s) => <li key={s.id}><span className="cite">{s.n}</span><span><b>{s.title}.</b> {s.text}</span></li>)}</ol>
                  </details>
                )}
              </article>
              {result.matches.length > 0 && (() => {
                const fits = result.matches.filter((m) => m.meetsAll);
                const close = result.matches.filter((m) => !m.meetsAll);
                return (
                  <>
                    {fits.length > 0 && <div className="match-list">{fits.map((m) => <Match key={m.id} m={m} />)}</div>}
                    {close.length > 0 && (
                      <div className="match-list">
                        {fits.length > 0 && <h2 className="close-head">Close matches <span>They miss at least one thing you asked for.</span></h2>}
                        {close.map((m) => <Match key={m.id} m={m} />)}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </section>
      )}

      {!q && (
        <>
          <section className="steps" aria-label="How it works">
            <div className="step"><span className="num">1</span><b>Ask in plain words</b><p>Brands describe what they want made. Manufacturers describe what they make.</p></div>
            <div className="step"><span className="num">2</span><b>See who fits, and why</b><p>Every profile and open request is searched. The answer cites the exact lines it used.</p></div>
            <div className="step"><span className="num">3</span><b>Get in touch</b><p>Open a profile for materials, minimums, certifications and a direct contact.</p></div>
          </section>
          <section className="origin" aria-label="Where it started">
            <blockquote>“We want to be the bridge between the manufacturers and the designers.”</blockquote>
            <p>Sustainable India set out to connect Indian designers with fabric makers in 2019. Meridian Loop takes that bridge across Asia. <a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Visit Sustainable India</a></p>
          </section>
        </>
      )}
    </div>
  );
}

function Match({ m }) {
  const href = m.type === 'maker' ? `#/m/${m.id}` : `#/b/${m.id}`;
  return (
    <a className="match" href={href}>
      <div>
        <h3>{m.name}</h3>
        <p className="where">{m.place}</p>
        {m.type === 'maker' ? (
          <>
            <p className="what">{m.summary}</p>
            <p className="facts"><span>Minimum order <b>{m.moq.toLocaleString()}</b></span><span>Lead time <b>{m.leadTimeDays} days</b></span></p>
            {m.certifications.length > 0 && <div className="tags">{m.certifications.map((c) => <span key={c} className="pill plain">{c}</span>)}</div>}
          </>
        ) : (
          <>
            <p className="what">Looking for <b>{m.need.title}</b>. {m.need.detail}</p>
            <p className="facts"><span>Quantity <b>{m.need.quantity.toLocaleString()}</b></span><span>Target <b>{m.need.target}</b></span></p>
          </>
        )}
        {m.checks.length > 0 && <p className="checks">{m.checks.map((c) => <span key={c.label} className={`check ${c.ok ? '' : 'no'}`}>{c.ok ? '✓' : '✕'} {c.label}</span>)}</p>}
      </div>
      <span className="go" aria-hidden="true">View profile</span>
    </a>
  );
}
