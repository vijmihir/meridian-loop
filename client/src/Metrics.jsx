import { useEffect, useState } from 'react';
import { api } from './api.js';

// The funnel a pilot would report: from a question to a chosen quote. The pilot column is demo data seeded
// with the state; the live column counts what has happened on this server.
const ROWS = [
  ['questions', 'Questions asked'], ['profileViews', 'Profiles opened'], ['shortlists', 'Companies shortlisted'], ['enquiries', 'Enquiry emails opened'],
  ['rfqs', 'Quote requests sent'], ['quotesReceived', 'Quotes received'], ['quotesCompared', 'Quote comparisons opened'], ['awards', 'Quotes chosen'],
];

export default function Metrics() {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/metrics').then(setM).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="wrap"><p className="notice" role="alert">{error}</p></div>;
  if (!m) return <div className="wrap"><div className="skeleton" /></div>;
  const max = Math.max(...ROWS.map(([k]) => m.pilot[k] || 0), 1);
  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>Pilot metrics</h1><p>{m.pilot.label}. The live column counts this server since it started; it stores data in {m.storage === 'postgres' ? 'Postgres' : 'a file'}.</p></div>
      </div>
      <div className="figures metrics-figures">
        <div><dt>Median minutes to a shortlist</dt><dd>{m.pilot.minutesToShortlist}</dd></div>
        <div><dt>Median hours to a manufacturer’s reply</dt><dd>{m.pilot.replyHours}</dd></div>
        <div><dt>Quotes compared per request</dt><dd>{(m.pilot.quotesReceived / Math.max(1, m.pilot.rfqs)).toFixed(1)}</dd></div>
        <div><dt>Requests that ended in a choice</dt><dd>{Math.round((m.pilot.awards / Math.max(1, m.pilot.rfqs)) * 100)}%</dd></div>
      </div>
      <section className="section">
        <h2>From question to chosen quote</h2>
        <table className="funnel">
          <thead><tr><th scope="col">Step</th><th scope="col">Pilot</th><th scope="col" className="funnel-bar-h">Share of questions</th><th scope="col">Live</th></tr></thead>
          <tbody>{ROWS.map(([k, label]) => (
            <tr key={k}><th scope="row">{label}</th><td className="num">{(m.pilot[k] ?? 0).toLocaleString()}</td>
              <td className="funnel-bar-cell"><span className="funnel-bar" style={{ width: `${Math.max(2, ((m.pilot[k] || 0) / max) * 100)}%` }} /></td>
              <td className="num">{(m.live[k] ?? 0).toLocaleString()}</td></tr>
          ))}</tbody>
        </table>
        <p className="muted small">Live medians: {m.live.minutesToShortlist != null ? `${m.live.minutesToShortlist} minutes to a shortlist` : 'no shortlist yet'}, {m.live.replyHours != null ? `${m.live.replyHours} hours to a reply` : 'no replies yet'}. {m.live.signIns} sign-ins, {m.live.whatsapp} WhatsApp messages. Network: {m.makers} manufacturers, {m.brands} brands.</p>
      </section>
    </div>
  );
}
