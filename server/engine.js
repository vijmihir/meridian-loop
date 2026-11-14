// The Meridian Loop engine: builds the knowledge base, runs retrieval + quantitative
// ranking for each audience, and composes grounded answers with citations.
import { Index, parseConstraints, describeConstraints } from './rag.js';
import { scoreManufacturer, composite, checkConstraints, explain, DEFAULT_WEIGHTS, certStatus } from './scoring.js';
import * as store from './store.js';
import { llmEnabled, streamAnswer } from './llm.js';

const GLOSSARY = [
  ['GOTS', 'Global Organic Textile Standard: certifies textiles with at least 70% certified organic fibre (95% for the "organic" label grade) and checks chemical use, wastewater treatment and social criteria across the whole processing chain. Look for a valid scope certificate and transaction certificates per shipment.'],
  ['GRS', 'Global Recycled Standard (Textile Exchange): verifies recycled content (minimum 20%, 50% for the label) plus social, environmental and chemical requirements, with chain of custody from recycler to final product.'],
  ['RCS', 'Recycled Claim Standard (Textile Exchange): verifies recycled content and chain of custody only, without the social and environmental requirements of GRS.'],
  ['OEKO-TEX Standard 100', 'OEKO-TEX Standard 100: a product-level test that the finished article is free from a long list of harmful substances. Product Class I is the strictest (baby articles). It says nothing about fibre origin or working conditions.'],
  ['bluesign', 'bluesign: a chemical-management system for textile mills; a bluesign SYSTEM PARTNER uses approved chemistry and controls emissions, water and worker safety.'],
  ['Fair Trade', 'Fair Trade (Fairtrade Textile, Fair Trade USA Factory, WFTO): standards that require fair wages, safe conditions and often a community premium paid to workers. WFTO certifies the whole organisation as a fair trade enterprise.'],
  ['SA8000', 'SA8000: a social accountability standard for workplaces covering child labour, forced labour, health and safety, freedom of association, working hours and remuneration.'],
  ['LWG', 'Leather Working Group: environmental audit for tanneries (Gold, Silver, Bronze) covering chemicals, water, energy, waste and traceability of hides.'],
  ['Higg FEM', 'Higg Facility Environmental Module (Cascale): a self-assessment of a facility’s environmental performance; "verified" means a third party checked the data.'],
  ['ZDHC', 'ZDHC (Zero Discharge of Hazardous Chemicals): a programme setting chemical input (MRSL) and wastewater limits; Level 3 is the most advanced conformance.'],
  ['FSC', 'FSC Chain of Custody: tracks forest-based materials (wood-based fibres like lyocell, natural rubber, rattan) from responsibly managed forests through each company that handles them.'],
  ['MOQ', 'MOQ (minimum order quantity): the smallest order a manufacturer accepts, usually per style or per colour. Artisan and small studios on Meridian Loop start from 50–150 units; large factories from 1,000+.'],
  ['Digital Product Passport', 'Digital Product Passport (DPP): an EU requirement under the Ecodesign for Sustainable Products Regulation to give each product a scannable record of its materials, origin, repairability and recyclability. Meridian Loop product pages show a DPP-style trace from raw material to brand.'],
];

let index = new Index();
let docsById = new Map();

export function rebuildIndex() {
  const docs = [];
  const add = (d) => docs.push(d);
  for (const m of store.getManufacturers()) {
    const where = `${m.city}, ${m.country}`;
    add({ id: `${m.id}#overview`, kind: 'manufacturer', entityId: m.id, title: `${m.name}: overview`, text: `${m.name} is a ${m.categories.join(', ')} manufacturer in ${where}, founded ${m.founded}, with ${m.employees} employees. ${m.description} Products: ${m.products}.` });
    add({ id: `${m.id}#capabilities`, kind: 'manufacturer', entityId: m.id, title: `${m.name}: capabilities & terms`, text: `Materials: ${m.materials.join(', ')}. Processes: ${m.processes.join(', ')}. Minimum order quantity (MOQ) ${m.moq} units. Lead time ${m.leadTimeDays} days, samples in ${m.sampleDays} days. Monthly capacity ${m.capacity.toLocaleString()} units. Price tier ${'$'.repeat(m.priceIndex)}. Exports to ${m.exportMarkets.join(', ')}. Contact: ${m.contact}.` });
    add({ id: `${m.id}#certifications`, kind: 'manufacturer', entityId: m.id, title: `${m.name}: certifications`, text: m.certifications.map((c) => `${c.name} (certificate ${c.id}, issued by ${c.issuer}, valid until ${c.expires}, status ${certStatus(c).state}, issuer register: ${c.registry?.status || 'n/a'})`).join('; ') + '.' });
    add({ id: `${m.id}#impact`, kind: 'manufacturer', entityId: m.id, title: `${m.name}: performance & impact`, text: `On-time delivery ${(m.onTimeRate * 100).toFixed(0)}%. Defect rate ${(m.defectRate * 100).toFixed(1)}%. Social/compliance audit score ${m.auditScore}/100. Renewable energy ${m.renewableEnergy}% of power. Water recycled ${m.waterRecycled}%.` });
  }
  for (const d of store.getDocuments()) {
    const m = store.getManufacturer(d.manufacturerId);
    add({ id: `${d.id}#doc`, kind: 'manufacturer', entityId: d.manufacturerId, title: `${m?.name || 'Supplier'}: uploaded document, ${d.label}`, text: d.text });
  }
  for (const b of store.getBrands()) {
    add({ id: `${b.id}#story`, kind: 'brand', entityId: b.id, title: `${b.name}: brand story`, text: `${b.name} (${b.category}, HQ ${b.hq}, founded ${b.founded}). ${b.tagline} ${b.story} Values: ${b.values.join(', ')}. Transparency score ${b.transparency}/100.` });
    for (const r of b.sourcingRequests) {
      add({ id: `${r.id}#request`, kind: 'request', entityId: r.id, title: `${b.name} is sourcing: ${r.title}`, text: `${b.name} (${b.hq}) is looking for a manufacturer for ${r.title}. Category ${r.category}. Materials: ${(r.materials || []).join(', ')}. Quantity ${r.quantity} units. Target price ${r.targetPrice}. Deadline ${r.deadline}. Requirements: ${r.requirements} Preferred countries: ${(r.preferredCountries || []).join(', ') || 'open'}.` });
    }
  }
  for (const p of store.getProducts()) {
    add({ id: `${p.id}#product`, kind: 'product', entityId: p.id, title: `${p.name} by ${p.brandName}`, text: `${p.name} by ${p.brandName}, ${p.category}, US$${p.price}. ${p.description} Materials: ${p.materials.map((x) => `${x.pct}% ${x.name} from ${x.origin}`).join(', ')}. Claims: ${p.claims.join('; ')}. Made by ${p.manufacturerName} in ${p.madeIn}. Footprint ${p.co2kg} kg CO2e and ${p.waterL} L water.` });
  }
  for (const [term, text] of GLOSSARY) add({ id: `g-${term}`, kind: 'glossary', entityId: term, title: `What is ${term}?`, text });
  index = new Index().build(docs);
  docsById = new Map(docs.map((d) => [d.id, d]));
  return docs.length;
}

export function rawSearch(query, kinds) {
  const { results, expansions } = index.search(query, { kinds, k: 10 });
  return { expansions, constraints: describeConstraints(parseConstraints(query)), results: results.map((r) => ({ id: r.doc.id, kind: r.doc.kind, title: r.doc.title, text: r.doc.text, score: +r.score.toFixed(3), bm25: +r.bm25.toFixed(2), fuzzy: +r.fuzzy.toFixed(3), hits: r.hits })) };
}

export const kbStats = () => {
  const byKind = {};
  for (const d of index.docs) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  return { chunks: index.docs.length, byKind, vocabulary: index.df.size };
};

// ---------------- Brand side: manufacturer matching ----------------
export function matchManufacturers(query, weights = DEFAULT_WEIGHTS, { limit = 24 } = {}) {
  const constraints = parseConstraints(query || '');
  const ms = store.getManufacturers();
  const { results, expansions } = query?.trim() ? index.search(query, { kinds: ['manufacturer'], k: 200 }) : { results: [], expansions: [] };

  // Aggregate chunk scores per manufacturer: best chunk + a share of the others.
  const rel = new Map(); const evidence = new Map();
  for (const r of results) {
    const id = r.doc.entityId;
    rel.set(id, (rel.get(id) || 0) + (rel.has(id) ? 0.35 : 1) * r.score);
    if (!evidence.has(id)) evidence.set(id, []);
    if (evidence.get(id).length < 2) evidence.get(id).push({ id: r.doc.id, title: r.doc.title, text: r.doc.text, score: +r.score.toFixed(3) });
  }
  const maxRel = Math.max(1e-9, ...rel.values());

  const ranked = ms.map((m) => {
    const sc = scoreManufacturer(m);
    const quant = composite(sc.scores, weights);
    const relevance = query?.trim() ? Math.round(((rel.get(m.id) || 0) / maxRel) * 100) : 100;
    const checks = checkConstraints(m, constraints);
    const failed = checks.filter((c) => !c.ok).length;
    const match = Math.round(0.55 * relevance + 0.45 * quant - failed * 12);
    return { manufacturer: summarize(m), scores: sc.scores, flags: sc.flags, quant, relevance, match: Math.max(0, match), checks, meetsAll: failed === 0, explanation: explain(m, sc.scores), evidence: evidence.get(m.id) || [] };
  });
  ranked.sort((a, b) => (b.meetsAll - a.meetsAll) || (b.match - a.match));
  const filtered = query?.trim() ? ranked.filter((r) => r.relevance > 18 || (r.meetsAll && r.checks.length && r.relevance > 5)) : ranked;
  return { constraints, constraintText: describeConstraints(constraints), expansions, results: filtered.slice(0, limit) };
}

function summarize(m) {
  return { id: m.id, name: m.name, country: m.country, city: m.city, categories: m.categories, materials: m.materials, moq: m.moq, leadTimeDays: m.leadTimeDays, priceIndex: m.priceIndex, certifications: m.certifications.map((c) => ({ name: c.name, state: certStatus(c).state })), description: m.description, founded: m.founded, employees: m.employees };
}

export function manufacturerDetail(id, weights = DEFAULT_WEIGHTS) {
  const m = store.getManufacturer(id); if (!m) return null;
  const sc = scoreManufacturer(m);
  return { ...m, ...sc, quant: composite(sc.scores, weights), explanation: explain(m, sc.scores), documents: store.getDocuments(id), productsMade: store.getProducts().filter((p) => p.manufacturerId === id), profileCompleteness: completeness(m) };
}

function completeness(m) {
  const items = [
    ['Company overview', !!m.description], ['Materials & processes', m.materials.length > 2 && m.processes.length > 2], ['MOQ & lead time', !!m.moq && !!m.leadTimeDays],
    ['At least 2 verified certificates', m.certifications.filter((c) => certStatus(c).state === 'valid' || certStatus(c).state === 'expiring').length >= 2],
    ['No expired certificates', m.certifications.length > 0 && !m.certifications.some((c) => certStatus(c).state === 'expired')], ['All certificates confirmed by their issuers', m.certifications.length > 0 && m.certifications.every((c) => ['confirmed', 'manual'].includes(c.registry?.status) && c.verified)],
    ['Impact data (energy & water)', m.renewableEnergy != null && m.waterRecycled != null], ['Supporting documents uploaded', store.getDocuments(m.id).length > 0],
  ];
  return { pct: Math.round((items.filter((i) => i[1]).length / items.length) * 100), items: items.map(([label, done]) => ({ label, done })) };
}

// ---------------- Manufacturer side: find brand demand ----------------
export function findDemand(manufacturerId, query = '') {
  const m = store.getManufacturer(manufacturerId);
  const q = query.trim() || `${m.materials.join(' ')} ${m.categories.join(' ')} ${m.products}`;
  const { results, expansions } = index.search(q, { kinds: ['request'], k: 100 });
  const relById = new Map(results.map((r) => [r.doc.entityId, r]));
  const maxRel = Math.max(1e-9, ...results.map((r) => r.score));
  const reqs = store.getRequests().map((r) => {
    const hit = relById.get(r.id);
    const relevance = Math.round(((hit?.score || 0) / maxRel) * 100);
    const matMatch = (r.materials || []).filter((x) => m.materials.some((y) => y.includes(x) || x.includes(y)));
    const checks = [
      { label: `Category: ${r.category}`, ok: m.categories.includes(r.category) },
      matMatch.length ? { label: `You offer ${matMatch.join(', ')}`, ok: true } : { label: `Needs ${(r.materials || []).join(', ')}`, ok: false },
      { label: `Quantity ${r.quantity} vs your MOQ ${m.moq}`, ok: r.quantity >= m.moq },
      { label: `Preferred origin: ${(r.preferredCountries || []).join('/') || 'any'}`, ok: !r.preferredCountries?.length || r.preferredCountries.includes(m.country) },
    ];
    const fit = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    return { request: r, relevance, fit, match: Math.round(0.5 * relevance + 0.5 * fit), checks, evidence: hit ? [{ id: hit.doc.id, title: hit.doc.title, text: hit.doc.text }] : [] };
  }).filter((x) => x.relevance > 5 || !query.trim());
  reqs.sort((a, b) => b.match - a.match);
  return { manufacturer: summarize(m), query: q, expansions, results: reqs };
}

// ---------------- Consumer side: product discovery ----------------
export function discoverProducts(query = '') {
  const c = parseConstraints(query);
  const products = store.getProducts();
  const { results, expansions } = query.trim() ? index.search(query, { kinds: ['product'], k: 100 }) : { results: [], expansions: [] };
  const rel = new Map(results.map((r) => [r.doc.entityId, r.score]));
  const maxRel = Math.max(1e-9, ...rel.values());
  const ms = store.getManufacturers();
  let list = products.map((p) => {
    const m = ms.find((x) => x.id === p.manufacturerId);
    const verifiedCerts = m.certifications.filter((x) => ['valid', 'expiring'].includes(certStatus(x).state)).length;
    const trust = Math.min(100, 40 + verifiedCerts * 12 + (m.auditScore - 75));
    const relevance = query.trim() ? Math.round(((rel.get(p.id) || 0) / maxRel) * 100) : 100;
    const checks = [];
    if (c.maxPrice) checks.push({ label: `Under $${c.maxPrice}`, ok: p.price <= c.maxPrice });
    if (c.categories.length) checks.push({ label: c.categories.join('/'), ok: c.categories.includes(p.category) });
    if (c.countries.length) checks.push({ label: `Made in ${c.countries.join('/')}`, ok: c.countries.includes(p.madeIn) });
    if (c.vegan) checks.push({ label: 'Vegan (no animal leather, wool or silk)', ok: !p.materials.some((x) => /leather|wool|silk/i.test(x.name) && !/plant|cactus|apple|grape|vegan|peace/i.test(x.name)) && !p.materials.some((x) => /silk/i.test(x.name)) });
    return { product: p, relevance, trust, checks, meetsAll: checks.every((x) => x.ok) };
  });
  if (query.trim()) list = list.filter((x) => x.relevance > 10 && x.meetsAll);
  list.sort((a, b) => b.relevance - a.relevance || b.trust - a.trust);
  return { constraints: c, constraintText: describeConstraints(c), expansions, results: list };
}

export function productDetail(id) {
  const p = store.getProduct(id); if (!p) return null;
  const m = store.getManufacturer(p.manufacturerId); const b = store.getBrand(p.brandId);
  const sc = scoreManufacturer(m);
  const claims = p.claims.map((claim) => {
    const cert = m.certifications.find((c) => claim.toLowerCase().includes(c.name.toLowerCase().split(' ')[0].replace('-', '')) || claim.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
    const state = cert ? certStatus(cert).state : null;
    const reg = cert?.registry?.status;
    return { claim, evidence: cert ? `${cert.name}, certificate ${cert.id}, issued by ${cert.issuer}${reg === 'confirmed' ? ', confirmed in the issuer’s register' : reg === 'manual' ? ' (no public register)' : ''}` : 'Supplier data reported to Meridian Loop', status: cert ? (state === 'expired' ? 'expired' : state === 'withdrawn' ? 'withdrawn' : state === 'unverified' ? 'pending' : 'verified') : 'reported' };
  });
  return { ...p, brand: b, manufacturer: { id: m.id, name: m.name, city: m.city, country: m.country, renewableEnergy: m.renewableEnergy, waterRecycled: m.waterRecycled, auditScore: m.auditScore, scores: sc.scores }, claims };
}

// ---------------- Chat (RAG) ----------------
const ROLE_KINDS = { brand: ['manufacturer', 'glossary'], manufacturer: ['request', 'brand', 'glossary'], consumer: ['product', 'brand', 'glossary'] };

// Short follow-ups ("only in Vietnam", "cheaper ones?") are merged with the previous question.
function effectiveQuery(messages) {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const last = users[users.length - 1] || '';
  const prev = users[users.length - 2];
  const followUp = prev && last.split(/\s+/).length <= 9 && /^(only|what about|and|but|now|also|cheaper|faster|which|any|those|same|show|filter|instead|with|without|in|from)\b/i.test(last.trim());
  return followUp ? `${prev} ${last}` : last;
}

export async function chat({ messages, role = 'brand', manufacturerId, weights }, emit) {
  const query = effectiveQuery(messages);
  const kinds = ROLE_KINDS[role] || ROLE_KINDS.brand;
  const { results, expansions } = index.search(query, { kinds, k: 8 });
  const sources = results.map((r, i) => ({ n: i + 1, id: r.doc.id, kind: r.doc.kind, entityId: r.doc.entityId, title: r.doc.title, text: r.doc.text, score: +r.score.toFixed(3), bm25: +r.bm25.toFixed(2), fuzzy: +r.fuzzy.toFixed(3) }));

  let structured = null;
  if (role === 'brand') structured = matchManufacturers(query, weights);
  else if (role === 'manufacturer' && manufacturerId) structured = findDemand(manufacturerId, query);
  else if (role === 'consumer') structured = discoverProducts(query);

  const asksDefinition = /\b(what|explain|mean|meaning|define|definition)\b/i.test(query);
  const exactTerm = sources.find((x) => x.kind === 'glossary' && new RegExp(`\\b${x.entityId.split(' ')[0].replace('-', '[- ]?')}\\b`, 'i').test(query));
  const glossaryHit = asksDefinition ? exactTerm || (sources[0]?.kind === 'glossary' ? sources[0] : null) : null;
  emit('sources', { query, expansions, sources, constraints: structured?.constraintText || [], mode: llmEnabled() ? 'claude' : 'local' });
  emit('entities', entityCards(role, structured));

  if (llmEnabled()) {
    try {
      await streamAnswer({ system: systemPrompt(role, manufacturerId), messages: llmMessages(messages, sources, structured, role), onText: (t) => emit('text', { t }) });
      return emit('done', {});
    } catch (err) {
      emit('notice', { text: `Claude unavailable (${err.message}); answered with the built-in engine.` });
    }
  }
  const answer = glossaryHit ? `**${glossaryHit.title.replace('What is ', '').replace('?', '')}**: ${glossaryHit.text} [${glossaryHit.n}]` : composeAnswer(role, structured, sources, query);
  for (const piece of answer.match(/[^\s]+\s*/g) || []) { emit('text', { t: piece }); await new Promise((r) => setTimeout(r, 12)); }
  emit('done', {});
}

function entityCards(role, s) {
  if (!s) return { type: 'none', items: [] };
  if (role === 'brand') return { type: 'manufacturers', items: s.results.slice(0, 4) };
  if (role === 'manufacturer') return { type: 'requests', items: s.results.slice(0, 4) };
  return { type: 'products', items: s.results.slice(0, 4) };
}

const cite = (sources, entityId) => { const s = sources.find((x) => x.entityId === entityId); return s ? ` [${s.n}]` : ''; };

function composeAnswer(role, s, sources, query) {
  if (!s || !s.results.length) return `I couldn’t find anything on the platform that matches “${query}”. Try naming a material (e.g. organic cotton, recycled polyester), a product type, or a country.`;
  const lines = [];
  if (role === 'brand') {
    const top = s.results.slice(0, 3);
    const full = s.results.filter((r) => r.meetsAll);
    lines.push(s.constraintText.length ? `I read your brief as: **${s.constraintText.join(', ')}**.` : `Here’s what the knowledge base surfaces for that brief.`);
    if (s.constraintText.length && !full.length) lines.push(`No manufacturer meets every requirement, so these are the closest matches. Check what each one misses before reaching out.`);
    else if (s.constraintText.length) lines.push(`${full.length} manufacturer${full.length === 1 ? '' : 's'} meet every requirement. Top picks, ranked by relevance + quantitative score:`);
    lines.push('');
    top.forEach((r, i) => {
      const m = r.manufacturer;
      const certs = m.certifications.filter((c) => c.state !== 'expired').map((c) => c.name.replace(/\s*\(.*\)/, '')).slice(0, 3).join(', ');
      const misses = r.checks.filter((c) => !c.ok).map((c) => c.label);
      const close = misses.length ? ` _(close match, misses: ${misses.join('; ')})_` : '';
      lines.push(`${i + 1}. **${m.name}**${close}, ${m.city}, ${m.country}. Match ${r.match}/100. MOQ ${m.moq}, ${m.leadTimeDays}-day lead time, ${'$'.repeat(m.priceIndex)} pricing; ${certs}.${cite(sources, m.id)} ${r.explanation}`);
      const f = r.flags.find((x) => x.level !== 'low');
      if (f) lines.push(`   Check first: ${f.text}.`);
    });
    if (top.length > 1) {
      const cheap = [...top].sort((a, b) => b.scores.cost - a.scores.cost)[0];
      const green = [...top].sort((a, b) => b.scores.sustainability - a.scores.sustainability)[0];
      lines.push('');
      lines.push(cheap.manufacturer.id !== green.manufacturer.id
        ? `**Trade-off:** ${cheap.manufacturer.name} is the most cost-efficient, while ${green.manufacturer.name} scores highest on sustainability (${green.scores.sustainability}/100). Adjust the weights in Discover to see how the ranking shifts.`
        : `**${green.manufacturer.name}** leads on both cost and sustainability among these options.`);
    }
    lines.push('');
    lines.push('Next step: add them to your shortlist to compare side by side, or send an RFQ.');
  } else if (role === 'manufacturer') {
    lines.push(`Here are the brand sourcing requests that best fit your capabilities:`);
    lines.push('');
    s.results.slice(0, 3).forEach((r, i) => {
      const q = r.request;
      const miss = r.checks.filter((c) => !c.ok).map((c) => c.label);
      lines.push(`${i + 1}. **${q.brandName}** (${q.brandHq}): ${q.title}. ${q.quantity} units at ${q.targetPrice}, due ${q.deadline}. Fit ${r.fit}%.${cite(sources, q.id)}${miss.length ? ` Gap: ${miss[0].toLowerCase()}.` : ' You meet every listed requirement.'}`);
    });
    lines.push('');
    lines.push('Requests where you meet every requirement are the best place to start: open one to send a proposal.');
  } else {
    lines.push(s.constraintText.length ? `Searching for **${s.constraintText.join(', ')}**. Here’s what I found:` : `Here are products that match:`);
    lines.push('');
    s.results.slice(0, 4).forEach((r, i) => {
      const p = r.product;
      lines.push(`${i + 1}. **${p.name}** by ${p.brandName}, US$${p.price}. ${p.materials.map((x) => `${x.pct}% ${x.name}`).join(', ')}, made in ${p.madeIn}. Trust score ${r.trust}/100.${cite(sources, p.id)} Key proof: ${p.claims[0]}.`);
    });
    lines.push('');
    lines.push('Open any product to see its passport: every step from raw material to brand.');
  }
  return lines.join('\n');
}

function systemPrompt(role, manufacturerId) {
  const who = {
    brand: 'a sourcing lead at a sustainable fashion/lifestyle brand looking for manufacturers in Asia',
    manufacturer: `a manufacturer${manufacturerId ? ` (${store.getManufacturer(manufacturerId)?.name})` : ''} looking for brands whose sourcing requests fit their capabilities`,
    consumer: 'a conscious shopper looking for sustainable products with real proof behind the claims',
  }[role];
  return `You are the Meridian Loop assistant, an AI sourcing and discovery guide on a platform that connects sustainable brands, Asian manufacturers and conscious consumers. You are talking to ${who}.

Answer only from the numbered SOURCES and the QUANTITATIVE RANKING provided in the user turn. Cite sources inline as [n]. If the sources don't contain the answer, say so plainly and suggest how to refine the search. Never invent certifications, numbers or companies.

When recommending, name the top 2–3 options, give the key facts (location, MOQ, lead time, certifications, price), state the main trade-off between them, and call out any risk flags such as expired or unverified certificates. Keep answers under 220 words, use short paragraphs or a numbered list, and use **bold** for company or product names.`;
}

function llmMessages(messages, sources, s, role) {
  const history = messages.slice(-7, -1).filter((m) => m.content?.trim()).map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();
  if (history.length && history[history.length - 1].role === 'user') history.pop();
  const src = sources.map((x) => `[${x.n}] ${x.title}\n${x.text}`).join('\n\n');
  let ranking = '';
  if (s && role === 'brand') ranking = s.results.slice(0, 6).map((r, i) => `${i + 1}. ${r.manufacturer.name} — match ${r.match}, quant ${r.quant}, scores ${JSON.stringify(r.scores)}, requirement checks: ${r.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}`).join('; ') || 'none'}, flags: ${r.flags.map((f) => f.text).join('; ') || 'none'}`).join('\n');
  if (s && role === 'manufacturer') ranking = s.results.slice(0, 6).map((r, i) => `${i + 1}. ${r.request.brandName}: ${r.request.title} — fit ${r.fit}%, checks: ${r.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}`).join('; ')}`).join('\n');
  if (s && role === 'consumer') ranking = s.results.slice(0, 6).map((r, i) => `${i + 1}. ${r.product.name} (${r.product.brandName}) — $${r.product.price}, trust ${r.trust}`).join('\n');
  const last = messages[messages.length - 1].content;
  return [...history, { role: 'user', content: `SOURCES\n${src || '(none)'}\n\nQUANTITATIVE RANKING\n${ranking || '(none)'}\n\nQUESTION\n${last}` }];
}

export { docsById };
