import { Fragment, useEffect, useRef, useState } from 'react';
import { useApp } from './App.jsx';
import { api } from './api.js';
import { HERO } from './photos.js';

const STORE = 'meridian-chat-v1';
const OPENERS = [
  { role: 'brand', label: 'I’m a brand', text: 'Find a manufacturer for what you want made.', send: "I'm a brand looking for a manufacturer" },
  { role: 'maker', label: 'I’m a manufacturer', text: 'Find brands looking for what you make.', send: "I'm a manufacturer looking for brands" },
];
const EXAMPLES = ['GOTS loungewear, small runs, India', 'Biodegradable fabric', 'We make waste cotton yarn and fabric', 'What is GOTS?'];

const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || null; } catch { return null; } };
const save = (v) => { try { sessionStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } };
let uid = 0;
const newId = () => `${Date.now().toString(36)}-${uid++}`;

// What the server needs to remember from an assistant turn: its words, and which companies it showed.
function asHistory(m) {
  if (m.role === 'user') return { role: 'user', content: m.text };
  const words = m.parts.filter((p) => p.kind === 'text').map((p) => p.text).join(' ').trim();
  const shown = m.parts.filter((p) => p.kind === 'results').flatMap((p) => p.matches.map((x) => `${x.name} (id ${x.id})`));
  return { role: 'assistant', content: [words, shown.length ? `[Shown: ${shown.join(', ')}]` : ''].filter(Boolean).join('\n') };
}

async function* events(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data: '));
      if (line) yield JSON.parse(line.slice(6));
    }
  }
}

export default function Chat({ initial }) {
  const { meta } = useApp();
  const saved = load();
  const [messages, setMessages] = useState(saved?.messages || []);
  const [convo, setConvo] = useState(saved?.convo || {});
  const [shortlist, setShortlist] = useState(saved?.shortlist || []);
  const isSaved = (id) => shortlist.some((x) => x.id === id);
  const toggleSave = (c) => setShortlist((l) => (l.some((x) => x.id === c.id) ? l.filter((x) => x.id !== c.id) : [...l, c]));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const sentInitial = useRef(false);

  useEffect(() => { save({ messages: messages.filter((m) => !m.pending), convo, shortlist }); }, [messages, convo, shortlist]);
  // When a question is sent, bring it to the top so the reply reads downward from it.
  const turns = messages.filter((m) => m.role === 'user').length;
  useEffect(() => {
    if (!turns) return;
    const mine = document.querySelectorAll('.msg-user');
    mine[mine.length - 1]?.scrollIntoView({ block: 'start' });
  }, [turns]);
  useEffect(() => { if (initial && !sentInitial.current) { sentInitial.current = true; send(initial); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLast = (fn) => setMessages((ms) => { const copy = ms.slice(); copy[copy.length - 1] = fn({ ...copy[copy.length - 1] }); return copy; });

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput(''); setBusy(true);
    const user = { id: newId(), role: 'user', text: t };
    const reply = { id: newId(), role: 'assistant', parts: [], choices: [], pending: true };
    const history = [...messages.filter((m) => !m.pending && !m.error), user].map(asHistory);
    setMessages((ms) => [...ms, user, reply]);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, state: convo }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The assistant could not be reached.');
      for await (const e of events(res)) {
        if (e.type === 'text') patchLast((m) => {
          const parts = m.parts.slice(); const lastPart = parts[parts.length - 1];
          if (lastPart?.kind === 'text') parts[parts.length - 1] = { ...lastPart, text: lastPart.text + e.delta };
          else parts.push({ kind: 'text', text: e.delta });
          return { ...m, parts };
        });
        else if (e.type === 'results' || e.type === 'profile' || e.type === 'compare') patchLast((m) => ({ ...m, parts: [...m.parts, { ...e, kind: e.type }] }));
        else if (e.type === 'choices') patchLast((m) => ({ ...m, choices: e.options }));
        else if (e.type === 'state') setConvo(e.state);
        else if (e.type === 'error') patchLast((m) => ({ ...m, error: e.message }));
        else if (e.type === 'done') patchLast((m) => ({ ...m, mode: e.mode }));
      }
      patchLast((m) => ({ ...m, pending: false }));
    } catch (err) {
      patchLast((m) => ({ ...m, pending: false, error: err.message || 'Something went wrong.', retry: t }));
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  function retry(m) {
    setMessages((ms) => ms.slice(0, -2));
    setTimeout(() => send(m.retry), 0);
  }

  function restart() {
    setMessages([]); setConvo({}); setInput('');
    inputRef.current?.focus();
  }

  const empty = messages.length === 0;
  const last = messages[messages.length - 1];
  const brief = briefOf(convo, messages);

  return (
    <div className={`chat ${empty ? 'is-empty' : 'has-side'}`}>
      <div className="chat-main">
      <div className="chat-scroll">
        {empty ? <Start onSend={send} /> : null}
        {empty ? null : (
          <div className="thread" aria-live="polite" aria-busy={busy}>
            <div className="thread-bar">
              <button type="button" className="text-btn" onClick={restart} disabled={busy}>New conversation</button>
            </div>
            <div className="side-inline"><Side brief={brief} shortlist={shortlist} onRemove={toggleSave} onSend={send} busy={busy} compact /></div>
            {messages.map((m) => m.role === 'user'
              ? <div key={m.id} className="msg msg-user"><p>{m.text}</p></div>
              : <Reply key={m.id} m={m} isLast={m === last} onChoose={send} onRetry={() => retry(m)} busy={busy} isSaved={isSaved} onSave={toggleSave} />)}
            <div className="thread-end" />
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="ask" className="visually-hidden">Message the sourcing assistant</label>
          <textarea
            id="ask" ref={inputRef} rows={1} value={input} autoComplete="off"
            placeholder={convo.side === 'maker' ? 'Describe what you make' : 'Describe what you need made'}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button type="submit" className="btn" disabled={!input.trim() || busy}>{busy ? 'Working' : 'Send'}</button>
        </form>
        <p className="composer-note">
          {meta?.answers === 'claude' ? 'Answers by Claude, from company profiles on Meridian Loop.' : 'Answers from company profiles on Meridian Loop.'} Every company in this demo is fictional.
        </p>
      </div>
      </div>
      {!empty && <aside className="side" aria-label="Your brief and shortlist"><Side brief={brief} shortlist={shortlist} onRemove={toggleSave} onSend={send} busy={busy} /></aside>}
    </div>
  );
}

// ---------- the opening screen ----------

function Start({ onSend }) {
  const [makers, setMakers] = useState(null);
  const [brands, setBrands] = useState(null);
  useEffect(() => { api.get('/manufacturers').then(setMakers).catch(() => setMakers([])); api.get('/brands').then(setBrands).catch(() => setBrands([])); }, []);
  const countries = makers ? new Set(makers.map((m) => m.country)).size : null;
  const schemes = makers ? new Set(makers.flatMap((m) => m.certifications.map((c) => c.name.replace(/ (Standard|Textile|USA|Chain of Custody).*$/, '')))).size : null;
  const requests = brands ? brands.flatMap((b) => b.needs.map((n) => ({ brand: b, need: n }))).sort((a, b) => b.need.quantity - a.need.quantity).slice(0, 4) : null;

  return (
    <div className="start">
      <section className="start-hero" aria-labelledby="start-head">
        <div className="start-copy">
          <h1 id="start-head">What are you sourcing?</h1>
          <p className="lead">Tell the assistant in plain words. It searches every manufacturer and brand on Meridian Loop and shows where each answer comes from.</p>
          <div className="openers">
            {OPENERS.map((o) => (
              <button key={o.role} type="button" className="opener" onClick={() => onSend(o.send)}>
                <span className="opener-title">{o.label}</span>
                <span className="opener-text">{o.text}</span>
              </button>
            ))}
          </div>
          <div className="examples" aria-label="Try asking">
            <span className="examples-label">Or try</span>
            {EXAMPLES.map((e) => <button key={e} type="button" className="chip" onClick={() => onSend(e)}>{e}</button>)}
          </div>
        </div>
        <figure className="start-photo">
          <div className="photo-frame" data-slot="hero">
            <img src={HERO.src} srcSet={HERO.srcSet} sizes="(min-width: 60rem) 34rem, 100vw" alt={HERO.alt} width={HERO.w} height={HERO.h} style={{ objectPosition: HERO.position }} />
          </div>
          <figcaption>{HERO.caption} Photo: <a href={HERO.page} rel="noopener">{HERO.credit}</a>, {HERO.license}.</figcaption>
        </figure>
      </section>

      <section className="start-now" aria-labelledby="now-head">
        <h2 id="now-head">On Meridian Loop now</h2>
        <dl className="figures">
          <div><dt>Manufacturers</dt><dd>{makers ? makers.length : ''}</dd></div>
          <div><dt>Brands</dt><dd>{brands ? brands.length : ''}</dd></div>
          <div><dt>Countries making</dt><dd>{countries ?? ''}</dd></div>
          <div><dt>Certification schemes</dt><dd>{schemes ?? ''}</dd></div>
        </dl>
        <div className="requests">
          <h3>Open requests from brands</h3>
          {!requests ? <div className="skeleton-rows" aria-hidden="true"><i /><i /></div> : (
            <ul>
              {requests.map(({ brand, need }) => (
                <li key={brand.id + need.title}>
                  <div>
                    <b>{need.title}</b>
                    <span className="where">{brand.name}, {brand.city}</span>
                  </div>
                  <span className="num">{need.quantity.toLocaleString()} units</span>
                  <button type="button" className="text-btn" onClick={() => onSend(`Tell me more about ${brand.name}`)}>Ask about this</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="origin">Meridian Loop grew out of <a className="link" href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a>, which set out in 2019 to be the bridge between manufacturers and designers. Every company in this demo is fictional.</p>
    </div>
  );
}

// ---------- the brief and the shortlist ----------

// What the assistant has understood so far: from the built-in state, or from the last search.
function briefOf(convo, messages) {
  const lastResults = [...messages].reverse().flatMap((m) => (m.parts || []).filter((p) => p.kind === 'results').reverse())[0];
  const side = convo.side || (lastResults ? (lastResults.side === 'maker' ? 'maker' : 'brand') : null);
  const b = convo.brief;
  if (b) return { side, topic: b.topic, quantity: b.quantity, maxMoq: b.maxMoq, certifications: b.certifications || [], countries: b.countries || [], maxLeadDays: b.maxLeadDays, found: lastResults ? lastResults.matches.filter((m) => m.meetsAll).length : null };
  if (lastResults) return { side, topic: lastResults.query, tags: lastResults.understood, found: lastResults.matches.filter((m) => m.meetsAll).length };
  return { side };
}

function Side({ brief, shortlist, onRemove, onSend, busy, compact }) {
  const unset = <span className="unset">Any</span>;
  const rows = brief.side === 'maker'
    ? [['You make', brief.topic || <span className="unset">Not said yet</span>]]
    : [
      ['Product', brief.topic || <span className="unset">Not said yet</span>],
      ...(brief.tags ? [['Requirements', brief.tags.length ? brief.tags.join(', ') : unset]] : [
        ['Run size', brief.quantity ? `About ${brief.quantity.toLocaleString()} units` : brief.maxMoq ? `Up to ${brief.maxMoq.toLocaleString()} units` : unset],
        ['Certification', brief.certifications?.length ? brief.certifications.join(', ') : unset],
        ['Country', brief.countries?.length ? brief.countries.join(' or ') : unset],
        ['Lead time', brief.maxLeadDays ? `Within ${brief.maxLeadDays} days` : unset],
      ]),
    ];
  const makers = shortlist.filter((x) => x.type === 'maker');

  if (compact) {
    return (
      <details className="side-compact">
        <summary>{brief.side === 'maker' ? 'Your offer' : 'Your brief'}{shortlist.length ? ` and shortlist (${shortlist.length})` : ''}</summary>
        {body()}
      </details>
    );
  }
  return body();

  function body() {
    return (
      <div className="side-body">
        <section aria-labelledby={`brief-head${compact ? '-c' : ''}`}>
          <h2 id={`brief-head${compact ? '-c' : ''}`}>{brief.side === 'maker' ? 'Your offer' : brief.side === 'brand' ? 'Your brief' : 'Your brief'}</h2>
          <dl className="brief">
            <div><dt>You are</dt><dd>{brief.side === 'maker' ? 'A manufacturer' : brief.side === 'brand' ? 'A brand' : <span className="unset">Not said yet</span>}</dd></div>
            {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {brief.found != null && <p className="brief-note">{brief.found === 1 ? 'One match meets' : `${brief.found} matches meet`} everything above. Tell the assistant to change any of it.</p>}
        </section>
        <section aria-labelledby={`short-head${compact ? '-c' : ''}`}>
          <h2 id={`short-head${compact ? '-c' : ''}`}>Shortlist</h2>
          {shortlist.length === 0 ? <p className="brief-note">Save companies from the results to compare them or get in touch.</p> : (
            <ul className="short">
              {shortlist.map((c) => (
                <li key={c.id}>
                  <a href={`#/${c.type === 'maker' ? 'm' : 'b'}/${c.id}`}>{c.name}</a>
                  <span className="where">{c.place}</span>
                  <button type="button" className="remove" aria-label={`Remove ${c.name} from shortlist`} onClick={() => onRemove(c)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          {makers.length >= 2 && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => onSend(`Compare ${makers.slice(0, 4).map((x) => x.name).join(' and ')}`)}>Compare shortlist</button>}
        </section>
      </div>
    );
  }
}

function SaveButton({ c, isSaved, onSave }) {
  const on = isSaved(c.id);
  return <button type="button" className="save" aria-pressed={on} onClick={() => onSave(c)}>{on ? 'Saved' : 'Save'}<span className="visually-hidden"> {c.name}</span></button>;
}

function Reply({ m, isLast, onChoose, onRetry, busy, isSaved, onSave }) {
  const sources = m.parts.filter((p) => p.kind === 'results').flatMap((p) => p.sources);
  const started = m.parts.length > 0;
  return (
    <div className="msg msg-assistant">
      {!started && m.pending && (
        <div className="working" role="status">
          <span>Searching manufacturers and brands</span>
          <div className="skeleton-rows" aria-hidden="true"><i /><i /><i /></div>
        </div>
      )}
      {m.parts.map((p, i) => {
        if (p.kind === 'text') return <Prose key={i} text={p.text} sources={sources} />;
        if (p.kind === 'results') return <Results key={i} r={p} onChoose={isLast ? onChoose : null} busy={busy} isSaved={isSaved} onSave={onSave} />;
        if (p.kind === 'profile') return <ProfileCard key={i} e={p.entity} isSaved={isSaved} onSave={onSave} />;
        if (p.kind === 'compare') return <Compare key={i} rows={p.rows} />;
        return null;
      })}
      {m.error && (
        <div className="msg-error" role="alert">
          <p>{m.error}</p>
          {m.retry && <button type="button" className="text-btn" onClick={onRetry}>Try again</button>}
        </div>
      )}
      {isLast && !m.pending && m.choices.length > 0 && (
        <div className="choices" aria-label="Suggested replies">
          {m.choices.map((c) => <button key={c} type="button" className="chip" disabled={busy} onClick={() => onChoose(c)}>{c}</button>)}
        </div>
      )}
    </div>
  );
}

// Paragraphs with bold names and numbered citations.
function Prose({ text, sources }) {
  return text.trim().split(/\n{2,}/).filter(Boolean).map((para, i) => (
    <p key={i} className="prose">
      {para.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, j) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={j}>{part.slice(2, -2)}</strong>;
        const n = /^\[(\d+)\]$/.exec(part);
        if (n) {
          const s = sources.find((x) => x.n === Number(n[1]));
          return <sup key={j} className="cite" title={s ? `${s.title}: ${s.text}` : undefined}>{n[1]}</sup>;
        }
        return <Fragment key={j}>{part}</Fragment>;
      })}
    </p>
  ));
}

function Checks({ checks }) {
  if (!checks?.length) return null;
  return (
    <ul className="checks">
      {checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : 'no'}><span aria-hidden="true">{c.ok ? '✓' : '✕'}</span> {c.label}<span className="visually-hidden">{c.ok ? ', met' : ', not met'}</span></li>)}
    </ul>
  );
}

// The match sheet: one ruled row per company, the brief's requirements checked on each.
function Results({ r, onChoose, busy, isSaved, onSave }) {
  const makers = r.side !== 'maker';
  const fits = r.matches.filter((m) => m.meetsAll);
  const close = r.matches.filter((m) => !m.meetsAll);
  const row = (m) => (
    <li key={m.id} className="sheet-row">
      <div className="sheet-name">
        {onChoose
          ? <button type="button" className="name-btn" disabled={busy} onClick={() => onChoose(`Tell me more about ${m.name}`)}>{m.name}</button>
          : <a className="name-btn" href={`#/${makers ? 'm' : 'b'}/${m.id}`}>{m.name}</a>}
        <span className="where">{m.place}</span>
      </div>
      <div className="sheet-save"><SaveButton c={{ id: m.id, type: m.type, name: m.name, place: m.place }} isSaved={isSaved} onSave={onSave} /></div>
      {makers ? (
        <>
          <p className="sheet-what">{m.summary}</p>
          <dl className="sheet-figs">
            <div><dt>Minimum order</dt><dd className="num">{m.moq.toLocaleString()}</dd></div>
            <div><dt>Lead time</dt><dd className="num">{m.leadTimeDays} days</dd></div>
          </dl>
          {m.certifications.length > 0 && <p className="sheet-certs">{m.certifications.join(', ')}</p>}
        </>
      ) : (
        <>
          <p className="sheet-what">Wants <b>{m.need.title.toLowerCase()}</b>. {m.need.detail}</p>
          <dl className="sheet-figs">
            <div><dt>Quantity</dt><dd className="num">{m.need.quantity.toLocaleString()}</dd></div>
            <div><dt>Target</dt><dd className="num">{m.need.target}</dd></div>
          </dl>
        </>
      )}
      <Checks checks={m.checks} />
    </li>
  );
  return (
    <section className="sheet" aria-label={makers ? 'Matching manufacturers' : 'Matching brands'}>
      <div className="sheet-head">
        <h2>{r.matches.length} {makers ? (r.matches.length === 1 ? 'manufacturer' : 'manufacturers') : (r.matches.length === 1 ? 'brand' : 'brands')}</h2>
        {r.understood.length > 0 && <ul className="tags" aria-label="Your requirements">{r.understood.map((u) => <li key={u} className="tag">{u}</li>)}</ul>}
      </div>
      <ol className="sheet-list">{fits.map(row)}</ol>
      {close.length > 0 && (
        <>
          {fits.length > 0 && <p className="sheet-divider">Close matches, missing something you asked for</p>}
          <ol className="sheet-list">{close.map(row)}</ol>
        </>
      )}
      {r.sources.length > 0 && (
        <details className="sources">
          <summary>Sources ({r.sources.length})</summary>
          <ol>{r.sources.map((s) => <li key={s.n} value={s.n}><b>{s.title}.</b> {s.text}</li>)}</ol>
        </details>
      )}
    </section>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Self-reported');

function ProfileCard({ e, isSaved, onSave }) {
  const href = `#/${e.type === 'maker' ? 'm' : 'b'}/${e.id}`;
  const mail = `mailto:${e.email}?subject=${encodeURIComponent(e.type === 'maker' ? 'Enquiry from Meridian Loop' : `${e.name} on Meridian Loop`)}`;
  return (
    <section className="spec-card" aria-label={e.name}>
      <div className="spec-card-head">
        <h2>{e.name}</h2>
        <span className="where">{e.type === 'maker' ? 'Manufacturer' : 'Clothing brand'} in {e.place}, since {e.founded}</span>
      </div>
      <dl className="spec">
        {e.type === 'maker' ? (
          <>
            <div><dt>Makes</dt><dd>{e.makes}</dd></div>
            <div><dt>Materials</dt><dd>{e.materials.join(', ')}</dd></div>
            <div><dt>Minimum order</dt><dd className="num">{e.moq.toLocaleString()} units</dd></div>
            <div><dt>Lead time</dt><dd className="num">{e.leadTimeDays} days</dd></div>
            {e.certifications.length > 0 && <div><dt>Certifications</dt><dd>{e.certifications.map((c) => <span key={c.name} className="cert">{c.name}<span className="muted">, {c.issuer}, valid to {fmtDate(c.validUntil)}</span></span>)}</dd></div>}
          </>
        ) : (
          <>
            <div><dt>Sells</dt><dd>{e.sells}</dd></div>
            {e.needs.map((n) => <div key={n.title}><dt>Looking for</dt><dd><b>{n.title}</b>, {n.quantity.toLocaleString()} units at {n.target}{n.certifications.length ? `, needs ${n.certifications.join(', ')}` : ''}</dd></div>)}
          </>
        )}
        <div><dt>Contact</dt><dd>{e.contact}, {e.email}</dd></div>
      </dl>
      <div className="spec-actions">
        <a className="btn" href={mail}>Email {e.contact.split(' ')[0]}</a>
        <a className="link" href={href}>Full profile</a>
        <SaveButton c={{ id: e.id, type: e.type, name: e.name, place: e.place }} isSaved={isSaved} onSave={onSave} />
      </div>
    </section>
  );
}

function Compare({ rows }) {
  const fields = [
    ['Based in', (r) => r.place],
    ['Makes', (r) => r.makes],
    ['Materials', (r) => r.materials.join(', ')],
    ['Minimum order', (r) => <span className="num">{r.moq.toLocaleString()} units</span>],
    ['Lead time', (r) => <span className="num">{r.leadTimeDays} days</span>],
    ['Certifications', (r) => r.certifications.join(', ') || 'None listed'],
  ];
  return (
    <div className="compare-wrap" role="region" aria-label="Comparison" tabIndex={0}>
      <table className="compare">
        <thead><tr><td />{rows.map((r) => <th key={r.id} scope="col"><a href={`#/m/${r.id}`}>{r.name}</a></th>)}</tr></thead>
        <tbody>{fields.map(([label, get]) => <tr key={label}><th scope="row">{label}</th>{rows.map((r) => <td key={r.id}>{get(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
