// Accounts, passwords and sessions.
// Passwords are hashed with scrypt; sessions are HMAC-signed, HttpOnly cookies.
// Seeded demo accounts (one per brand and manufacturer, a shopper and the team) share DEMO_PASSWORD.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { makerContact, brandContact } from './notify.js';
import { manufacturers as seedM, brands as seedB, DEMO_PASSWORD } from '../data/seed.js';

export const DEMO_MODE = process.env.DEMO_MODE !== '0';
const COOKIE = 'ml_session';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- Secret for signing sessions (kept across restarts, never in git) ----------
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(path.dirname(process.env.MERIDIAN_STATE || path.join(here, '..', 'data', 'state.json')), '.session-secret');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(file, s, { mode: 0o600 }); } catch { /* read-only disk: sessions end on restart */ }
  return s;
}
const SECRET = loadSecret();

// ---------- Passwords ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(String(pw), salt, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Accounts ----------
const DEMO_HASH = hashPassword(DEMO_PASSWORD);
const SEED_ACCOUNTS = [
  { id: 'acct-team', role: 'admin', entityId: null, name: 'Meridian Loop team', email: 'team@meridian-loop.example', password: DEMO_HASH },
  { id: 'acct-shopper', role: 'shopper', entityId: null, name: 'Demo shopper', email: 'shopper@meridian-loop.example', password: DEMO_HASH },
  ...seedB.map((b) => ({ id: `acct-${b.id}`, role: 'brand', entityId: b.id, name: `${b.name} sourcing team`, email: brandContact(b).email, password: DEMO_HASH })),
  ...seedM.map((m) => ({ id: `acct-${m.id}`, role: 'manufacturer', entityId: m.id, name: makerContact(m).name, email: makerContact(m).email, password: DEMO_HASH })),
];
const allAccounts = () => [...SEED_ACCOUNTS, ...store.getAccounts()];
const byEmail = (email) => allAccounts().find((a) => a.email === String(email || '').trim().toLowerCase());
const byId = (id) => allAccounts().find((a) => a.id === id);

function entityName(a) {
  if (a.role === 'brand') return store.getBrand(a.entityId)?.name;
  if (a.role === 'manufacturer') return store.getManufacturer(a.entityId)?.name;
  return null;
}
export const publicUser = (a) => a && ({ id: a.id, role: a.role, entityId: a.entityId, name: a.name, email: a.email, entityName: entityName(a) });

// ---------- Sessions ----------
const b64 = (s) => Buffer.from(s).toString('base64url');
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function sign(payload) { const body = b64(JSON.stringify(payload)); return `${body}.${mac(body)}`; }
function unsign(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = mac(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const readCookie = (req, name) => (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];
function setSession(req, res, acct) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${sign({ a: acct.id, exp: Date.now() + WEEK })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${WEEK / 1000}${secure}`);
}
const clearSession = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

// Attaches req.user (or null) from the session cookie.
export function attachUser(req, res, next) {
  const p = unsign(readCookie(req, COOKIE));
  req.user = p ? publicUser(byId(p.a)) || null : null;
  next();
}

// Route guard: signed in, with one of the given roles (the team account passes every guard).
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to do that.' });
  if (req.user.role !== 'admin' && roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: `Only ${roles.join(' or ')} accounts can do that.` });
  next();
};

// ---------- Sign-in attempts: at most 8 failures per email and address every 10 minutes ----------
const attempts = new Map();
const tooMany = (key) => { const a = (attempts.get(key) || []).filter((t) => t > Date.now() - 10 * 60 * 1000); attempts.set(key, a); return a.length >= 8; };
const fail = (key) => attempts.set(key, [...(attempts.get(key) || []), Date.now()]);

// ---------- Sign-up ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRIES = ['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia'];
const CATEGORIES = ['Fashion', 'Footwear', 'Accessories', 'Home Textiles'];
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const clean = (s, n = 120) => String(s || '').trim().slice(0, n);

function signUp(body, onCreated) {
  const role = body.role;
  const name = clean(body.name, 80), email = clean(body.email, 120).toLowerCase(), password = String(body.password || '');
  const errors = {};
  if (!['brand', 'manufacturer', 'shopper'].includes(role)) errors.role = 'Choose brand, manufacturer or shopper.';
  if (!name) errors.name = 'Add your name.';
  if (!EMAIL.test(email)) errors.email = 'That email address looks incomplete.';
  else if (byEmail(email)) errors.email = 'An account with this email already exists. Sign in instead.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  const company = clean(body.company, 80);
  if (role !== 'shopper' && !company) errors.company = 'Add your company name.';
  const categories = (Array.isArray(body.categories) ? body.categories : []).filter((c) => CATEGORIES.includes(c));
  if (role !== 'shopper' && !categories.length) errors.categories = 'Pick at least one category.';
  if (role === 'manufacturer') {
    if (!COUNTRIES.includes(body.country)) errors.country = 'Pick the country you make in.';
    if (!clean(body.city)) errors.city = 'Add your city.';
  }
  if (Object.keys(errors).length) return { errors };

  const id = (prefix) => `${prefix}-${slug(company || name)}-${crypto.randomBytes(2).toString('hex')}`;
  let entityId = null;
  if (role === 'manufacturer') {
    const materials = clean(body.materials, 300).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12);
    const m = store.addManufacturerProfile({
      id: id('m'), name: company, country: body.country, city: clean(body.city, 60), founded: new Date().getFullYear(), employees: 0,
      categories, materials, processes: [], products: clean(body.products, 200) || categories.join(', '),
      certifications: [], moq: Math.max(1, Number(body.moq) || 500), leadTimeDays: Math.max(1, Number(body.leadTimeDays) || 45), priceIndex: 3,
      capacity: 0, onTimeRate: 0.85, defectRate: 0.025, auditScore: 60, renewableEnergy: 0, waterRecycled: 0, sampleDays: 14,
      contact: name, contactEmail: email, exportMarkets: [], isNew: true,
      description: clean(body.description, 600) || `${company} joined Meridian Loop in ${new Date().getFullYear()}.`,
    });
    entityId = m.id;
  }
  if (role === 'brand') {
    const b = store.addBrandProfile({
      id: id('b'), name: company, hq: clean(body.hq, 60) || 'Hong Kong', founded: new Date().getFullYear(), category: categories[0],
      tagline: '', story: clean(body.description, 600) || `${company} joined Meridian Loop in ${new Date().getFullYear()}.`, values: [], transparency: 50, sourcingRequests: [], contactEmail: email,
    });
    entityId = b.id;
  }
  const acct = store.addAccount({ id: `acct-${crypto.randomBytes(6).toString('hex')}`, role, entityId, name, email, password: hashPassword(password), createdAt: new Date().toISOString() });
  onCreated?.();
  return { acct };
}

// ---------- Routes ----------
export function mountAuth(app, { onProfileCreated } = {}) {
  app.get('/api/auth/me', (req, res) => res.json({
    user: req.user,
    demo: DEMO_MODE,
    demoAccounts: DEMO_MODE ? SEED_ACCOUNTS.map((a) => ({ id: a.id, role: a.role, name: a.name, entityName: entityName(a) })) : [],
  }));

  app.post('/api/auth/login', (req, res) => {
    const key = `${String(req.body.email || '').toLowerCase()}|${req.ip}`;
    if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Wait ten minutes and try again.' });
    const acct = byEmail(req.body.email);
    if (!acct || !verifyPassword(req.body.password, acct.password)) { fail(key); return res.status(401).json({ error: 'That email and password don’t match an account.' }); }
    setSession(req, res, acct);
    res.json({ user: publicUser(acct) });
  });

  app.post('/api/auth/demo', (req, res) => {
    if (!DEMO_MODE) return res.status(404).json({ error: 'Not found' });
    const acct = SEED_ACCOUNTS.find((a) => a.id === req.body.accountId);
    if (!acct) return res.status(400).json({ error: 'Unknown demo account.' });
    setSession(req, res, acct);
    res.json({ user: publicUser(acct) });
  });

  app.post('/api/auth/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

  app.post('/api/auth/signup', (req, res) => {
    const { errors, acct } = signUp(req.body, onProfileCreated);
    if (errors) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
    setSession(req, res, acct);
    res.json({ user: publicUser(acct) });
  });
}
