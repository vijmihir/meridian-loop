// Demo sign-in: pick a company (or the Meridian Loop team) and the server sets a signed, httpOnly cookie.
// There are no passwords because every company here is dummy data; a real launch swaps this for email links.
import crypto from 'node:crypto';
import * as store from './store.js';

const SECRET = process.env.MERIDIAN_SECRET || 'meridian-loop-demo-secret';
const COOKIE = 'ml_session';
const MAX_AGE = 14 * 24 * 3600;
export const TEAM = { id: 'team', role: 'team', name: 'Meridian Loop team' };

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function who(req) {
  const c = readCookie(req);
  if (!c) return null;
  const [body, sig] = c.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let id; try { ({ id } = JSON.parse(Buffer.from(body, 'base64url').toString())); } catch { return null; }
  if (id === 'team') return TEAM;
  const m = store.getManufacturer(id); if (m) return { id, role: 'maker', name: m.name };
  const b = store.getBrand(id); if (b) return { id, role: 'brand', name: b.name };
  return null;
}

export function signIn(res, id) {
  const body = Buffer.from(JSON.stringify({ id, at: Date.now() })).toString('base64url');
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`);
}
export function signOut(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }

// Route guards: 401 when nobody is signed in, 403 when the wrong kind of account is.
export const need = (...roles) => (req, res, next) => {
  const u = who(req);
  if (!u) return res.status(401).json({ error: 'Sign in to do that.', signIn: true });
  if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: roles.includes('brand') ? 'Only a brand account can do that.' : roles.includes('maker') ? 'Only a manufacturer account can do that.' : 'Only the Meridian Loop team can do that.' });
  req.user = u; next();
};
