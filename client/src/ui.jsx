import { createContext, useContext, useEffect, useState, Fragment } from 'react';
import Icon from './icons.jsx';

// ---------- App-wide context (meta, toasts, drawers) ----------
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
export const go = (path) => { window.location.hash = path; window.scrollTo({ top: 0 }); };

// ---------- Light markdown with citation chips ----------
function inline(text, sources, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|\[\d+\])/g);
  return parts.map((p, i) => {
    const k = keyBase + '-' + i;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(p)) return <em key={k} className="muted">{p.slice(1, -1)}</em>;
    const m = /^\[(\d+)\]$/.exec(p);
    if (m) {
      const s = sources?.find((x) => x.n === Number(m[1]));
      return <span key={k} className="cite" title={s ? `${s.title}\n\n${s.text.slice(0, 280)}…` : 'Source'}>{m[1]}</span>;
    }
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export function Answer({ text, sources, streaming }) {
  const out = []; let list = null;
  text.split('\n').forEach((line) => {
    const li = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (li) {
      if (!list) { list = []; out.push({ type: 'ol', items: list }); }
      list.push({ text: li[2], sub: [] });
    } else if (/^\s{2,}\S/.test(line) && list) {
      list[list.length - 1].sub.push(line.trim());
    } else if (line.trim()) {
      list = null; out.push({ type: 'p', text: line });
    } else list = null;
  });
  return (
    <div className="answer">
      {out.map((b, i) => b.type === 'p'
        ? <p key={i}>{inline(b.text, sources, i)}</p>
        : <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it.text, sources, `${i}-${j}`)}{it.sub.map((s, k) => <div key={k} className="note">{inline(s, sources, `${i}-${j}-${k}`)}</div>)}</li>)}</ol>)}
      {streaming && <span className="typing" aria-hidden="true" />}
    </div>
  );
}

// ---------- Highlight query terms in evidence ----------
export function Highlight({ text, terms = [], max = 260 }) {
  const t = text.length > max ? text.slice(0, max) + '…' : text;
  const words = [...new Set(terms.filter((w) => w.length > 2))].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <span>{t}</span>;
  const parts = t.split(new RegExp(`\\b(${words.join('|')})\\w*`, 'gi'));
  return <span>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}</span>;
}

// ---------- Score visuals ----------
export function Ring({ value, size = 64, label = 'match' }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${value} out of 100`}>
      <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" />
      <circle className="val" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text className="num" x="50%" y={size >= 56 ? '47%' : '52%'} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3}>{value}</text>
      {size >= 56 && <text className="lbl" x="50%" y="72%" textAnchor="middle" fontSize={size * 0.14}>{label}</text>}
    </svg>
  );
}

export const DIM_LABELS = { cost: 'Cost', sustainability: 'Sustainability', reliability: 'Reliability', quality: 'Quality', leadTime: 'Lead time', compliance: 'Compliance', risk: 'Low risk' };
const level = (v) => (v >= 70 ? '' : v >= 45 ? 'mid' : 'low');

export function DimBars({ scores }) {
  return (
    <div className="dims">
      {Object.entries(DIM_LABELS).map(([k, l]) => (
        <div className="dim" key={k}><span>{l}</span><div className="meter"><i className={level(scores[k])} style={{ width: `${scores[k]}%` }} /></div><b>{scores[k]}</b></div>
      ))}
    </div>
  );
}

export function Radar({ series, size = 280 }) {
  const keys = Object.keys(DIM_LABELS);
  const cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2; return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)]; };
  return (
    <svg className="radar" width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }} role="img" aria-label="Score chart across seven dimensions">
      {[25, 50, 75, 100].map((g) => <polygon key={g} className="grid" points={keys.map((_, i) => pt(i, g).join(',')).join(' ')} />)}
      {keys.map((k, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 122); return <g key={k}><line className="axis" x1={cx} y1={cy} x2={x} y2={y} /><text x={lx} y={ly} fontSize="10.5" textAnchor="middle" dominantBaseline="middle">{DIM_LABELS[k]}</text></g>; })}
      {series.map((s, si) => <polygon key={si} className={`s${si % 4}`} strokeWidth="2" points={keys.map((k, i) => pt(i, s.scores[k]).join(',')).join(' ')} />)}
    </svg>
  );
}

// ---------- Certificates ----------
const CERT_STATE = {
  valid: ['mint', 'check', 'valid'],
  expiring: ['line', 'clock', 'expiring soon'],
  expired: ['grey', 'x', 'expired'],
  unverified: ['grey', 'help', 'not verified'],
  withdrawn: ['grey', 'x', 'withdrawn by issuer'],
};
export function CertBadge({ cert, stateOnly }) {
  const state = cert.state || cert.status?.state || 'valid';
  const [cls, icon, word] = CERT_STATE[state] || CERT_STATE.valid;
  if (stateOnly) return <span className={`tag ${cls}`}><Icon name={icon} size={14} />{word.charAt(0).toUpperCase() + word.slice(1)}</span>;
  return <span className={`tag ${cls}`} title={`${cert.name}: ${word}`}><Icon name={icon} size={14} />{cert.name.replace(/\s*\(.*\)/, '')}{state !== 'valid' && <span className="visually-hidden">, {word}</span>}</span>;
}

const REG = {
  confirmed: ['mint', 'shield', 'Confirmed with issuer'],
  mismatch: ['line', 'alert', 'Differs from issuer'],
  withdrawn: ['grey', 'x', 'Withdrawn by issuer'],
  not_found: ['grey', 'help', 'Not in issuer register'],
  manual: ['line', 'help', 'No public register'],
};
// The result of checking a certificate against its issuer's register, with a link to look it up by hand.
export function RegisterCheck({ reg, compact }) {
  if (!reg) return null;
  const [cls, icon, word] = REG[reg.status] || REG.manual;
  const tag = <span className={`tag ${cls}`} title={reg.note}><Icon name={icon} size={14} />{word}</span>;
  if (compact) return tag;
  return (
    <div className="register">
      {tag}
      <span className="small muted">{reg.note}</span>
      {reg.register && <a className="linkish" href={reg.register.url} target="_blank" rel="noopener">Look it up: {reg.register.name}</a>}
    </div>
  );
}

export function Check({ ok, children }) {
  return <span className={`check ${ok ? '' : 'no'}`}><Icon name={ok ? 'check' : 'x'} size={16} />{children}</span>;
}

export function Flag({ level: lvl, children }) {
  return <div className={`flag ${lvl === 'low' ? 'low' : ''}`}><Icon name={lvl === 'low' ? 'clock' : 'alert'} size={16} /><span>{children}</span></div>;
}

// ---------- Product as a bolt of cloth with its swing tag ----------
export function Bolt({ product, large }) {
  const folds = [...product.colors, ...product.colors].slice(0, large ? 4 : 3);
  const main = product.materials[0];
  return (
    <div className={`bolt ${large ? 'lg' : ''}`} role="img" aria-label={`${product.name}: ${product.materials.map((m) => `${m.pct}% ${m.name}`).join(', ')}`}>
      <div className="label" aria-hidden="true">
        {main.pct}% {main.name}<br />{main.origin}
      </div>
      {folds.map((c, i) => <div key={i} className="fold" style={{ background: c }} aria-hidden="true" />)}
    </div>
  );
}

export function Spinner() { return <span className="spinner keep-motion" role="status" aria-label="Loading" />; }

export const dollars = (n) => '$'.repeat(n);
export const fmtDate = (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
