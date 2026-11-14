// Meridian Loop API server. Serves the built React app from /dist in production.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import * as engine from './engine.js';
import { extractDocument } from './docintel.js';
import { isPdf, pdfText } from './pdf.js';
import { registerSummary } from './issuers.js';
import * as notify from './notify.js';
import { attachUser, requireRole, mountAuth, DEMO_MODE } from './auth.js';
import { DIMENSIONS, DEFAULT_WEIGHTS } from './scoring.js';
import { llmEnabled, MODEL, readCertificatePdf } from './llm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
// Behind Render's proxy, trust one hop so req.ip is the visitor (used to slow repeated failed sign-ins).
app.set('trust proxy', process.env.RENDER ? 1 : 'loopback');
app.use(express.json({ limit: '15mb' }));
app.use(attachUser);

// Writes must be JSON. Browsers cannot send JSON across sites without a preflight, which blocks
// cross-site form posts riding on the session cookie (alongside SameSite=Lax).
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: 'Send JSON.' });
  next();
});

engine.rebuildIndex();
notify.startCertificateSchedule();
mountAuth(app, { onProfileCreated: () => engine.rebuildIndex() });

const weightsFrom = (w) => (w && typeof w === 'object' ? { ...DEFAULT_WEIGHTS, ...w } : DEFAULT_WEIGHTS);
const notFound = (res) => res.status(404).json({ error: 'Not found' });
const isAdmin = (req) => req.user?.role === 'admin';
// The company a request acts for: your own, or (for the team account) the one it names.
const brandOf = (req, asked) => (isAdmin(req) ? asked : req.user?.role === 'brand' ? req.user.entityId : null);
const makerOf = (req, asked) => (isAdmin(req) ? asked : req.user?.role === 'manufacturer' ? req.user.entityId : null);
const emailedSummary = (e) => (e ? { to: e.to, toName: e.toName, id: e.id } : null);

app.get('/api/meta', (req, res) => res.json({
  llm: llmEnabled(), model: llmEnabled() ? MODEL : null, mail: notify.mailMode(), dimensions: DIMENSIONS, defaultWeights: DEFAULT_WEIGHTS, kb: engine.kbStats(), demo: DEMO_MODE,
  counts: { manufacturers: store.getManufacturers().length, brands: store.getBrands().length, products: store.getProducts().length, requests: store.getRequests().length },
}));

// ---------- Public: browsing, search and the assistant ----------
app.post('/api/match', (req, res) => res.json(engine.matchManufacturers(req.body.query || '', weightsFrom(req.body.weights))));
app.get('/api/manufacturers', (req, res) => res.json(store.getManufacturers().map((m) => ({ id: m.id, name: m.name, country: m.country, city: m.city, categories: m.categories }))));
app.get('/api/manufacturers/:id', (req, res) => {
  let w = null; try { w = req.query.w ? JSON.parse(req.query.w) : null; } catch { /* ignore bad weights */ }
  const d = engine.manufacturerDetail(req.params.id, weightsFrom(w));
  d ? res.json(d) : notFound(res);
});
app.post('/api/compare', (req, res) => res.json((req.body.ids || []).slice(0, 4).map((id) => engine.manufacturerDetail(id, weightsFrom(req.body.weights))).filter(Boolean)));
app.get('/api/brands', (req, res) => res.json(store.getBrands().map(({ contactEmail, ...b }) => b)));
app.get('/api/brands/:id', (req, res) => {
  const b = store.getBrand(req.params.id); if (!b) return notFound(res);
  const { contactEmail, ...pub } = b;
  res.json({ ...pub, products: store.getProducts().filter((p) => p.brandId === b.id) });
});
app.get('/api/requests', (req, res) => res.json(store.getRequests()));
app.post('/api/discover', (req, res) => res.json(engine.discoverProducts(req.body.query || '')));
app.get('/api/products/:id', (req, res) => { const p = engine.productDetail(req.params.id); p ? res.json(p) : notFound(res); });
app.get('/api/registers', (req, res) => res.json(registerSummary()));
app.get('/api/kb', (req, res) => res.json(engine.kbStats()));
app.post('/api/search', (req, res) => res.json(engine.rawSearch(req.body.query || '', req.body.kinds)));

// ---------- Manufacturers: their own profile, demand and certificates ----------
app.patch('/api/manufacturers/:id', requireRole('manufacturer'), (req, res) => {
  if (makerOf(req, req.params.id) !== req.params.id) return res.status(403).json({ error: 'You can only edit your own profile.' });
  if (!store.getManufacturer(req.params.id)) return notFound(res);
  store.updateManufacturer(req.params.id, req.body); engine.rebuildIndex();
  res.json(engine.manufacturerDetail(req.params.id));
});
app.post('/api/demand', requireRole('manufacturer'), (req, res) => {
  const id = makerOf(req, req.body.manufacturerId);
  if (!store.getManufacturer(id)) return notFound(res);
  res.json(engine.findDemand(id, req.body.query || ''));
});
app.get('/api/samples', (req, res) => res.json(store.sampleDocuments));
app.post('/api/documents/extract', requireRole('manufacturer'), (req, res) => res.json(extractDocument(req.body.text || '', store.getManufacturers())));

// Read an uploaded file (PDF or plain text). PDFs are read locally from their text layer;
// with Claude turned on, the original PDF is read by Claude, which also handles scans.
const MAX_UPLOAD = 10 * 1024 * 1024;
const claudeReads = new Map(); // fileId -> fields Claude read, reused when the document is attached
app.post('/api/documents/read', requireRole('manufacturer'), async (req, res) => {
  const { filename = 'document', data } = req.body;
  if (typeof data !== 'string' || !data) return res.status(400).json({ error: 'No file was received.' });
  const buf = Buffer.from(data, 'base64');
  if (buf.length > MAX_UPLOAD) return res.status(413).json({ error: 'That file is over 10 MB. Upload the certificate pages only.' });
  let text = '', pages = null, method = 'text', given = null, notice = null;
  if (isPdf(buf)) {
    try { ({ text, pages } = await pdfText(buf)); method = 'pdf-text'; } catch { return res.status(422).json({ error: 'That PDF could not be opened. It may be damaged or password-protected.' }); }
    if (llmEnabled()) {
      try { given = await readCertificatePdf(data); text = given.text?.trim() || text; method = 'claude'; } catch (err) { notice = `Claude could not read it (${err.message}), so the PDF’s own text was used.`; }
    }
    if (!text.trim()) return res.status(422).json({ error: llmEnabled() ? 'No text could be read from this PDF.' : 'This PDF has no text layer, so it is probably a scan. Turn on Claude to read scanned certificates, or paste the text instead.' });
  } else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) return res.status(415).json({ error: 'Upload a PDF or a plain text file.' });
  }
  const fileId = isPdf(buf) ? store.saveUpload(buf) : null;
  if (fileId && given) claudeReads.set(fileId, given);
  res.json({ fileId, filename, pages, method, notice, text, extracted: extractDocument(text, store.getManufacturers(), given) });
});
app.post('/api/documents', requireRole('manufacturer'), (req, res) => {
  const manufacturerId = makerOf(req, req.body.manufacturerId);
  const { text, label, fileId, filename } = req.body;
  if (!store.getManufacturer(manufacturerId) || !text) return res.status(400).json({ error: 'manufacturerId and text are required' });
  const file = fileId && store.uploadPath(fileId) ? fileId : null;
  const extracted = extractDocument(text, store.getManufacturers(), file ? claudeReads.get(file) || null : null);
  if (extracted.matchedManufacturerId && extracted.matchedManufacturerId !== manufacturerId) return res.status(403).json({ error: 'This document names a different company.' });
  const doc = store.addDocument({ manufacturerId, text, label: label || extracted.standard || 'Document', extracted, fileId: file, filename: file ? String(filename || 'certificate.pdf').slice(0, 120) : null });
  engine.rebuildIndex();
  res.json({ document: doc, manufacturer: engine.manufacturerDetail(manufacturerId) });
});
// Original PDFs are evidence: anyone viewing a profile may open them.
app.get('/api/documents/:id/file', (req, res) => {
  const doc = store.getDocument(req.params.id);
  const file = doc?.fileId && store.uploadPath(doc.fileId);
  if (!file) return notFound(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${(doc.filename || 'certificate.pdf').replace(/[^\w.\- ]+/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file);
});

// ---------- Brands: shortlist and sourcing requests ----------
app.get('/api/shortlist', requireRole('brand'), (req, res) => res.json(store.getShortlist(brandOf(req, req.query.brandId))));
app.post('/api/shortlist', requireRole('brand'), (req, res) => {
  const b = brandOf(req, req.body.brandId);
  if (!store.getBrand(b) || !store.getManufacturer(req.body.manufacturerId)) return res.status(400).json({ error: 'Pick a manufacturer.' });
  res.json(store.addShortlist(b, req.body.manufacturerId, String(req.body.note || '').slice(0, 2000)));
});
app.patch('/api/shortlist/:id', requireRole('brand'), (req, res) => res.json(store.updateShortlist(brandOf(req, req.body.brandId), req.params.id, String(req.body.note || '').slice(0, 2000))));
app.delete('/api/shortlist/:id', requireRole('brand'), (req, res) => res.json(store.removeShortlist(brandOf(req, req.query.brandId), req.params.id)));
app.post('/api/requests', requireRole('brand'), (req, res) => {
  const brandId = brandOf(req, req.body.brandId);
  const { title, category, quantity } = req.body;
  if (!store.getBrand(brandId) || !title || !category || !quantity) return res.status(400).json({ error: 'Title, category and quantity are required.' });
  const r = store.addRequest({ ...req.body, brandId, quantity: Number(quantity), materials: (req.body.materials || []).filter(Boolean) });
  engine.rebuildIndex(); res.json(r);
});

// ---------- Quotes: each side sees and writes only its own conversations ----------
app.get('/api/rfqs', requireRole('brand', 'manufacturer'), (req, res) => {
  if (isAdmin(req)) return res.json(store.getRfqs(req.query));
  res.json(req.user.role === 'brand' ? store.getRfqs({ brandId: req.user.entityId }) : store.getRfqs({ manufacturerId: req.user.entityId }));
});
app.post('/api/rfqs', requireRole('brand', 'manufacturer'), (req, res) => {
  const proposal = req.user.role === 'manufacturer' || (isAdmin(req) && req.body.kind === 'proposal');
  const brandId = proposal ? req.body.brandId : brandOf(req, req.body.brandId);
  const manufacturerId = proposal ? makerOf(req, req.body.manufacturerId) : req.body.manufacturerId;
  const message = String(req.body.message || '').slice(0, 4000);
  if (!store.getBrand(brandId) || !store.getManufacturer(manufacturerId) || !message.trim()) return res.status(400).json({ error: 'Pick who it is for and write a message.' });
  const rfq = store.addRfq({ brandId, manufacturerId, message, kind: proposal ? 'proposal' : 'rfq', status: proposal ? 'proposal' : 'sent', requestTitle: req.body.requestTitle ? String(req.body.requestTitle).slice(0, 200) : undefined, brandName: store.getBrand(brandId).name, manufacturerName: store.getManufacturer(manufacturerId).name });
  const email = proposal ? notify.proposalSent(rfq) : notify.quoteRequested(rfq);
  res.json({ ...rfq, emailed: emailedSummary(email) });
});
app.post('/api/rfqs/:id/reply', requireRole('brand', 'manufacturer'), (req, res) => {
  const rfq = store.getRfqs().find((r) => r.id === req.params.id);
  if (!rfq) return notFound(res);
  const from = isAdmin(req) ? (req.body.from === 'manufacturer' ? 'manufacturer' : 'brand') : req.user.role;
  const owns = isAdmin(req) || (from === 'brand' ? rfq.brandId === req.user.entityId : rfq.manufacturerId === req.user.entityId);
  if (!owns) return res.status(403).json({ error: 'This conversation belongs to another company.' });
  const text = String(req.body.text || '').slice(0, 4000);
  if (!text.trim()) return res.status(400).json({ error: 'Write a reply.' });
  const status = from === 'manufacturer' && req.body.status === 'quoted' ? 'quoted' : undefined;
  const r = store.replyRfq(rfq.id, from, text, status);
  res.json({ ...r, emailed: emailedSummary(notify.replied(r, from, text)) });
});

// ---------- Chat (server-sent events), open to everyone ----------
app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const messages = (req.body.messages || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('Last message must be from the user');
    await engine.chat({ ...req.body, messages, weights: weightsFrom(req.body.weights) }, emit);
  } catch (err) {
    emit('error', { message: err.message });
  }
  res.end();
});

// ---------- Email outbox: you see the emails sent to you; the team sees all ----------
const canSee = (req, e) => isAdmin(req)
  || (req.user?.role === 'manufacturer' && e.about?.audience === 'maker' && e.about.manufacturerId === req.user.entityId)
  || (req.user?.role === 'brand' && e.about?.audience === 'brand' && e.about.brandId === req.user.entityId);
app.get('/api/outbox', requireRole('brand', 'manufacturer'), (req, res) => res.json({ ...notify.mailMode(), emails: store.getOutbox().filter((e) => canSee(req, e)).map(({ html, text, ...e }) => e) }));
app.get('/api/outbox/:id', requireRole('brand', 'manufacturer'), (req, res) => { const e = store.getEmail(req.params.id); e && canSee(req, e) ? res.json(e) : notFound(res); });
app.post('/api/alerts/run', requireRole(), (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only the Meridian Loop team can run the check.' });
  res.json({ created: notify.runCertificateCheck().length });
});

// ---------- Demo reset ----------
app.post('/api/reset', (req, res) => {
  if (!DEMO_MODE) return notFound(res);
  store.resetState(); engine.rebuildIndex(); notify.runCertificateCheck(); res.json({ ok: true });
});

// ---------- Static app ----------
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const PORT = Number(process.env.PORT) || 8787;
  app.listen(PORT, () => {
    console.log(`Meridian Loop running → http://localhost:${PORT}`);
    console.log(`Answer engine: ${llmEnabled() ? `Claude (${MODEL})` : 'built-in (set ANTHROPIC_API_KEY to use Claude)'}`);
    console.log(`Email alerts: ${notify.mailMode().mode === 'smtp' ? 'sending by SMTP' : 'preview only (set SMTP_URL to send)'}`);
  });
}
