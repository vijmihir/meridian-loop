// Companies on Meridian Loop: the seed data plus any that joined through the site.
// Joined companies are kept in data/state.json so they survive a restart.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { manufacturers as seedMakers, brands as seedBrands } from '../data/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = process.env.MERIDIAN_STATE || path.join(here, '..', 'data', 'state.json');

const empty = () => ({ manufacturers: [], brands: [] });
let state = empty();
try { state = { ...empty(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* first run */ }
const save = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* read-only disk: keep in memory */ } };

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
