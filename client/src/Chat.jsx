import { useEffect, useRef, useState } from 'react';
import { streamChat } from './api.js';
import { Answer, Ring, useApp, go } from './ui.jsx';
import Icon from './icons.jsx';

// Conversational RAG assistant shared by all three audiences.
export default function Chat({ role, manufacturerId, weights, suggestions, intro, storageKey, placeholder }) {
  const { openManufacturer } = useApp();
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);

  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(messages)); } catch { /* storage unavailable */ } }, [messages, storageKey]);
  useEffect(() => { if (messages.length) scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  async function ask(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
    setBusy(true);
    const patch = (fn) => setMessages((ms) => { const copy = [...ms]; copy[copy.length - 1] = fn(copy[copy.length - 1]); return copy; });
    try {
      await streamChat({ role, manufacturerId, weights, messages: history.map(({ role, content }) => ({ role, content })) }, (ev, data) => {
        if (ev === 'sources') patch((m) => ({ ...m, meta: data }));
        if (ev === 'entities') patch((m) => ({ ...m, entities: data }));
        if (ev === 'text') patch((m) => ({ ...m, content: m.content + data.t }));
        if (ev === 'notice') patch((m) => ({ ...m, notice: data.text }));
        if (ev === 'error') patch((m) => ({ ...m, content: m.content || `That didn’t work: ${data.message}` }));
      });
    } catch (e) {
      patch((m) => ({ ...m, content: `That didn’t work: ${e.message}. Try again in a moment.` }));
    }
    patch((m) => ({ ...m, streaming: false }));
    setBusy(false);
  }

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scroller} aria-live="polite">
        {!messages.length && (
          <div className="chat-empty">
            {intro}
            <div className="chips">
              {suggestions.map((s) => <button type="button" key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'assistant' && <div className="who" aria-hidden="true">ML</div>}
            <div className="bubble grow">
              {m.role === 'user' ? m.content : (
                <>
                  {m.meta && <Understanding meta={m.meta} />}
                  {m.content ? <Answer text={m.content} sources={m.meta?.sources} streaming={m.streaming} /> : <span className="muted small">Searching supplier profiles, certificates and requests…</span>}
                  {m.notice && <p className="small muted">{m.notice}</p>}
                  {!m.streaming && m.entities?.items?.length > 0 && <Entities data={m.entities} openManufacturer={openManufacturer} />}
                  {!m.streaming && m.meta?.sources?.length > 0 && <Sources meta={m.meta} />}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label htmlFor={`ask-${role}`} className="visually-hidden">Your question</label>
        <textarea id={`ask-${role}`} className="textarea" placeholder={placeholder || 'Describe what you need in plain words'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} />
        <button type="submit" className="btn primary lg" disabled={busy || !input.trim()} aria-busy={busy}>{busy ? 'Searching' : 'Ask'}</button>
        {messages.length > 0 && <button type="button" className="btn ghost lg" onClick={() => setMessages([])} disabled={busy}>New chat</button>}
      </form>
    </div>
  );
}

function Understanding({ meta }) {
  if (!meta.constraints?.length && !meta.expansions?.length) return null;
  return (
    <div className="understood" aria-label="How the brief was read">
      {meta.constraints.map((c) => <span key={c} className="tag mint">{c}</span>)}
      {meta.expansions.slice(0, 4).map((c) => <span key={c} className="tag line" title="Related term added to the search">also: {c}</span>)}
    </div>
  );
}

function Sources({ meta }) {
  const max = Math.max(...meta.sources.map((s) => s.score));
  return (
    <details className="sources">
      <summary><Icon name="layers" size={16} />{meta.sources.length} passages this answer used, written by the {meta.mode === 'claude' ? 'Claude' : 'built-in'} engine</summary>
      <div>
        {meta.sources.map((s) => (
          <div className="source" key={s.id}>
            <span className="cite">{s.n}</span>
            <div><b>{s.title}</b><div className="muted">{s.text.slice(0, 180)}…</div></div>
            <div className="muted">score <span className="mono">{s.score}</span><div className="meter"><i style={{ width: `${(s.score / max) * 100}%` }} /></div></div>
          </div>
        ))}
      </div>
    </details>
  );
}

function Entities({ data, openManufacturer }) {
  return (
    <div className="entity-strip">
      {data.type === 'manufacturers' && data.items.map((r) => (
        <button type="button" key={r.manufacturer.id} className="mini" onClick={() => openManufacturer(r.manufacturer.id)}>
          <Ring value={r.match} size={44} />
          <div className="grow"><b>{r.manufacturer.name}</b><span>{r.manufacturer.country}, MOQ {r.manufacturer.moq}, {r.manufacturer.leadTimeDays} days</span></div>
        </button>
      ))}
      {data.type === 'requests' && data.items.map((r) => (
        <div key={r.request.id} className="mini">
          <Ring value={r.fit} size={44} label="fit" />
          <div className="grow"><b>{r.request.brandName}</b><span>{r.request.title}</span></div>
        </div>
      ))}
      {data.type === 'products' && data.items.map((r) => (
        <button type="button" key={r.product.id} className="mini" onClick={() => go(`/shop/p/${r.product.id}`)}>
          <div className="grow"><b>{r.product.name}</b><span>{r.product.brandName}, US${r.product.price}, trust {r.trust}</span></div>
        </button>
      ))}
    </div>
  );
}
