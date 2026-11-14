// Thin client for the Meridian Loop API.
async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.error || `Request failed (${res.status})`); e.status = res.status; e.fields = body.fields; throw e; }
  return body;
}
const send = (method) => (url, body) => fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(json);

export const api = { get: (url) => fetch('/api' + url).then(json), post: send('POST'), patch: send('PATCH'), del: send('DELETE') };

// Streams server-sent events from /api/chat, calling onEvent(name, data) for each.
export async function streamChat(body, onEvent, signal) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (ev && data) onEvent(ev, JSON.parse(data));
    }
  }
}
