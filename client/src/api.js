async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.error || `Request failed (${res.status})`); e.fields = body.fields; throw e; }
  return body;
}
export const api = {
  get: (url) => fetch('/api' + url).then(json),
  post: (url, body) => fetch('/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(json),
};
