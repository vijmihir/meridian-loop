// The two-way search: brands look up manufacturers, manufacturers look up brands.
// Every profile is split into passages, indexed for hybrid retrieval, and answers cite them.
import { Index, parseConstraints, describeConstraints } from './rag.js';
import * as store from './store.js';
import { locate } from './geo.js';
import { certState } from '../data/enrich.js';

let index = new Index();
store.onCompaniesChange(() => rebuildIndex());
const placeOf = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
// Everything here is clothing, so product categories are not worth showing as a filter.
const understood = (c) => describeConstraints({ ...c, categories: [] });
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

export function rebuildIndex() {
  const docs = [];
  for (const m of store.getManufacturers()) {
    const where = `${m.city}, ${m.country}`;
    docs.push({ id: `${m.id}#about`, kind: 'maker', entityId: m.id, title: `${m.name}, ${where}`, text: `${m.name} in ${where} makes ${m.makes}. ${m.about}` });
    docs.push({ id: `${m.id}#capability`, kind: 'maker', entityId: m.id, title: `${m.name}: materials and terms`, text: `Materials: ${m.materials.join(', ')}. Processes: ${m.processes.join(', ')}. Minimum order ${m.moq} units, ${m.moqPerColour} a colour. Lead time ${m.leadTimeDays} days.${m.priceRange ? ` Price ${m.priceRange.currency}${m.priceRange.from} to ${m.priceRange.to} a ${m.priceRange.unit}.` : ''} Samples ${m.sampleCost ? `US$${m.sampleCost} in ${m.sampleDays} days` : 'on request'}. Capacity ${m.capacityPerMonth?.toLocaleString()} a month. Ships ${(m.incoterms || []).join(', ')}.` });
    docs.push({ id: `${m.id}#trace`, kind: 'maker', entityId: m.id, title: `${m.name}: traceability`, text: `${(m.traceability || []).map((t) => `${t.stage} ${t.level}`).join(', ')}.${m.dppReady ? ' Passport-ready: every stage documented for a digital product passport, traceable.' : ''}` });
    if (m.certifications.length) docs.push({ id: `${m.id}#certs`, kind: 'maker', entityId: m.id, title: `${m.name}: certifications`, text: m.certifications.map((c) => `${c.name} from ${c.issuer}${c.validUntil ? `, valid until ${fmtDate(c.validUntil)}` : ''}${c.check?.status === 'checked' ? ', checked in the register' : c.check?.status === 'not-found' ? ', not found in the register' : ''}`).join('. ') + '.' });
  }
  for (const b of store.getBrands()) {
    docs.push({ id: `${b.id}#about`, kind: 'brand', entityId: b.id, title: `${b.name}, ${b.city}`, text: `${b.name} in ${b.city}, ${b.country} sells ${b.sells}. ${b.about} Values: ${b.values.join(', ')}.` });
    b.needs.forEach((n, i) => docs.push({ id: `${b.id}#need${i}`, kind: 'brand', entityId: b.id, need: i, title: `${b.name} is looking for: ${n.title}`, text: `${n.title}. ${n.detail} Materials: ${n.materials.join(', ')}. Quantity ${n.quantity} units. Target ${n.target}.${n.certifications.length ? ` Needs ${n.certifications.join(', ')}.` : ''}${n.countries.length ? ` Prefers ${n.countries.join(', ')}.` : ''}` }));
  }
  index = new Index().build(docs);
  return docs.length;
}

export const stats = () => ({ passages: index.docs.length, makers: store.getManufacturers().length, brands: store.getBrands().length });

const hasCert = (list, wanted) => list.some((c) => c.toLowerCase().includes(wanted.toLowerCase().split(' ')[0].replace('-', '')) || c.toLowerCase().includes(wanted.toLowerCase().split(' ')[0]));

// Rank one side: group passages by company, add up relevance, and check the brief's hard requirements.
function rank(query, kind, checksFor) {
  const constraints = parseConstraints(query);
  // Numbers and limits are checked against each profile below; leaving them in the text
  // would make "under 500 units" favour any profile that happens to say "500".
  const text = query
    .replace(/(?:moq|minimum order|min\.? order|lead time|run size|quantity)[^,.;]*/gi, ' ')
    .replace(/\b(?:within|under|below|less than|fewer than|max(?:imum)?|up to|about|around|roughly)\s*\d[\d,]*\s*(?:units|pieces|pcs|days|weeks)?/gi, ' ')
    .replace(/\b\d[\d,]*\s*(?:units|pieces|pcs|days|weeks)\b/gi, ' ');
  const { results, expansions } = index.search(text.trim() || query, { kinds: [kind], k: 80 });
  const byId = new Map();
  for (const r of results) {
    const e = byId.get(r.doc.entityId) || { score: 0, passages: [] };
    e.score += (e.passages.length ? 0.35 : 1) * r.score;
    e.passages.push(r.doc);
    byId.set(r.doc.entityId, e);
  }
  const top = Math.max(1e-9, ...[...byId.values()].map((e) => e.score));
  const ranked = [...byId.entries()].map(([id, e]) => {
    const checks = checksFor(id, constraints, e);
    const met = checks.filter((c) => c.ok).length;
    const fit = checks.length ? met / checks.length : 1;
    return { id, relevance: e.score / top, fit, checks, meetsAll: met === checks.length, passages: e.passages };
  }).filter((r) => r.relevance >= 0.3);
  ranked.sort((a, b) => (b.meetsAll - a.meetsAll) || (0.75 * b.relevance + 0.25 * b.fit) - (0.75 * a.relevance + 0.25 * a.fit));
  return { constraints, expansions, ranked: ranked.slice(0, 6) };
}

function makerChecks(id, c) {
  const m = store.getManufacturer(id);
  const checks = [];
  if (c.countries.length) checks.push({ label: `In ${c.countries.join(' or ')}`, ok: c.countries.includes(m.country) });
  if (c.excludeCountries.length) checks.push({ label: `Outside ${c.excludeCountries.join(', ')}`, ok: !c.excludeCountries.includes(m.country) });
  for (const want of c.certifications) {
    const have = m.certifications.find((x) => hasCert([x.name], want));
    const st = have ? certState(have) : null;
    checks.push(!have ? { label: `${want} certified`, ok: false }
      : st === 'expired' ? { label: `${want} expired`, ok: false }
      : st === 'not-found' ? { label: `${want} not in the register`, ok: false }
      : { label: `${want} certified${st === 'checked' ? ', checked' : ''}`, ok: !c.verifiedOnly || st === 'checked' });
  }
  if (c.verifiedOnly && !c.certifications.length) checks.push({ label: 'Certificates checked', ok: m.certifications.length > 0 && m.certifications.every((x) => certState(x) === 'checked') });
  if (c.maxPrice && m.priceRange) checks.push({ label: `From US$${m.priceRange.from}, within US$${c.maxPrice}`, ok: m.priceRange.from <= c.maxPrice });
  if (c.minCapacity && m.capacityPerMonth) checks.push({ label: `${m.capacityPerMonth.toLocaleString()} a month, at least ${c.minCapacity.toLocaleString()}`, ok: m.capacityPerMonth >= c.minCapacity });
  if (c.needsDpp) checks.push({ label: 'Passport-ready', ok: Boolean(m.dppReady) });
  if (c.vegan) checks.push({ label: 'Animal-free materials', ok: !/silk|wool|merino|leather(?!.*(cactus|apple))|cashmere/i.test(m.materials.join(' ')) || /cactus|apple/i.test(m.materials.join(' ')) });
  if (c.maxMoq) checks.push({ label: `Minimum order ${m.moq}, within ${c.maxMoq}`, ok: m.moq <= c.maxMoq });
  if (c.maxLeadDays) checks.push({ label: `Lead time ${m.leadTimeDays} days, within ${c.maxLeadDays}`, ok: m.leadTimeDays <= c.maxLeadDays });
  return checks;
}

function brandChecks(id, c, e) {
  const b = store.getBrand(id);
  const need = b.needs[e.passages.find((p) => p.need !== undefined)?.need ?? 0] || b.needs[0];
  const checks = [];
  if (!need) return checks;
  if (c.countries.length) checks.push({ label: need.countries.length ? `Open to ${c.countries.join(' or ')}` : 'Open to any country', ok: !need.countries.length || need.countries.some((x) => c.countries.includes(x)) });
  for (const want of c.certifications) checks.push({ label: `Asks for ${want}`, ok: hasCert(need.certifications, want) });
  if (c.maxMoq) checks.push({ label: `Quantity ${need.quantity}, within ${c.maxMoq}`, ok: need.quantity <= c.maxMoq });
  return checks;
}

// Number the passages the answer may cite, best first, at most eight.
function cite(ranked) {
  const sources = [];
  for (const r of ranked) for (const p of r.passages.slice(0, 2)) if (sources.length < 8) sources.push({ n: sources.length + 1, id: p.id, entityId: p.entityId, title: p.title, text: p.text });
  return sources;
}
const ref = (sources, id) => sources.filter((s) => s.entityId === id).map((s) => `[${s.n}]`).slice(0, 2).join('');

export function search(side, query) {
  if (side === 'maker') {
    const { constraints, expansions, ranked } = rank(query, 'brand', brandChecks);
    const sources = cite(ranked);
    const matches = ranked.map((r) => {
      const b = store.getBrand(r.id);
      const best = r.passages.find((p) => p.need !== undefined);
      const need = b.needs[best ? best.need : 0];
      return { type: 'brand', id: b.id, name: b.name, place: placeOf(b), geo: locate(b.city, b.country), summary: b.sells, need, checks: r.checks, meetsAll: r.meetsAll, why: (best || r.passages[0]).text, cite: ref(sources, b.id) };
    });
    return { side, query, understood: understood(constraints), expansions, sources, matches, answer: composeBrands(matches, sources) };
  }
  const { constraints, expansions, ranked } = rank(query, 'maker', makerChecks);
  const sources = cite(ranked);
  const matches = ranked.map((r) => {
    const m = store.getManufacturer(r.id);
    return { type: 'maker', id: m.id, name: m.name, place: placeOf(m), geo: locate(m.city, m.country), priceRange: m.priceRange, dppReady: m.dppReady, summary: m.makes, moq: m.moq, leadTimeDays: m.leadTimeDays, certifications: m.certifications.map((c) => c.name), checks: r.checks, meetsAll: r.meetsAll, why: r.passages[0].text, cite: ref(sources, m.id) };
  });
  return { side, query, understood: understood(constraints), expansions, sources, matches, answer: composeMakers(matches, sources) };
}

// The built-in answer: short, specific, and every claim points at a numbered source.
function composeMakers(matches) {
  if (!matches.length) return 'No manufacturer on Meridian Loop fits that yet. Try naming a material, a garment or a country.';
  const fits = matches.filter((m) => m.meetsAll);
  const lead = fits.length ? fits : matches;
  const lines = [fits.length || !matches[0].checks.length
    ? `${lead.length === 1 ? 'One manufacturer fits' : `${Math.min(lead.length, 3)} manufacturers fit`} your brief.`
    : 'Nobody meets every requirement, so these are the closest.'];
  for (const m of lead.slice(0, 3)) {
    const miss = m.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    lines.push(`**${m.name}** in ${m.place} makes ${lowerFirst(m.summary)}, from ${m.moq.toLocaleString()} units in ${m.leadTimeDays} days${m.certifications.length ? `, with ${m.certifications.slice(0, 2).join(' and ')}` : ''}.${miss.length ? ` Check: ${miss.join(', ')}.` : ''} ${m.cite}`);
  }
  return lines.join('\n\n');
}

function composeBrands(matches) {
  if (!matches.length) return 'No brand on Meridian Loop is looking for that yet. Try a material you work with, or a garment you make.';
  const lines = [`${matches.length === 1 ? 'One brand is' : `${Math.min(matches.length, 3)} brands are`} looking for something close to what you make.`];
  for (const b of matches.slice(0, 3)) lines.push(`**${b.name}** in ${b.place} wants ${lowerFirst(b.need.title)}: ${b.need.quantity.toLocaleString()} units at ${b.need.target}. ${b.cite}`);
  return lines.join('\n\n');
}
