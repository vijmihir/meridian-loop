// Meridian Loop API: two-way search, company profiles, and joining. Serves the built site from /dist.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { locate } from './geo.js';
import * as engine from './engine.js';
import { llmEnabled, MODEL, writeAnswer } from './llm.js';
import { builtinTurn, claudeTurn } from './assistant.js';
import { rateLimit, securityHeaders, cleanState } from './guard.js';
import { mountMarket, alertForNewBrand, alertForNewMaker } from './market.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const started = Date.now();
export const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy; this keeps rate limits per visitor
app.disable('x-powered-by');
app.use(securityHeaders);
// small JSON bodies everywhere, except the document upload, which parses its own (up to 3 MB)
const smallJson = express.json({ limit: '100kb' });
app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/me/documents' ? next() : smallJson(req, res, next)));
engine.rebuildIndex();
// every API call sees the stored state; with Postgres, changes from other instances too
app.use('/api', async (req, res, next) => { try { await store.ready(); next(); } catch (err) { next(err); } });

const chatLimit = rateLimit({ windowMs: 60_000, max: 30, message: 'That is a lot of questions in a minute. Wait a moment and ask again.' });
const writeLimit = rateLimit({ windowMs: 10 * 60_000, max: 30, message: 'Too many changes from here in a few minutes. Wait a moment and try again.' });
const readLimit = rateLimit({ windowMs: 60_000, max: 240, message: 'Too many requests. Wait a moment.' });
app.use('/api', readLimit);

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: Math.round((Date.now() - started) / 1000), ...engine.stats() }));

const notFound = (res) => res.status(404).json({ error: 'Not found' });
const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const list = (v) => clean(v, 400).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
const COUNTRIES_MAKERS = ['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia', 'Sri Lanka', 'Thailand', 'Pakistan', 'Nepal', 'Philippines', 'Laos', 'Japan', 'Other'];

app.get('/api/meta', (req, res) => res.json({ ...engine.stats(), answers: llmEnabled() ? 'claude' : 'built-in', demo: process.env.DEMO_MODE !== '0', storage: store.storageKind() }));

app.post('/api/search', chatLimit, async (req, res) => {
  const side = req.body.side === 'maker' ? 'maker' : 'brand';
  const query = clean(req.body.query, 300);
  if (!query) return res.status(400).json({ error: 'Type what you are looking for.' });
  const result = engine.search(side, query);
  result.mode = 'built-in';
  if (llmEnabled() && result.sources.length) {
    try { result.answer = await writeAnswer({ side, query, sources: result.sources }); result.mode = 'claude'; } catch { /* keep the built-in answer */ }
  }
  res.json(result);
});

// The assistant: one turn in, a stream of server-sent events out (see server/assistant.js).
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
app.post('/api/chat', chatLimit, async (req, res) => {
  const raw = Array.isArray(req.body.messages) ? req.body.messages.slice(-20) : [];
  const history = raw.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clean(m.content, 4000) })).filter((m) => m.content);
  while (history.length && history[0].role !== 'user') history.shift();
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return res.status(400).json({ error: 'Say what you are looking for.' });
  const state = cleanState(req.body.state);
  store.track('question', { session: clean(req.body.session, 40) });

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let closed = false;
  // A comment line every 15 seconds keeps proxies from closing a quiet stream.
  const beat = setInterval(() => { if (!closed) res.write(': keep-alive\n\n'); }, 15_000);
  res.on('close', () => { closed = true; clearInterval(beat); });
  const emit = (e) => { if (!closed) res.write(`data: ${JSON.stringify(e)}\n\n`); };

  let mode = 'built-in';
  if (llmEnabled()) {
    let sent = 0;
    try { await claudeTurn(history, (e) => { sent++; emit(e); }, state.side === 'maker' ? 'maker' : state.side === 'brand' ? 'brand' : null); mode = 'claude'; }
    catch (err) {
      console.error('Claude turn failed:', err?.message);
      if (sent) { emit({ type: 'error', message: 'The assistant stopped partway. Try asking again.' }); emit({ type: 'done', mode: 'claude' }); return res.end(); }
    }
  }
  if (mode === 'built-in') {
    let turn;
    try { turn = builtinTurn(last.content, state); }
    catch (err) {
      console.error('Built-in turn failed:', err);
      turn = { events: [{ type: 'text', text: 'Something went wrong on my side with that one. Try rephrasing, or start a new search.' }, { type: 'choices', options: ['Start a new search'] }], state };
    }
    for (const e of turn.events) {
      if (closed) break;
      if (e.type === 'text') {
        const words = e.text.split(/(?<=\s)/);
        for (let i = 0; i < words.length; i += 4) { emit({ type: 'text', delta: words.slice(i, i + 4).join('') }); await pause(14); }
        emit({ type: 'text', delta: '\n\n' });
      } else { await pause(60); emit(e); }
    }
    emit({ type: 'state', state: turn.state });
  }
  emit({ type: 'done', mode });
  clearInterval(beat);
  res.end();
});

// Contact details stay out of lists; a profile shows them.
const makerCard = ({ email, contact, ...m }) => ({ ...m, geo: locate(m.city, m.country) });
const brandCard = ({ email, contact, ...b }) => ({ ...b, geo: locate(b.city, b.country) });
app.get('/api/manufacturers', (req, res) => res.json(store.getManufacturers().map(makerCard)));
app.get('/api/brands', (req, res) => res.json(store.getBrands().map(brandCard)));
app.get('/api/manufacturers/:id', (req, res) => { const m = store.getManufacturer(req.params.id); m ? res.json(m) : notFound(res); });
app.get('/api/brands/:id', (req, res) => { const b = store.getBrand(req.params.id); b ? res.json(b) : notFound(res); });

// Join: a manufacturer lists what it makes, a brand lists what it needs. Both become searchable at once.
app.post('/api/join', writeLimit, async (req, res) => {
  const b = req.body, side = b.side === 'brand' ? 'brand' : 'maker';
  const errors = {};
  const name = clean(b.name, 80), contact = clean(b.contact, 80), email = clean(b.email, 120).toLowerCase();
  const country = clean(b.country, 60), city = clean(b.city, 60);
  if (!name) errors.name = 'Add your company name.';
  if (!contact) errors.contact = 'Add a contact name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That email address looks incomplete.';
  if (!country) errors.country = 'Add your country.';
  if (!city) errors.city = 'Add your city.';
  if (side === 'maker') {
    if (!COUNTRIES_MAKERS.includes(country)) errors.country = 'Pick your country from the list.';
    if (!clean(b.makes)) errors.makes = 'Say what you make.';
    if (!list(b.materials).length) errors.materials = 'List at least one material.';
    if (!(Number(b.moq) > 0)) errors.moq = 'Add your minimum order.';
  } else {
    if (!clean(b.needTitle)) errors.needTitle = 'Say what you are looking for.';
    if (!(Number(b.quantity) > 0)) errors.quantity = 'Add a rough quantity.';
  }
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
  const taken = [...store.getManufacturers(), ...store.getBrands()].some((x) => x.name.toLowerCase() === name.toLowerCase());
  if (taken) return res.status(409).json({ error: 'A company with that name is already listed.', fields: { name: 'This name is already on Meridian Loop.' } });
  if (store.joinedCount() >= store.MAX_JOINED) return res.status(503).json({ error: 'The demo has reached its listing limit. Reset the demo to add more.' });

  const rec = side === 'maker'
    ? store.addManufacturer({
      name, country, city, founded: Number(b.founded) || new Date().getFullYear(), makes: clean(b.makes), materials: list(b.materials), processes: list(b.processes),
      certifications: list(b.certifications).map((c) => ({ name: c, issuer: 'Self-reported', validUntil: null })),
      moq: Math.round(Number(b.moq)), leadTimeDays: Math.round(Number(b.leadTimeDays)) || 45, about: clean(b.about, 600) || `${name} joined Meridian Loop.`, contact, email,
    })
    : store.addBrand({
      name, country, city, founded: Number(b.founded) || new Date().getFullYear(), sells: clean(b.sells) || 'Sustainable clothing', about: clean(b.about, 600) || `${name} joined Meridian Loop.`, values: [],
      needs: [{ title: clean(b.needTitle), detail: clean(b.needDetail, 400), materials: list(b.needMaterials), quantity: Math.round(Number(b.quantity)), target: clean(b.target, 60) || 'Open to quotes', certifications: list(b.needCertifications), countries: [] }],
      contact, email,
    });
  engine.rebuildIndex();
  // where the new company now shows up, so the confirmation can say so
  let rank = null;
  if (side === 'maker') {
    alertForNewMaker(rec);
    const query = `${rec.makes}, ${rec.materials.slice(0, 2).join(', ')}`;
    const r = engine.search('brand', query);
    const at = r.matches.findIndex((x) => x.id === rec.id);
    rank = { query, position: at >= 0 ? at + 1 : null, of: r.matches.length };
  } else {
    alertForNewBrand(rec);
    const n = rec.needs[0];
    const r = engine.search('maker', `${n.title}, ${n.materials.join(', ')}`);
    const at = r.matches.findIndex((x) => x.id === rec.id);
    rank = { query: n.title, position: at >= 0 ? at + 1 : null, of: r.matches.length, fits: engine.search('brand', `${n.title}, ${n.materials.join(', ')}`).matches.filter((x) => x.meetsAll).length };
  }
  store.track('join', { who: rec.id, side });
  await store.flush();
  res.json({ side, id: rec.id, rank });
});

mountMarket(app, { writeLimit });

app.post('/api/reset', async (req, res) => {
  if (process.env.DEMO_MODE === '0') return notFound(res);
  await store.resetState(); engine.rebuildIndex(); res.json({ ok: true });
});

app.use('/api', (req, res) => notFound(res));

const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  // Built assets have hashed names, so they can be cached for a year; the page itself never is.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use(express.static(dist, { maxAge: 0 }));
  app.get(/^(?!\/api).*/, (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

// Any error that slips through becomes a short JSON answer, never a stack trace.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request was not valid JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  console.error('Unhandled error:', err);
  if (res.headersSent) return res.end();
  res.status(500).json({ error: 'Something went wrong on our side. Try again in a moment.' });
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const PORT = Number(process.env.PORT) || 8787;
  await store.ready();
  const server = app.listen(PORT, () => console.log(`Meridian Loop running at http://localhost:${PORT} (answers: ${llmEnabled() ? `Claude, ${MODEL}` : 'built-in'})`));
  server.keepAliveTimeout = 65_000; // longer than the proxy's, so it never reuses a closed socket
  server.headersTimeout = 66_000;
  process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
  const stop = (sig) => { console.log(`${sig}: closing`); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
