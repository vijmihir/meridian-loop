// Talking to the server. Reads retry briefly, because a free host can take a moment to wake up.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([502, 503, 504]);

function friendly(status, body) {
  if (body?.error) return body.error;
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (RETRYABLE.has(status)) return 'The server is waking up. Try again in a few seconds.';
  return `Request failed (${status}).`;
}

async function request(url, opts = {}, { retries = 0, timeout = 20_000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch('/api' + url, { ...opts, signal: opts.signal || ctrl.signal });
      if (RETRYABLE.has(res.status) && attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { const e = new Error(friendly(res.status, body)); e.status = res.status; e.fields = body.fields; e.signIn = body.signIn; throw e; }
      return body;
    } catch (err) {
      if (err.status) throw err;
      if (attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
      throw new Error(navigator.onLine === false ? 'You seem to be offline. Check your connection and try again.' : 'Could not reach Meridian Loop. Try again in a moment.');
    } finally { clearTimeout(timer); }
  }
}

export const api = {
  get: (url) => request(url, {}, { retries: 3 }),
  post: (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }, { timeout: 40_000 }),
  patch: (url, body) => request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }),
  del: (url) => request(url, { method: 'DELETE' }),
};

// An anonymous id per browser, so the metrics can measure time from first question to first shortlist.
export function sessionId() {
  try {
    let id = localStorage.getItem('ml-sid');
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem('ml-sid', id); }
    return id;
  } catch { return ''; }
}
export function track(type, ref = '') {
  request('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, session: sessionId(), ref }) }).catch(() => {});
}
export const fmtMoney = (n) => (n == null ? '' : `US$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
export const certLabel = { checked: 'Checked in the register', given: 'As given by the company', expired: 'Expired', 'not-found': 'Not found in the register' };
