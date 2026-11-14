import { useEffect, useState } from 'react';
import { api } from './api.js';
import Icon from './icons.jsx';
import { useApp, go } from './ui.jsx';
import { Gate } from './Account.jsx';

const KINDS = [['', 'All'], ['quote-request', 'Quote requests'], ['proposal', 'Proposals'], ['reply', 'Replies'], ['certificate-check', 'Certificate checks']];
const KIND_LABEL = Object.fromEntries(KINDS);
const when = (s) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Every alert email the platform has written, with a preview of exactly what the recipient sees.
export default function Outbox({ id }) {
  const { toast, me, isTeam, brandId, makerId } = useApp();
  if (!brandId && !makerId) return <div className="wrap-app page"><Gate title="Sign in to see your emails">Emails go to brand and manufacturer accounts. Sign in to see the ones sent to you.</Gate></div>;
  return <OutboxView id={id} toast={toast} me={me} isTeam={isTeam} />;
}

function OutboxView({ id, toast, me, isTeam }) {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/outbox').then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const pick = id || data?.emails[0]?.id;
    if (pick && pick !== open?.id) api.get(`/outbox/${pick}`).then(setOpen).catch(() => setOpen(null));
  }, [id, data]);

  async function runCheck() {
    setBusy(true);
    const r = await api.post('/alerts/run');
    await load(); setBusy(false);
    toast(r.created ? `Certificate check done: ${r.created} new email${r.created > 1 ? 's' : ''} written.` : 'Certificate check done: nothing new since the last check.');
  }

  const emails = (data?.emails || []).filter((e) => !kind || e.kind === kind);
  return (
    <div className="wrap-app page">
      <div className="page-head">
        <div className="grow">
          <h1>Email alerts</h1>
          <p>{isTeam ? 'Every email Meridian Loop writes: quote requests, proposals, replies, and the daily certificate check that warns makers before a certificate lapses.' : `The emails Meridian Loop sent to ${me?.entityName || 'you'}: quote requests, proposals, replies and certificate warnings.`}</p>
        </div>
        {isTeam && <button type="button" className="btn primary lg" disabled={busy} aria-busy={busy} onClick={runCheck}>{busy ? 'Checking' : 'Run the certificate check'}</button>}
      </div>

      {data && (
        <div className={`mail-mode ${data.mode}`} role="note">
          <Icon name={data.mode === 'smtp' ? 'check' : 'help'} size={20} />
          <span>{data.mode === 'smtp'
            ? `Sending is on. ${data.redirect ? `Every email goes to ${data.redirect} for the demo.` : 'Emails go to each recipient.'}`
            : 'Preview mode: nothing leaves this computer. Recipients use demo addresses. Add SMTP details to send for real.'}</span>
        </div>
      )}

      <div className="chips" role="group" aria-label="Filter emails" style={{ margin: 'var(--space-lg) 0' }}>
        {KINDS.map(([k, l]) => <button type="button" key={k || 'all'} className={`chip ${kind === k ? 'on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>

      {!data ? <div className="skeleton" /> : !emails.length ? (
        <div className="empty"><h2>No emails yet</h2><p className="muted">Send a quote request from a manufacturer’s profile, or run the certificate check, and the emails appear here.</p><button type="button" className="btn" onClick={() => go('/brand/discover')}>Find a manufacturer</button></div>
      ) : (
        <div className="mailbox">
          <ul className="mail-list" aria-label="Emails">
            {emails.map((e) => (
              <li key={e.id}>
                <a href={`#/emails/${e.id}`} aria-current={open?.id === e.id ? 'true' : undefined}>
                  <span className="row"><b className="grow">{e.toName}</b><span className="small muted">{when(e.createdAt)}</span></span>
                  <span className="subject">{e.subject}</span>
                  <span className="row small muted"><span className="grow">{KIND_LABEL[e.kind] || e.kind}</span>{e.status !== 'preview' && <span className={`tag ${e.status === 'sent' ? 'mint' : 'grey'}`}>{e.status}</span>}</span>
                </a>
              </li>
            ))}
          </ul>
          <section className="mail-view card" aria-label="Email preview">
            {open ? (
              <>
                <dl className="mail-head">
                  <div><dt>To</dt><dd>{open.toName} <span className="mono muted">&lt;{open.to}&gt;</span></dd></div>
                  <div><dt>From</dt><dd className="mono">{open.from}</dd></div>
                  <div><dt>Subject</dt><dd><b>{open.subject}</b></dd></div>
                  {open.status === 'failed' && <div><dt>Error</dt><dd>{open.error}</dd></div>}
                </dl>
                <iframe title={`Preview: ${open.subject}`} sandbox="" srcDoc={open.html} className="mail-frame" />
              </>
            ) : <div className="skeleton" />}
          </section>
        </div>
      )}
    </div>
  );
}
