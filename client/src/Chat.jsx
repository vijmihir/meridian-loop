import { Fragment, useEffect, useRef, useState } from 'react';
import { useApp } from './App.jsx';
import { api } from './api.js';
import { HERO, materialPhoto } from './photos.js';
import MapDialog from './MapDialog.jsx';

const STORE = 'meridian-chat-v1';

// A saved conversation is only reused if it still has the shape this version expects.
const load = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE));
    if (!v || !Array.isArray(v.messages) || !v.messages.every((m) => m && (m.role === 'user' ? typeof m.text === 'string' : Array.isArray(m.parts)))) return null;
    return { messages: v.messages, convo: v.convo && typeof v.convo === 'object' ? v.convo : {}, shortlist: Array.isArray(v.shortlist) ? v.shortlist.filter((x) => x && x.id && x.name) : [] };
  } catch { return null; }
};
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
  const ctrlRef = useRef(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  useEffect(() => { save({ messages: messages.filter((m) => !m.pending), convo, shortlist }); }, [messages, convo, shortlist]);
  // When a question is sent, bring it to the top so the reply reads downward from it.
  const turns = messages.filter((m) => m.role === 'user').length;
  useEffect(() => {
    if (!turns) return;
    const mine = document.querySelectorAll('.msg-user');
    mine[mine.length - 1]?.scrollIntoView({ block: 'start' });
  }, [turns]);
  useEffect(() => { if (initial && !sentInitial.current) { sentInitial.current = true; send(initial); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLast = (fn) => setMessages((ms) => { if (!ms.length || ms[ms.length - 1].role !== 'assistant') return ms; const copy = ms.slice(); copy[copy.length - 1] = fn({ ...copy[copy.length - 1] }); return copy; });

  async function send(text, side) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput(''); setBusy(true);
    const state = side && !convo.side ? { ...convo, side } : convo;
    if (state !== convo) setConvo(state);
    const user = { id: newId(), role: 'user', text: t };
    const reply = { id: newId(), role: 'assistant', parts: [], choices: [], pending: true };
    const history = [...messages.filter((m) => !m.pending && !m.error), user].map(asHistory);
    setMessages((ms) => [...ms, user, reply]);
    const ctrl = new AbortController(); ctrlRef.current = ctrl;
    let idle; const touch = () => { clearTimeout(idle); idle = setTimeout(() => ctrl.abort('timeout'), 60_000); };
    try {
      // One quiet retry if the server is still waking up; nothing has been shown yet, so it is safe.
      let res;
      for (let attempt = 0; ; attempt++) {
        touch();
        try {
          res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, state }), signal: ctrl.signal });
          if ([502, 503, 504].includes(res.status) && attempt < 2) { await new Promise((r) => setTimeout(r, 2000)); continue; }
          break;
        } catch (err) {
          if (ctrl.signal.aborted || attempt >= 2) throw err;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (res.status === 429 ? 'Too many questions in a minute. Wait a moment.' : 'The assistant could not be reached.'));
      }
      let done = false;
      for await (const e of events(res)) {
        touch();
        if (e.type === 'text') patchLast((m) => {
          const parts = m.parts.slice(); const lastPart = parts[parts.length - 1];
          if (lastPart?.kind === 'text') parts[parts.length - 1] = { ...lastPart, text: lastPart.text + e.delta };
          else parts.push({ kind: 'text', text: e.delta });
          return { ...m, parts };
        });
        else if (e.type === 'results' || e.type === 'profile' || e.type === 'compare') patchLast((m) => ({ ...m, parts: [...m.parts, { ...e, kind: e.type }] }));
        else if (e.type === 'choices') patchLast((m) => ({ ...m, choices: Array.isArray(e.options) ? e.options : [] }));
        else if (e.type === 'state') setConvo(e.state || {});
        else if (e.type === 'error') patchLast((m) => ({ ...m, error: e.message, retry: t }));
        else if (e.type === 'done') { done = true; patchLast((m) => ({ ...m, mode: e.mode })); }
      }
      patchLast((m) => (done ? { ...m, pending: false } : { ...m, pending: false, error: 'The answer was cut off. Try again.', retry: t }));
    } catch (err) {
      const stopped = ctrl.signal.aborted && ctrl.signal.reason !== 'timeout';
      const msg = stopped ? 'Stopped.' : ctrl.signal.reason === 'timeout' ? 'That took too long. Try again.'
        : navigator.onLine === false ? 'You seem to be offline. Try again when you are back.' : (err.message && !/fetch|network/i.test(err.message) ? err.message : 'Could not reach the assistant. Try again.');
      patchLast((m) => ({ ...m, pending: false, error: msg, retry: t }));
    } finally { clearTimeout(idle); ctrlRef.current = null; }
    setBusy(false);
    inputRef.current?.focus();
  }

  function retry(m) {
    setMessages((ms) => ms.slice(0, -2));
    setTimeout(() => send(m.retry), 0);
  }

  function restart() {
    ctrlRef.current?.abort('stop');
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
        {empty ? <Start onSend={send} busy={busy} /> : null}
        {empty ? null : (
          <div className="thread" aria-live="polite" aria-busy={busy}>
            <div className="thread-bar">
              <button type="button" className="text-btn" onClick={restart}>New conversation</button>
            </div>
            <div className="side-inline"><Side brief={brief} shortlist={shortlist} onRemove={toggleSave} onSend={send} busy={busy} compact /></div>
            {messages.map((m) => m.role === 'user'
              ? <div key={m.id} className="msg msg-user"><p>{m.text}</p></div>
              : <Reply key={m.id} m={m} isLast={m === last} onChoose={send} onRetry={() => retry(m)} busy={busy} isSaved={isSaved} onSave={toggleSave} />)}
            <div className="thread-end" />
          </div>
        )}
      </div>

      {!empty && <div className="composer-wrap">
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="ask" className="visually-hidden">Message the sourcing assistant</label>
          <textarea
            id="ask" ref={inputRef} rows={1} value={input} autoComplete="off"
            placeholder="Ask a follow-up"
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {busy
            ? <button type="button" className="btn btn-quiet" onClick={() => ctrlRef.current?.abort('stop')}>Stop</button>
            : <button type="submit" className="btn" disabled={!input.trim()}>Send</button>}
        </form>
        <p className="composer-note">
          {meta?.answers === 'claude' ? 'Answers by Claude, from company profiles on Meridian Loop.' : 'Answers from company profiles on Meridian Loop.'} Every company in this demo is fictional.
        </p>
      </div>}
      </div>
      {!empty && <aside className="side" aria-label="Your brief and shortlist"><Side brief={brief} shortlist={shortlist} onRemove={toggleSave} onSend={send} busy={busy} /></aside>}
    </div>
  );
}

// ---------- the opening screen ----------

function Start({ onSend, busy }) {
  const [makers, setMakers] = useState(null);
  const [brands, setBrands] = useState(null);
  const [role, setRole] = useState('brand');
  const [text, setText] = useState('');
  useEffect(() => { api.get('/manufacturers').then(setMakers).catch(() => setMakers([])); api.get('/brands').then(setBrands).catch(() => setBrands([])); }, []);
  const countries = makers ? new Set(makers.map((m) => m.country)).size : null;
  const schemes = makers ? new Set(makers.flatMap((m) => m.certifications.map((c) => c.name.replace(/ (Standard|Textile|USA|Chain of Custody).*$/, '')))).size : null;
  const requests = brands ? brands.flatMap((b) => b.needs.map((n) => ({ brand: b, need: n }))).sort((a, b) => b.need.quantity - a.need.quantity).slice(0, 4) : null;
  const ask = (t) => onSend(t, role);
  const copy = role === 'brand'
    ? { head: 'Find who makes it.', lead: 'Describe what you need made. The assistant searches every sustainable manufacturer on Meridian Loop and tells you who fits, and why.', hint: 'Organic cotton T-shirts, 500 units', examples: ['GOTS loungewear, small runs, India', 'Low-water denim in Bangladesh', 'Biodegradable fabric'] }
    : { head: 'Find who needs it.', lead: 'Describe what you make. The assistant finds the clothing brands on Meridian Loop asking for it, and what they want.', hint: 'Organic cotton babywear', examples: ['We make waste cotton yarn and fabric', 'Peace silk scarves', 'Recycled polyester, small runs'] };

  return (
    <div className="start">
      <section className="start-hero" aria-labelledby="start-head">
        <img className="start-bg" src={HERO.src} srcSet={HERO.srcSet} sizes="100vw" alt="" width={HERO.w} height={HERO.h} style={{ objectPosition: HERO.position }} />
        <div className="start-inner">
          <h1 id="start-head">{copy.head}</h1>
          <p className="start-lead">{copy.lead}</p>
          <div className="start-roles" role="group" aria-label="I am">
            <button type="button" aria-pressed={role === 'brand'} onClick={() => setRole('brand')}>I’m a brand</button>
            <button type="button" aria-pressed={role === 'maker'} onClick={() => setRole('maker')}>I’m a manufacturer</button>
          </div>
          <form className="start-ask" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <label htmlFor="start-q" className="visually-hidden">{role === 'brand' ? 'Describe what you need made' : 'Describe what you make'}</label>
            <input id="start-q" value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.hint} autoComplete="off" />
            <button type="submit" className="btn" disabled={!text.trim() || busy}>Ask</button>
          </form>
          <div className="start-examples" aria-label="Try asking">
            {copy.examples.map((e) => <button key={e} type="button" onClick={() => ask(e)}>{e}</button>)}
          </div>
        </div>
        <p className="start-credit">{HERO.caption} Photo: <a href={HERO.page} rel="noopener">{HERO.credit}</a>, {HERO.license}.</p>
      </section>

      <div className="start-below">
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
                    <button type="button" className="text-btn" onClick={() => onSend(`Tell me more about ${brand.name}`, 'maker')}>Ask about this</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <p className="origin">Meridian Loop grew out of <a className="link" href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Sustainable India</a>, which set out in 2019 to be the bridge between manufacturers and designers. Every company in this demo is fictional.</p>
      </div>
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
  const [mapOpen, setMapOpen] = useState(false);
  const row = (m) => { const ph = materialPhoto(makers ? m.summary : `${m.need.title} ${(m.need.materials || []).join(' ')}`); return (
    <li key={m.id} className="sheet-row">
      <img className="sheet-thumb" src={ph.src} alt="" loading="lazy" style={{ objectPosition: ph.position }} />
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
  ); };
  const mapped = r.matches.filter((m) => m.geo).length;
  return (
    <section className="sheet" aria-label={makers ? 'Matching manufacturers' : 'Matching brands'}>
      <div className="sheet-head">
        <h2>{r.matches.length} {makers ? (r.matches.length === 1 ? 'manufacturer' : 'manufacturers') : (r.matches.length === 1 ? 'brand' : 'brands')}</h2>
        {r.understood.length > 0 && <ul className="tags" aria-label="Your requirements">{r.understood.map((u) => <li key={u} className="tag">{u}</li>)}</ul>}
        {mapped > 0 && <button type="button" className="map-btn" onClick={() => setMapOpen(true)}>Show on map</button>}
      </div>
      <MapDialog open={mapOpen} onClose={() => setMapOpen(false)} matches={[...fits, ...close]} title={`${r.matches.length} ${makers ? 'manufacturers' : 'brands'} for your brief`} />
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
