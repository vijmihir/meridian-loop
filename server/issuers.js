// Issuer checks: confirms a certificate against the register kept by the body that issued it.
//
// Real registers (GOTS, Textile Exchange, OEKO-TEX, FSC...) publish search pages, not open APIs,
// and the demo's certificates are fictional. So this module checks against a DEMO REGISTER that
// stands in for each issuer's database, and always returns the issuer's real public lookup page
// so a person can check by hand. In production, replace `lookup()` with partner feeds or APIs.
import { manufacturers } from '../data/seed.js';

// One entry per standard: how to recognise it, its register and what its numbers look like.
export const REGISTERS = [
  { key: 'gots', label: 'GOTS', match: /\bgots\b/i, name: 'GOTS certified suppliers database', url: 'https://global-standard.org/find-suppliers-shops-and-inputs/certified-suppliers', format: /GOTS/i },
  { key: 'te', label: 'GRS, RCS', match: /\b(grs|rcs)\b/i, name: 'Textile Exchange certified company search', url: 'https://textileexchange.org/', format: /(GRS|RCS)/i },
  { key: 'oekotex', label: 'OEKO-TEX Standard 100, STeP', match: /oeko-?tex/i, name: 'OEKO-TEX Label Check', url: 'https://www.oeko-tex.com/en/label-check', format: /^(OT|STEP)-/i },
  { key: 'fsc', label: 'FSC Chain of Custody', match: /\bfsc\b/i, name: 'FSC public certificate search', url: 'https://search.fsc.org/', format: /^FSC-C\d{6}$/ },
  { key: 'bluesign', label: 'bluesign', match: /bluesign/i, name: 'bluesign system partners', url: 'https://www.bluesign.com/en/', format: /^BS-/ },
  { key: 'fairtrade', label: 'Fair Trade, WFTO', match: /fair ?trade|wfto/i, name: 'Fair trade member registers (WFTO, Fairtrade, Fair Trade USA)', url: 'https://www.fairtrade.net/', format: /^(FT|WFTO|FTUSA)/i },
  { key: 'sa8000', label: 'SA8000', match: /sa ?8000/i, name: 'SAI certified facilities list', url: 'https://sa-intl.org/', format: /^SA-/ },
  { key: 'lwg', label: 'LWG', match: /\blwg\b/i, name: 'Leather Working Group audited members', url: 'https://www.leatherworkinggroup.com/', format: /^LWG-/ },
  { key: 'wrap', label: 'WRAP', match: /\bwrap\b/i, name: 'WRAP certified facilities', url: 'https://wrapcompliance.org/', format: /^WRAP-/ },
  { key: 'smeta', label: 'SMETA', match: /smeta|sedex/i, name: 'Sedex audit records', url: 'https://www.sedex.com/', format: /^SED-/ },
  { key: 'zdhc', label: 'ZDHC', match: /zdhc/i, name: 'ZDHC Gateway', url: 'https://www.zdhc-gateway.com/', format: /^ZDHC-/ },
];

// The demo register: every seed certificate as its issuer would hold it, plus a few deliberate
// differences so the checks have something to catch.
const EXCEPTIONS = {
  'OT-22.BD.54012': { status: 'withdrawn', changed: '2026-09-14', note: 'Withdrawn by the issuer after a failed retest' },
  'LWG-KN-0441': { validUntil: '2027-01-31' }, // the issuer's record ends six months before the date the maker shows
};
const EXTRA = [
  // Certificates in the sample PDFs, so uploading them confirms cleanly.
  { number: 'CU-GOTS-990311', holder: 'Mekong Fair Apparel', validUntil: '2027-11-30', status: 'valid' },
  { number: 'OT-26.VN.80210-R', holder: 'Da Nang Bamboo Textiles', validUntil: '2027-10-31', status: 'valid' },
  { number: 'SED-ZC-998812-R2', holder: 'Ganga Tannery & Leathercraft', validUntil: '2027-09-30', status: 'valid' },
];

const REGISTER = new Map();
for (const m of manufacturers) {
  for (const c of m.certifications) {
    if (!registerFor(c.name)) continue;
    REGISTER.set(c.id, { number: c.id, holder: m.name, validUntil: c.expires, status: c.verified ? 'valid' : 'pending', ...EXCEPTIONS[c.id] });
  }
}
for (const r of EXTRA) REGISTER.set(r.number, r);

export function registerFor(standard) {
  return REGISTERS.find((r) => r.match.test(standard || '')) || null;
}

const lookup = (number) => REGISTER.get((number || '').trim()) || null;
const sameName = (a, b) => (a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === (b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Status: confirmed, mismatch, withdrawn, not_found, or manual (no register to check against).
export function verifyCertificate({ standard, number, holder, expires }) {
  const reg = registerFor(standard);
  const base = { register: reg ? { name: reg.name, url: reg.url } : null, source: 'demo register', checkedAt: new Date().toISOString() };
  if (!reg) return { ...base, status: 'manual', note: 'No public register for this standard. Check it with the issuing body.' };
  if (!number) return { ...base, status: 'not_found', note: 'No certificate number to look up.' };
  if (!reg.format.test(number)) return { ...base, status: 'not_found', note: `“${number}” is not in the number format this register uses.` };
  const rec = lookup(number);
  if (!rec) return { ...base, status: 'not_found', note: `${number} is not in the ${reg.name}.` };
  if (rec.status === 'withdrawn' || rec.status === 'suspended') return { ...base, status: 'withdrawn', record: rec, note: `${rec.note || 'Withdrawn by the issuer'} on ${fmt(rec.changed)}.` };
  if (rec.status === 'pending') return { ...base, status: 'not_found', record: rec, note: 'The issuer has not published this certificate yet.' };
  if (holder && !sameName(rec.holder, holder)) return { ...base, status: 'mismatch', record: rec, note: `The register lists this number for ${rec.holder}, not ${holder}.` };
  if (expires && rec.validUntil !== expires) return { ...base, status: 'mismatch', record: rec, note: `The register says valid until ${fmt(rec.validUntil)}, not ${fmt(expires)}.` };
  return { ...base, status: 'confirmed', record: rec, note: `Listed for ${rec.holder}, valid until ${fmt(rec.validUntil)}.` };
}

export const registerSummary = () => REGISTERS.map((r) => ({ standards: r.label, name: r.name, url: r.url }));
