import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// A stand-in for a manufacturer's phone: messages go to the same endpoint a WhatsApp provider would call.
const STARTERS = {
  en: ['HELP', 'REQUESTS', 'PROFILE', 'MOQ 250'],
  hi: ['मदद', 'अनुरोध', 'प्रोफ़ाइल', 'LEAD 55'],
  vi: ['giúp', 'yêu cầu', 'hồ sơ', 'MOQ 25'],
  bn: ['সাহায্য', 'অনুরোধ', 'প্রোফাইল', 'LEAD 50'],
};
const PICKS = [
  ['kaveri-organic-knits', 'Kaveri Organic Knits (English)'],
  ['jaipur-zari-studio', 'Jaipur Zari & Embroidery Studio (Hindi)'],
  ['hanoi-small-batch', 'Hanoi Small Batch Atelier (Vietnamese)'],
  ['padma-green-denim', 'Padma Green Denim (Bengali)'],
  ['new', 'A factory not on Meridian Loop yet'],
];

export default function WhatsApp({ params }) {
  const [from, setFrom] = useState(params.get('as') || PICKS[0][0]);
  const [lang, setLang] = useState('en');
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { setMsgs([]); setLang(from === 'jaipur-zari-studio' ? 'hi' : from === 'hanoi-small-batch' ? 'vi' : from === 'padma-green-denim' ? 'bn' : 'en'); }, [from]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);

  async function send(t) {
    const body = (t ?? text).trim(); if (!body || busy) return;
    setText(''); setBusy(true);
    setMsgs((m) => [...m, { me: true, text: body }]);
    try { const r = await api.post('/whatsapp/inbound', { from: from === 'new' ? '' : from, text: body }); setMsgs((m) => [...m, { me: false, text: r.reply }]); if (r.joined) setFrom(r.joined); }
    catch (e) { setMsgs((m) => [...m, { me: false, text: e.message, error: true }]); }
    setBusy(false);
  }
  const starters = from === 'new' ? ['Hello', 'JOIN Mekong Linen Co | Can Tho, Vietnam | linen shirts | linen, organic cotton | 150'] : STARTERS[lang];
  return (
    <div className="wrap">
      <div className="page-head"><div><h1>WhatsApp for manufacturers</h1><p>Many factories run on WhatsApp. They see quote requests, quote, decline and update their profile by message, in English, Hindi, Vietnamese or Bengali.</p></div></div>
      <div className="wa-grid">
        <div className="wa-side">
          <label className="field">Write as
            <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>{PICKS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          </label>
          <p className="muted small">Try a quote: <code>QUOTE 1004 6.80 500 32</code> answers Little Sprout’s request as Kaveri. Messages go to <code>POST /api/whatsapp/inbound</code>, the address a WhatsApp provider such as Twilio would call.</p>
        </div>
        <div className="wa-phone" aria-label="WhatsApp conversation">
          <div className="wa-head">Meridian Loop</div>
          <div className="wa-body" aria-live="polite">
            {msgs.length === 0 && <p className="wa-hint">Send a message to start.</p>}
            {msgs.map((m, i) => <p key={i} className={`wa-msg ${m.me ? 'wa-me' : ''} ${m.error ? 'wa-err' : ''}`}>{m.text}</p>)}
            <span ref={end} />
          </div>
          <div className="wa-chips">{starters.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={busy}>{s.length > 34 ? `${s.slice(0, 34)}…` : s}</button>)}</div>
          <form className="wa-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="wa-text" className="visually-hidden">Message</label>
            <input id="wa-text" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" autoComplete="off" />
            <button type="submit" className="btn" disabled={!text.trim() || busy}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
