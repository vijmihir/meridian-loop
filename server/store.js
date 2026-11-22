// Everything Meridian Loop knows. Seed companies are read-only; what changes (joined companies, profile edits,
// quote requests, quotes, notifications, the email outbox, saved searches, documents, events) lives in one
// state document, kept by persist.js in Postgres when DATABASE_URL is set, else in a JSON file.
import crypto from 'node:crypto';
import { manufacturers, brands } from '../data/seed.js';
import { moreManufacturers, moreBrands } from '../data/seed-more.js';
import { scenarioManufacturers, scenarioBrands, seedActivity } from '../data/scenarios.js';
import { enrichMaker } from '../data/enrich.js';
import { backend } from './persist.js';

const seedMakers = [...manufacturers, ...moreManufacturers, ...scenarioManufacturers];
const seedBrands = [...brands, ...moreBrands, ...scenarioBrands];
const SEED_IDS = new Set([...seedMakers, ...seedBrands].map((x) => x.id));

export const MAX_JOINED = 200;
export const MAX_DOCS = 60;
const LIST_CAP = { notifications: 500, outbox: 300, events: 3000, saved: 200, rfqs: 300, quotes: 1500 };

const fresh = () => ({ manufacturers: [], brands: [], edits: {}, docs: [], outbox: [], events: [], ...seedActivity() });

// Keep only what has the right shape, so a damaged or old document can never crash a request.
function sanitise(raw) {
  const base = fresh();
  if (!raw || typeof raw !== 'object') return base;
  const arr = (v, ok) => (Array.isArray(v) ? v.filter(ok) : null);
  const hasId = (x) => x && typeof x === 'object' && typeof x.id === 'string';
  return {
    manufacturers: arr(raw.manufacturers, (m) => hasId(m) && typeof m.name === 'string' && Array.isArray(m.materials) && Array.isArray(m.certifications)) ?? [],
    brands: arr(raw.brands, (b) => hasId(b) && typeof b.name === 'string' && Array.isArray(b.needs)) ?? [],
    edits: raw.edits && typeof raw.edits === 'object' && !Array.isArray(raw.edits) ? raw.edits : {},
    rfqs: arr(raw.rfqs, (r) => hasId(r) && Array.isArray(r.makerIds)) ?? base.rfqs,
    quotes: arr(raw.quotes, (q) => hasId(q) && typeof q.rfqId === 'string') ?? base.quotes,
    notifications: arr(raw.notifications, hasId) ?? base.notifications,
    outbox: arr(raw.outbox, (o) => o && typeof o === 'object') ?? [],
    events: arr(raw.events, (e) => e && typeof e.type === 'string') ?? [],
    saved: arr(raw.saved, hasId) ?? base.saved,
    docs: arr(raw.docs, hasId) ?? [],
    pilot: raw.pilot && typeof raw.pilot === 'object' ? raw.pilot : base.pilot,
  };
}

let state = fresh();
let loaded = false, stamp = null, lastCheck = 0, loading = null;
const listeners = new Set();
export const onCompaniesChange = (fn) => listeners.add(fn);
const companiesChanged = () => { cache = null; for (const fn of listeners) fn(); };

// Load once; with Postgres, look again at most every two seconds so every instance sees the others' writes.
export async function ready() {
  const now = Date.now();
  if (loaded && (backend.kind === 'file' || now - lastCheck < 2000)) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      lastCheck = now;
      const s = await backend.stamp();
      if (loaded && s === stamp) return;
      const raw = await backend.load();
      state = sanitise(raw);
      stamp = s; loaded = true;
      if (!raw) await backend.save(state);
      companiesChanged();
    } catch (err) {
      console.error(`Could not read stored state (${err.message}); using what is in memory.`);
      loaded = true;
    } finally { loading = null; }
  })();
  return loading;
}
// Writes are grouped: changes within 150ms go out as one save. Routes that change something await flush().
let timer = null, waiters = [];
export function save() {
  for (const [k, cap] of Object.entries(LIST_CAP)) if (state[k].length > cap) state[k] = state[k].slice(-cap);
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null; const done = waiters; waiters = [];
      try { await backend.save(state); stamp = await backend.stamp(); } catch (err) { console.error(`Save failed: ${err.message}`); }
      for (const f of done) f();
    }, 150);
  });
}
export const flush = () => (timer ? new Promise((resolve) => waiters.push(resolve)) : Promise.resolve());
export const storageKind = () => backend.kind;

// ---------- companies ----------
let cache = null;
function build() {
  const apply = (x) => (state.edits[x.id] ? { ...x, ...state.edits[x.id], id: x.id } : x);
  const makers = [...seedMakers, ...state.manufacturers].map(apply).map(enrichMaker);
  const brandsAll = [...seedBrands, ...state.brands].map(apply);
  cache = { makers, brands: brandsAll, makerById: new Map(makers.map((m) => [m.id, m])), brandById: new Map(brandsAll.map((b) => [b.id, b])) };
  return cache;
}
const C = () => cache || build();
export const getManufacturers = () => C().makers;
export const getBrands = () => C().brands;
export const getManufacturer = (id) => C().makerById.get(id);
export const getBrand = (id) => C().brandById.get(id);
export const getCompany = (id) => getManufacturer(id) || getBrand(id);
export const joinedCount = () => state.manufacturers.length + state.brands.length;
export const isSeed = (id) => SEED_IDS.has(id);

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const uniqueId = (name) => {
  const base = slug(name) || 'company';
  return getCompany(base) ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base;
};
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

export function addManufacturer(m) { const rec = { ...m, id: uniqueId(m.name), joined: new Date().toISOString() }; state.manufacturers.push(rec); companiesChanged(); save(); return getManufacturer(rec.id); }
export function addBrand(b) { const rec = { ...b, id: uniqueId(b.name), joined: new Date().toISOString() }; state.brands.push(rec); companiesChanged(); save(); return getBrand(rec.id); }
export function editCompany(id, patch) {
  state.edits[id] = { ...(state.edits[id] || {}), ...patch, updatedAt: new Date().toISOString() };
  companiesChanged(); save(); return getCompany(id);
}
export function setCertificateCheck(makerId, certName, check) {
  const m = getManufacturer(makerId); if (!m) return null;
  const certifications = m.certifications.map((c) => (c.name === certName ? { ...c, check } : c));
  return editCompany(makerId, { certifications });
}

// ---------- quote requests and quotes ----------
export const rfqs = () => state.rfqs;
export const getRfq = (id) => state.rfqs.find((r) => r.id === id);
export const quotesFor = (rfqId) => state.quotes.filter((q) => q.rfqId === rfqId);
export const quotesByMaker = (makerId) => state.quotes.filter((q) => q.makerId === makerId);
export function addRfq(r) { state.rfqs.push(r); save(); return r; }
export function updateRfq(id, patch) { const r = getRfq(id); if (r) Object.assign(r, patch); save(); return r; }
export function upsertQuote(q) {
  const i = state.quotes.findIndex((x) => x.id === q.id);
  if (i >= 0) state.quotes[i] = { ...state.quotes[i], ...q }; else state.quotes.push(q);
  save(); return state.quotes.find((x) => x.id === q.id);
}

// ---------- notifications, email outbox, saved searches, documents, events ----------
export function notify(to, kind, title, body, link) {
  const n = { id: newId('n'), to, kind, title, body, link, at: new Date().toISOString(), read: false };
  state.notifications.push(n);
  const c = getCompany(to);
  if (c?.email) state.outbox.push({ to: c.email, name: c.contact, subject: title, body: `${body}\n\nOpen it on Meridian Loop: ${link}`, at: n.at });
  save(); return n;
}
export const notificationsFor = (id) => state.notifications.filter((n) => n.to === id).sort((a, b) => b.at.localeCompare(a.at));
export function markRead(id, ids) { for (const n of state.notifications) if (n.to === id && (!ids || ids.includes(n.id))) n.read = true; save(); }
export const outbox = () => [...state.outbox].reverse();

export const savedFor = (owner) => state.saved.filter((s) => s.owner === owner);
export const allSaved = () => state.saved;
export function addSaved(owner, query) { const s = { id: newId('s'), owner, query, at: new Date().toISOString() }; state.saved.push(s); save(); return s; }
export function removeSaved(owner, id) { state.saved = state.saved.filter((s) => !(s.owner === owner && s.id === id)); save(); }

export const docsFor = (owner) => state.docs.filter((d) => d.owner === owner).map(({ data, ...d }) => d);
export const getDoc = (id) => state.docs.find((d) => d.id === id);
export function addDoc(d) {
  if (state.docs.length >= MAX_DOCS) state.docs.shift();
  const rec = { id: newId('doc'), at: new Date().toISOString(), ...d }; state.docs.push(rec); save();
  const { data, ...meta } = rec; return meta;
}
export function removeDoc(owner, id) { state.docs = state.docs.filter((d) => !(d.owner === owner && d.id === id)); save(); }

export function track(type, props = {}) { state.events.push({ type, at: new Date().toISOString(), ...props }); save(); }
export const events = () => state.events;
export const pilot = () => state.pilot;

export async function resetState() { state = fresh(); companiesChanged(); await save(); }
