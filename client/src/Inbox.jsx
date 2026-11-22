import { useEffect, useState } from 'react';
import { api } from './api.js';
import { go, useApp } from './App.jsx';

const KIND = { rfq: 'Quote request', quote: 'Quote', award: 'Chosen', alert: 'New match', certificate: 'Certificate' };

export default function Inbox() {
  const { user, refreshUnread } = useApp();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.get('/me/notifications').then(setRows).catch((e) => (e.status === 401 ? go('/signin?next=/inbox') : setError(e.message)));
  useEffect(() => { if (user === null) go('/signin?next=/inbox'); else if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function readAll() { await api.post('/me/notifications/read', {}); await load(); refreshUnread(); }
  async function open(n) { if (!n.read) { await api.post('/me/notifications/read', { ids: [n.id] }).catch(() => {}); refreshUnread(); } window.location.hash = n.link.replace(/^#/, ''); }

  const unread = rows ? rows.filter((n) => !n.read).length : 0;
  return (
    <div className="wrap narrow-page">
      <div className="page-head">
        <div><h1>Inbox</h1><p>Quote requests, replies and new matches for your saved searches. Each one is also emailed to your contact.</p></div>
        {unread > 0 && <button type="button" className="btn btn-quiet" onClick={readAll}>Mark all as read</button>}
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {!rows ? <div className="skeleton" /> : rows.length === 0 ? <div className="empty-state"><p>Nothing yet. Quote requests and replies arrive here.</p></div> : (
        <ul className="inbox">
          {rows.map((n) => (
            <li key={n.id} className={n.read ? '' : 'is-unread'}>
              <button type="button" onClick={() => open(n)}>
                <span className={`kind kind--${n.kind}`}>{KIND[n.kind] || 'Note'}</span>
                <span className="inbox-main"><b>{n.title}</b><span>{n.body}</span></span>
                <time dateTime={n.at}>{new Date(n.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
