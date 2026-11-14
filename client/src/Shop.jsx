import { useEffect, useRef, useState } from 'react';
import { api, streamChat } from './api.js';
import Icon from './icons.jsx';
import { useApp, go, Bolt, Answer, Ring } from './ui.jsx';

const CATS = ['All', 'Made in India', 'Fashion', 'Footwear', 'Accessories', 'Home Textiles'];

export default function Shop({ sub, id }) {
  if (sub === 'p') return <ProductPage id={id} />;
  if (sub === 'b') return <BrandPage id={id} />;
  return <Marketplace />;
}

function Marketplace() {
  const [q, setQ] = useState(() => sessionStorage.getItem('shop-q') || '');
  const [submitted, setSubmitted] = useState(q);
  const [cat, setCat] = useState('All');
  const [data, setData] = useState(null);
  const [answer, setAnswer] = useState(null);
  const abort = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem('shop-q', submitted); } catch { /* storage unavailable */ }
    api.post('/discover', { query: submitted }).then(setData);
    abort.current?.abort();
    if (!submitted.trim()) { setAnswer(null); return; }
    const ctrl = new AbortController(); abort.current = ctrl;
    let a = { text: '', sources: [], streaming: true };
    setAnswer(a);
    streamChat({ role: 'consumer', messages: [{ role: 'user', content: submitted }] }, (ev, d) => {
      if (ev === 'sources') a = { ...a, sources: d.sources };
      if (ev === 'text') a = { ...a, text: a.text + d.t };
      setAnswer({ ...a });
    }, ctrl.signal).then(() => setAnswer({ ...a, streaming: false })).catch(() => {});
    return () => ctrl.abort();
  }, [submitted]);

  const results = (data?.results || []).filter((r) => cat === 'All' || (cat === 'Made in India' ? r.product.madeIn === 'India' : r.product.category === cat));
  return (
    <div className="wrap-app page">
      <div className="shop-head">
        <div className="col">
          <h1>Shop with the proof attached</h1>
          <p className="lead muted">Every product shows who made it, where, and which claims a certificate backs. The shop began as <a href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a> in 2019.</p>
        </div>
        <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(q); }}>
          <Icon name="search" />
          <label htmlFor="shop-q" className="visually-hidden">What are you looking for?</label>
          <input id="shop-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vegan sneakers under $120, plastic-free gifts" />
          {submitted && <button type="button" className="btn ghost sm" onClick={() => { setQ(''); setSubmitted(''); }}>Clear</button>}
          <button type="submit" className="btn primary">Search</button>
        </form>
      </div>
      <div className="chips" style={{ marginTop: 'calc(-1 * var(--space-md))', marginBottom: 'var(--space-xl)' }}>
        {['vegan sneakers under $120', 'organic cotton babywear', 'plastic-free bags', 'made from recycled bottles', 'handmade home textiles'].map((s) => <button type="button" key={s} className="chip" onClick={() => { setQ(s); setSubmitted(s); }}>{s}</button>)}
      </div>
      {answer && (
        <div className="ai-answer">
          <div className="who" aria-hidden="true">ML</div>
          <div className="bubble grow">{answer.text ? <Answer text={answer.text} sources={answer.sources} streaming={answer.streaming} /> : <span className="muted small">Checking products and their certificates…</span>}</div>
        </div>
      )}
      <div className="row wrap" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="chips grow" role="group" aria-label="Category">{CATS.map((c) => <button type="button" key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        <span className="small muted">{results.length} products</span>
      </div>
      {!data ? <div className="skeleton" /> : !results.length ? (
        <div className="empty"><h2>Nothing matches that yet</h2><p className="muted">Try a broader search, or pick another category.</p><button type="button" className="btn" onClick={() => { setQ(''); setSubmitted(''); setCat('All'); }}>Show everything</button></div>
      ) : (
        <div className="product-grid">
          {results.map(({ product: p, trust }) => (
            <a key={p.id} className="product" href={`#/shop/p/${p.id}`}>
              <Bolt product={p} />
              <div className="meta">
                <span className="maker">{p.brandName}, made in {p.madeIn}</span>
                <b>{p.name}</b>
                <div className="row"><span className="price grow">US${p.price}</span><span className="tag mint" title="Based on the maker’s verified certificates and audit">trust {trust}</span></div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS = { verified: ['mint', 'check', 'Verified'], pending: ['line', 'clock', 'Being checked'], expired: ['grey', 'x', 'Certificate expired'], withdrawn: ['grey', 'x', 'Withdrawn by issuer'], reported: ['line', 'help', 'Maker’s own claim'] };

function ProductPage({ id }) {
  const { toast } = useApp();
  const [p, setP] = useState(null);
  useEffect(() => { setP(null); api.get(`/products/${id}`).then(setP); }, [id]);
  if (!p) return <div className="wrap-app page"><div className="skeleton" /></div>;
  return (
    <div className="wrap-app page">
      <a className="back" href="#/shop"><Icon name="back" size={16} />All products</a>
      <div className="pdp" style={{ marginTop: 'var(--space-md)' }}>
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <Bolt product={p} large />
          <div className="footprint">
            <div><span className="small muted">Carbon footprint</span><b>{p.co2kg} kg</b><span className="small muted">CO₂e to the factory gate, estimated</span></div>
            <div><span className="small muted">Water used</span><b>{p.waterL.toLocaleString()} L</b><span className="small muted">across production</span></div>
          </div>
        </div>
        <div className="col" style={{ gap: 'var(--space-xl)' }}>
          <div className="col" style={{ gap: 'var(--space-xs)' }}>
            <a className="back" href={`#/shop/b/${p.brandId}`}>{p.brandName}</a>
            <h1>{p.name}</h1>
            <span className="price" style={{ fontSize: 'var(--text-xl)' }}>US${p.price}</span>
            <p className="muted">{p.description}</p>
            <div className="row" style={{ marginTop: 'var(--space-xs)' }}><button type="button" className="btn primary lg" onClick={() => toast('This is a demo shop, so nothing was added. Checkout comes in the marketplace pilot.')}>Add to bag</button><span className="small muted">Ships from {p.brand.hq}</span></div>
          </div>
          <section>
            <h2 className="section-title">What it claims, and the proof</h2>
            <ul className="claims">
              {p.claims.map((c) => { const [cls, icon, word] = STATUS[c.status]; return (
                <li key={c.claim}><span className={`tag ${cls}`}><Icon name={icon} size={14} />{word}</span><div><b className="small">{c.claim}</b><div className="small muted">{c.evidence}</div></div></li>
              ); })}
            </ul>
          </section>
          <section>
            <h2 className="section-title">Materials</h2>
            <div className="matbar" aria-hidden="true">{p.materials.map((m) => <i key={m.name} style={{ width: `${m.pct}%` }} />)}</div>
            {p.materials.map((m, i) => <div key={m.name} className="mat-row"><span className={`swatch-key k${i % 4}`} /><b className="mono">{m.pct}%</b><span>{m.name}</span><span className="muted">{m.origin}</span></div>)}
          </section>
          <section>
            <h2 className="section-title">Product passport</h2>
            <p className="small muted">Each step from raw material to the brand, with who did it.</p>
            <ol className="timeline">
              {p.trace.map((t) => <li key={t.stage}><b className="small">{t.stage}</b>{t.verified && <span className="tag mint" style={{ marginLeft: 'var(--space-xs)' }}><Icon name="check" size={14} />checked</span>}<div className="small">{t.partner}</div><div className="small muted">{t.location}</div></li>)}
            </ol>
          </section>
          <section className="well row" style={{ alignItems: 'flex-start' }}>
            <Ring value={p.manufacturer.auditScore} label="audit" />
            <div className="grow"><span className="small muted">Made by</span><div><b>{p.manufacturer.name}</b></div><div className="small muted">{p.manufacturer.city}, {p.manufacturer.country}. {p.manufacturer.renewableEnergy}% renewable energy, {p.manufacturer.waterRecycled}% of water recycled.</div></div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BrandPage({ id }) {
  const [b, setB] = useState(null);
  useEffect(() => { api.get(`/brands/${id}`).then(setB); }, [id]);
  if (!b) return <div className="wrap-app page"><div className="skeleton" /></div>;
  return (
    <div className="wrap-app page">
      <a className="back" href="#/shop"><Icon name="back" size={16} />All products</a>
      <section className="card brand-head" style={{ marginTop: 'var(--space-md)' }}>
        <Ring value={b.transparency} size={96} label="openness" />
        <div className="col">
          <span className="place">{b.category}, {b.hq}, since {b.founded}</span>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{b.name}</h1>
          <p className="lead">{b.tagline}</p>
          <p className="muted">{b.story}</p>
          <div className="chips">{b.values.map((v) => <span key={v} className="tag mint">{v}</span>)}</div>
        </div>
      </section>
      <h2 className="section-title" style={{ margin: 'var(--space-xl) 0 var(--space-md)' }}>Products</h2>
      <div className="product-grid">
        {b.products.map((p) => (
          <a key={p.id} className="product" href={`#/shop/p/${p.id}`}>
            <Bolt product={p} />
            <div className="meta"><span className="maker">Made by {p.manufacturerName}, {p.madeIn}</span><b>{p.name}</b><span className="price">US${p.price}</span></div>
          </a>
        ))}
      </div>
    </div>
  );
}
