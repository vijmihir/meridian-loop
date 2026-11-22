// Companies on Meridian Loop: the seed data plus any that joined through the site.
// Joined companies are kept in data/state.json so they survive a restart.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { manufacturers, brands } from '../data/seed.js';
import { moreManufacturers, moreBrands } from '../data/seed-more.js';

const seedMakers = [...manufacturers, ...moreManufacturers];
const seedBrands = [...brands, ...moreBrands];

const here = path.dirname(fileURLToPath(import.meta.url));
// Serverless hosts (Vercel) only allow writes under /tmp, and each instance has its own copy.
const STATE_FILE = process.env.MERIDIAN_STATE || (process.env.VERCEL ? '/tmp/meridian-state.json' : path.join(here, '..', 'data', 'state.json'));

export const MAX_JOINED = 200;
const empty = () => ({ manufacturers: [], brands: [] });

// Read the saved state defensively: a missing file is a first run; a damaged one is set aside, never fatal.
function load() {
  let raw;
  try { raw = fs.readFileSync(STATE_FILE, 'utf8'); } catch { return empty(); }
  try {
    const parsed = JSON.parse(raw);
    const ok = (x) => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string';
    return {
      manufacturers: Array.isArray(parsed.manufacturers) ? parsed.manufacturers.filter((m) => ok(m) && Array.isArray(m.materials) && Array.isArray(m.certifications)) : [],
      brands: Array.isArray(parsed.brands) ? parsed.brands.filter((b) => ok(b) && Array.isArray(b.needs)) : [],
    };
  } catch (err) {
    console.error(`State file unreadable (${err.message}); starting empty and keeping a copy.`);
    try { fs.copyFileSync(STATE_FILE, `${STATE_FILE}.broken-${Date.now()}`); } catch { /* nothing to keep */ }
    return empty();
  }
}
let state = load();

// Write to a temporary file, then rename, so a crash mid-write can never leave half a file.
const save = () => {
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); fs.renameSync(tmp, STATE_FILE); }
  catch (err) { console.error(`Could not save state (${err.message}); keeping it in memory.`); }
};
export const joinedCount = () => state.manufacturers.length + state.brands.length;

export const getManufacturers = () => [...seedMakers, ...state.manufacturers];
export const getBrands = () => [...seedBrands, ...state.brands];
export const getManufacturer = (id) => getManufacturers().find((m) => m.id === id);
export const getBrand = (id) => getBrands().find((b) => b.id === id);

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const uniqueId = (name) => {
  const base = slug(name) || 'company';
  return getManufacturers().some((m) => m.id === base) || getBrands().some((b) => b.id === base) ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base;
};

export function addManufacturer(m) { const rec = { ...m, id: uniqueId(m.name), joined: new Date().toISOString() }; state.manufacturers.push(rec); save(); return rec; }
export function addBrand(b) { const rec = { ...b, id: uniqueId(b.name), joined: new Date().toISOString() }; state.brands.push(rec); save(); return rec; }
export function resetState() { state = empty(); save(); }
