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
      if (!res.ok) { const e = new Error(friendly(res.status, body)); e.status = res.status; e.fields = body.fields; throw e; }
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
  post: (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }),
};
