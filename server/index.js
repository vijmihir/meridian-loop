// Meridian Loop API: two-way search, company profiles, and joining. Serves the built site from /dist.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import * as engine from './engine.js';
import { llmEnabled, MODEL, writeAnswer } from './llm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
app.use(express.json({ limit: '100kb' }));
engine.rebuildIndex();

const notFound = (res) => res.status(404).json({ error: 'Not found' });
const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const list = (v) => clean(v, 400).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
const COUNTRIES_MAKERS = ['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia', 'Sri Lanka', 'Thailand', 'Other'];

app.get('/api/meta', (req, res) => res.json({ ...engine.stats(), answers: llmEnabled() ? 'claude' : 'built-in', demo: process.env.DEMO_MODE !== '0' }));

app.post('/api/search', async (req, res) => {
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

// Contact details stay out of lists; a profile shows them.
const makerCard = ({ email, contact, ...m }) => m;
const brandCard = ({ email, contact, ...b }) => b;
app.get('/api/manufacturers', (req, res) => res.json(store.getManufacturers().map(makerCard)));
app.get('/api/brands', (req, res) => res.json(store.getBrands().map(brandCard)));
app.get('/api/manufacturers/:id', (req, res) => { const m = store.getManufacturer(req.params.id); m ? res.json(m) : notFound(res); });
app.get('/api/brands/:id', (req, res) => { const b = store.getBrand(req.params.id); b ? res.json(b) : notFound(res); });

// Join: a manufacturer lists what it makes, a brand lists what it needs. Both become searchable at once.
app.post('/api/join', (req, res) => {
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
  res.json({ side, id: rec.id });
});

app.post('/api/reset', (req, res) => {
  if (process.env.DEMO_MODE === '0') return notFound(res);
  store.resetState(); engine.rebuildIndex(); res.json({ ok: true });
});

const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const PORT = Number(process.env.PORT) || 8787;
  app.listen(PORT, () => console.log(`Meridian Loop running at http://localhost:${PORT} (answers: ${llmEnabled() ? `Claude, ${MODEL}` : 'built-in'})`));
}
