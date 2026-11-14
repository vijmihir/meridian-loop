// In-memory data store backed by seed data plus a small JSON file for demo changes
// (shortlists, RFQs, uploaded documents, new sourcing requests, profile edits).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCertificate } from './issuers.js';
import { manufacturers as seedM, brands as seedB, products as seedP, traceFor, sampleDocuments } from '../data/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = process.env.MERIDIAN_STATE || path.join(here, '..', 'data', 'state.json');

// Uploaded originals live beside the state file; ids are random hex so paths cannot be steered.
const UPLOAD_DIR = process.env.MERIDIAN_UPLOADS || path.join(path.dirname(STATE_FILE), 'uploads');
const UPLOAD_ID = /^[a-f0-9]{24}$/;
export function saveUpload(buf) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(path.join(UPLOAD_DIR, id), buf);
  return id;
}
export const uploadPath = (id) => (UPLOAD_ID.test(id || '') && fs.existsSync(path.join(UPLOAD_DIR, id)) ? path.join(UPLOAD_DIR, id) : null);

const emptyState = () => ({ shortlist: [], rfqs: [], documents: [], requests: [], profileEdits: {}, certUpdates: {}, outbox: [], alertsSent: {}, accounts: [], newManufacturers: [], newBrands: [] });
let state = emptyState();
try { state = { ...emptyState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* first run */ }

const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
export const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);

export function resetState() {
  state = emptyState(); save();
  try { for (const f of fs.readdirSync(UPLOAD_DIR)) if (UPLOAD_ID.test(f)) fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch { /* no uploads yet */ }
}

export function getManufacturers() {
  return [...seedM, ...state.newManufacturers].map((m) => {
    const edits = state.profileEdits[m.id] || {};
    const certs = m.certifications.map((c) => ({ ...c }));
    for (const u of state.certUpdates[m.id] || []) {
      const existing = certs.find((c) => c.name.toLowerCase().split(' ')[0] === u.name.toLowerCase().split(' ')[0]);
      if (existing) Object.assign(existing, { id: u.id || existing.id, issuer: u.issuer || existing.issuer, expires: u.expires || existing.expires, verified: u.verified ?? true, evidence: u.documentId });
      else certs.push({ name: u.name, id: u.id, issuer: u.issuer, expires: u.expires, verified: u.verified ?? true, evidence: u.documentId });
    }
    for (const c of certs) c.registry = verifyCertificate({ standard: c.name, number: c.id, holder: m.name, expires: c.expires });
    return { ...m, ...edits, certifications: certs };
  });
}
export const getManufacturer = (id) => getManufacturers().find((m) => m.id === id);

export function updateManufacturer(id, patch) {
  const allowed = ['description', 'moq', 'leadTimeDays', 'capacity', 'products', 'contact', 'sampleDays'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  for (const k of ['moq', 'leadTimeDays', 'capacity', 'sampleDays']) if (k in clean) clean[k] = Number(clean[k]);
  state.profileEdits[id] = { ...(state.profileEdits[id] || {}), ...clean };
  save();
  return getManufacturer(id);
}

export function getBrands() {
  return [...seedB, ...state.newBrands].map((b) => ({ ...b, sourcingRequests: [...b.sourcingRequests, ...state.requests.filter((r) => r.brandId === b.id)] }));
}
export const getBrand = (id) => getBrands().find((b) => b.id === id);
export const getRequests = () => getBrands().flatMap((b) => b.sourcingRequests.map((r) => ({ ...r, brandId: b.id, brandName: b.name, brandHq: b.hq })));

export function addRequest(r) {
  const req = { id: uid('r'), createdAt: new Date().toISOString(), preferredCountries: [], materials: [], ...r };
  state.requests.push(req); save(); return req;
}

export function getProducts() {
  const ms = getManufacturers(); const bs = getBrands();
  return seedP.map((p) => {
    const m = ms.find((x) => x.id === p.manufacturerId); const b = bs.find((x) => x.id === p.brandId);
    return { ...p, brandName: b.name, manufacturerName: m.name, madeIn: m.country, trace: traceFor(p, m, b) };
  });
}
export const getProduct = (id) => getProducts().find((p) => p.id === id);

// Shortlist (brand workspace)
// Shortlists belong to one brand each.
export const getShortlist = (brandId) => state.shortlist.filter((s) => s.brandId === brandId);
export function addShortlist(brandId, manufacturerId, note = '') {
  if (!state.shortlist.find((s) => s.brandId === brandId && s.manufacturerId === manufacturerId)) state.shortlist.push({ brandId, manufacturerId, note, addedAt: new Date().toISOString() });
  save(); return getShortlist(brandId);
}
export function updateShortlist(brandId, manufacturerId, note) {
  const s = state.shortlist.find((x) => x.brandId === brandId && x.manufacturerId === manufacturerId); if (s) s.note = note; save(); return getShortlist(brandId);
}
export function removeShortlist(brandId, manufacturerId) { state.shortlist = state.shortlist.filter((s) => !(s.brandId === brandId && s.manufacturerId === manufacturerId)); save(); return getShortlist(brandId); }

// RFQs between brands and manufacturers
export const getRfqs = (f = {}) => state.rfqs.filter((r) => (!f.manufacturerId || r.manufacturerId === f.manufacturerId) && (!f.brandId || r.brandId === f.brandId));
export function addRfq(r) {
  const rfq = { id: uid('rfq'), status: 'sent', createdAt: new Date().toISOString(), replies: [], ...r };
  state.rfqs.unshift(rfq); save(); return rfq;
}
export function replyRfq(id, from, text, status) {
  const r = state.rfqs.find((x) => x.id === id); if (!r) return null;
  r.replies.push({ from, text, at: new Date().toISOString() }); if (status) r.status = status; save(); return r;
}

// Documents (document intelligence)
export const getDocument = (id) => state.documents.find((d) => d.id === id);
export const getDocuments = (manufacturerId) => state.documents.filter((d) => !manufacturerId || d.manufacturerId === manufacturerId);
export function addDocument(doc) {
  const d = { id: uid('doc'), createdAt: new Date().toISOString(), ...doc };
  state.documents.push(d);
  const ex = doc.extracted;
  if (ex?.standard && ex.expires) {
    state.certUpdates[doc.manufacturerId] = [...(state.certUpdates[doc.manufacturerId] || []), { name: ex.standard, id: ex.number, issuer: ex.issuer, expires: ex.expires, documentId: d.id, verified: ['confirmed', 'manual'].includes(ex.registry?.status) }];
  }
  save(); return d;
}

// Email outbox: every alert the platform writes, sent or not.
const OUTBOX_MAX = 300;
export const getOutbox = () => state.outbox;
export const getEmail = (id) => state.outbox.find((e) => e.id === id);
export function addEmail(email) {
  const e = { id: uid('mail'), createdAt: new Date().toISOString(), status: 'preview', ...email };
  state.outbox.unshift(e);
  state.outbox.length = Math.min(state.outbox.length, OUTBOX_MAX);
  save(); return e;
}
export function updateEmail(id, patch) { const e = getEmail(id); if (e) { Object.assign(e, patch); save(); } return e; }
// Remembers which certificate alerts went out, so each problem is emailed once per stage.
export const alertSent = (key) => Boolean(state.alertsSent[key]);
export function markAlerts(keys) { for (const k of keys) state.alertsSent[k] = new Date().toISOString(); save(); }

// Accounts created through sign-up, and the profiles they bring with them.
export const getAccounts = () => state.accounts;
export function addAccount(acct) { state.accounts.push(acct); save(); return acct; }
export function addManufacturerProfile(m) { state.newManufacturers.push(m); save(); return m; }
export function addBrandProfile(b) { state.newBrands.push(b); save(); return b; }

export { sampleDocuments };
