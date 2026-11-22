// The marketplace around the assistant: demo accounts, profiles and documents, certificate checks, quote
// requests and quotes, notifications with an email outbox, saved searches and alerts, metrics, and a WhatsApp
// channel for manufacturers. All of it runs on the dummy data in data/.
import express from 'express';
import * as store from './store.js';
import * as engine from './engine.js';
import { who, signIn, signOut, need, TEAM } from './auth.js';
import { certState } from '../data/enrich.js';
import { waReply } from './whatsapp.js';
import { rateLimit } from './guard.js';

const waLimit = rateLimit({ windowMs: 60_000, max: 60, message: 'Too many WhatsApp messages in a minute.' });

const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const list = (v, n = 12) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => clean(x, 60)).filter(Boolean).slice(0, n);
const num = (v, min = 0, max = 1e7) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const money = (n) => Math.round(n * 100) / 100;
const done = async (res, body, status = 200) => { await store.flush(); res.status(status).json(body); };

const publicMaker = (m) => m && ({ id: m.id, type: 'maker', name: m.name, city: m.city, country: m.country, makes: m.makes, moq: m.moq, leadTimeDays: m.leadTimeDays, priceRange: m.priceRange, sampleCost: m.sampleCost, sampleDays: m.sampleDays, dppReady: m.dppReady, certifications: m.certifications.map((c) => ({ name: c.name, state: certState(c) })) });
const publicBrand = (b) => b && ({ id: b.id, type: 'brand', name: b.name, city: b.city, country: b.country, sells: b.sells });

function rfqSummary(r, viewer) {
  const qs = store.quotesFor(r.id);
  const quoted = qs.filter((q) => q.status === 'quoted');
  const mine = viewer?.role === 'maker' ? qs.find((q) => q.makerId === viewer.id) : null;
  return {
    ...r, brand: publicBrand(store.getBrand(r.brandId)),
    counts: { invited: qs.length, quoted: quoted.length, declined: qs.filter((q) => q.status === 'declined').length, waiting: qs.filter((q) => q.status === 'requested').length },
    bestPrice: viewer?.role === 'maker' ? undefined : quoted.length ? Math.min(...quoted.map((q) => q.unitPrice)) : null,
    myQuote: mine || undefined,
  };
}

const canSee = (u, r) => u && (u.role === 'team' || u.id === r.brandId || r.makerIds.includes(u.id));

// A manufacturer's reply, worked out from its profile: the demo's stand-in for real replies.
export function simulatedReply(m, r) {
  if (!m) return null;
  const need = r.certifications || [];
  const missing = need.find((w) => { const c = m.certifications.find((x) => x.name.toLowerCase().includes(w.toLowerCase().split(' ')[0])); return !c || certState(c) === 'expired'; });
  if (r.quantity < Math.round(m.moq * 0.8)) return { status: 'declined', note: `Our minimum is ${m.moq.toLocaleString()} pieces a style.` };
  if (missing) {
    const c = m.certifications.find((x) => x.name.toLowerCase().includes(missing.toLowerCase().split(' ')[0]));
    return { status: 'declined', note: c ? `Our ${missing} certificate is being renewed, so we cannot quote ${missing} goods this month.` : `We do not hold ${missing}.` };
  }
  const { from, to } = m.priceRange || { from: 6, to: 12 };
  const scale = Math.min(1, Math.max(0, Math.log10(r.quantity / m.moq) / 2));   // larger runs earn a lower price
  const unitPrice = money(to - (to - from) * (0.25 + 0.6 * scale));
  return { status: 'quoted', unitPrice, moq: m.moq, leadTimeDays: m.leadTimeDays + (r.quantity > m.capacityPerMonth ? 14 : 0), sampleCost: m.sampleCost, sampleDays: m.sampleDays, incoterm: (m.incoterms || ['FOB'])[0],
    note: r.quantity > m.capacityPerMonth ? `This run is above our monthly capacity of ${m.capacityPerMonth.toLocaleString()}, so we would ship in two lots.` : '' };
}

// New companies trigger alerts: a brand request goes to the manufacturers that fit it, a new manufacturer to
// every saved search it now appears in.
export function alertForNewBrand(b) {
  for (const n of b.needs) {
    const r = engine.search('brand', `${n.title}, ${n.materials.join(', ')}${n.certifications.length ? `, ${n.certifications.join(' ')} certified` : ''}`);
    for (const m of r.matches.filter((x) => x.meetsAll).slice(0, 5)) {
      store.notify(m.id, 'alert', 'A new brand request fits what you make', `${b.name} wants ${n.title.toLowerCase()}, ${n.quantity.toLocaleString()} units.`, `#/b/${b.id}`);
    }
  }
}
export function alertForNewMaker(m) {
  for (const s of store.allSaved()) {
    const r = engine.search('brand', s.query);
    if (r.matches.slice(0, 6).some((x) => x.id === m.id)) store.notify(s.owner, 'alert', 'A new manufacturer fits your saved search', `${m.name} in ${m.city} matches “${s.query}”.`, `#/m/${m.id}`);
  }
}

export function mountMarket(app, { writeLimit }) {
  // ---------- sessions ----------
  app.get('/api/session', (req, res) => res.json({ user: who(req) }));
  app.get('/api/demo-accounts', (req, res) => res.json({
    brands: store.getBrands().map((b) => ({ id: b.id, name: b.name, city: b.city, sells: b.sells })),
    makers: store.getManufacturers().map((m) => ({ id: m.id, name: m.name, city: m.city, makes: m.makes })),
    team: TEAM,
  }));
  app.post('/api/session', async (req, res) => {
    const id = clean(req.body.id, 80);
    if (id !== 'team' && !store.getCompany(id)) return res.status(400).json({ error: 'Pick a company from the list.' });
    signIn(res, id); store.track('sign_in', { who: id });
    const u = id === 'team' ? TEAM : { id, role: store.getManufacturer(id) ? 'maker' : 'brand', name: store.getCompany(id).name };
    await done(res, { user: u });
  });
  app.delete('/api/session', (req, res) => { signOut(res); res.json({ user: null }); });

  // ---------- my account ----------
  app.get('/api/me', need(), (req, res) => {
    const u = req.user;
    res.json({ user: u, company: u.role === 'team' ? null : store.getCompany(u.id), docs: u.role === 'team' ? [] : store.docsFor(u.id), saved: store.savedFor(u.id), unread: store.notificationsFor(u.id).filter((n) => !n.read).length });
  });

  app.patch('/api/me/profile', need('maker', 'brand'), async (req, res) => {
    const u = req.user, b = req.body, errors = {}, patch = {};
    const text = (k, n, label) => { if (b[k] !== undefined) { const v = clean(b[k], n); if (!v && label) errors[k] = `Add ${label}.`; else patch[k] = v; } };
    text('about', 800, 'a line about the company'); text('contact', 80, 'a contact name');
    if (u.role === 'maker') {
      text('makes', 200, 'what you make');
      if (b.materials !== undefined) { const v = list(b.materials); if (!v.length) errors.materials = 'List at least one material.'; else patch.materials = v; }
      if (b.processes !== undefined) patch.processes = list(b.processes);
      if (b.incoterms !== undefined) patch.incoterms = list(b.incoterms, 4).map((x) => x.toUpperCase()).filter((x) => ['EXW', 'FOB', 'CIF', 'DDP', 'DAP'].includes(x));
      if (b.languages !== undefined) patch.languages = list(b.languages, 5);
      if (b.whatsapp !== undefined) patch.whatsapp = Boolean(b.whatsapp);
      const n = (k, min, max, label) => { if (b[k] !== undefined && b[k] !== '') { const v = num(b[k], min, max); if (v === null) errors[k] = `Write ${label} as a number.`; else patch[k] = v; } };
      n('moq', 1, 1e6, 'the minimum order'); n('leadTimeDays', 1, 365, 'the lead time in days'); n('sampleCost', 0, 1e5, 'the sample cost');
      n('sampleDays', 1, 120, 'the sample time in days'); n('capacityPerMonth', 1, 1e8, 'the monthly capacity'); n('moqPerColour', 1, 1e6, 'the minimum a colour');
      if (b.priceFrom !== undefined || b.priceTo !== undefined) {
        const from = num(b.priceFrom, 0.1, 1e4), to = num(b.priceTo, 0.1, 1e4);
        if (from === null || to === null || to < from) errors.priceFrom = 'Write a price range, the lower price first.';
        else patch.priceRange = { from, to, currency: 'US$', unit: clean(b.priceUnit, 10) === 'metre' ? 'metre' : 'piece' };
      }
    } else {
      text('sells', 200, 'what you sell');
      if (Array.isArray(b.needs)) {
        const needs = b.needs.slice(0, 6).map((x) => ({ title: clean(x.title, 120), detail: clean(x.detail, 400), materials: list(x.materials), quantity: Math.round(num(x.quantity, 1, 1e7) || 0), target: clean(x.target, 60) || 'Open to quotes', certifications: list(x.certifications), countries: list(x.countries) })).filter((x) => x.title);
        if (needs.some((x) => !x.quantity)) errors.needs = 'Give every request a quantity.';
        else patch.needs = needs;
      }
    }
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
    const c = store.editCompany(u.id, patch);
    if (u.role === 'brand' && patch.needs) alertForNewBrand(c);
    store.track('profile_edit', { who: u.id });
    await done(res, { company: c });
  });

  // documents: certificate scans, photographs and tech packs, kept in the state document (1.5 MB each)
  const TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  app.post('/api/me/documents', express.json({ limit: '3mb' }), need('maker', 'brand'), writeLimit, async (req, res) => {
    const name = clean(req.body.name, 120), kind = ['certificate', 'photo', 'techpack', 'other'].includes(req.body.kind) ? req.body.kind : 'other';
    const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.dataUrl || ''));
    if (!name) return res.status(400).json({ error: 'Give the file a name.', fields: { name: 'Give the file a name.' } });
    if (!m || !TYPES[m[1]]) return res.status(400).json({ error: 'Upload a PDF, JPEG, PNG or WebP file.', fields: { file: 'Upload a PDF, JPEG, PNG or WebP file.' } });
    const size = Math.floor(m[2].length * 3 / 4);
    if (size > 1.5e6) return res.status(413).json({ error: 'That file is over 1.5 MB.', fields: { file: 'Choose a file under 1.5 MB.' } });
    const doc = store.addDoc({ owner: req.user.id, name, kind, type: m[1], size, data: m[2] });
    store.track('document_upload', { who: req.user.id, kind });
    await done(res, { doc }, 201);
  });
  app.delete('/api/me/documents/:id', need('maker', 'brand'), async (req, res) => { store.removeDoc(req.user.id, req.params.id); await done(res, { ok: true }); });
  app.get('/api/companies/:id/documents', (req, res) => res.json(store.docsFor(req.params.id)));
  app.get('/api/documents/:id', (req, res) => {
    const d = store.getDoc(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.set({ 'Content-Type': d.type, 'Content-Disposition': `inline; filename="${d.name.replace(/[^\w. -]/g, '')}.${TYPES[d.type]}"`, 'Cache-Control': 'private, max-age=300' });
    res.send(Buffer.from(d.data, 'base64'));
  });

  // saved searches
  app.get('/api/me/saved', need(), (req, res) => res.json(store.savedFor(req.user.id)));
  app.post('/api/me/saved', need('brand', 'maker'), async (req, res) => {
    const q = clean(req.body.query, 200);
    if (!q) return res.status(400).json({ error: 'There is nothing to save yet.' });
    if (store.savedFor(req.user.id).some((s) => s.query.toLowerCase() === q.toLowerCase())) return done(res, { saved: store.savedFor(req.user.id) });
    store.addSaved(req.user.id, q); store.track('saved_search', { who: req.user.id });
    await done(res, { saved: store.savedFor(req.user.id) }, 201);
  });
  app.delete('/api/me/saved/:id', need(), async (req, res) => { store.removeSaved(req.user.id, req.params.id); await done(res, { saved: store.savedFor(req.user.id) }); });

  // notifications and the email outbox (emails a launch would send; nothing leaves the server)
  app.get('/api/me/notifications', need(), (req, res) => res.json(store.notificationsFor(req.user.id).slice(0, 100)));
  app.post('/api/me/notifications/read', need(), async (req, res) => { store.markRead(req.user.id, Array.isArray(req.body.ids) ? req.body.ids : null); await done(res, { ok: true }); });
  app.get('/api/outbox', need('team'), (req, res) => res.json(store.outbox().slice(0, 100)));

  // ---------- certificates ----------
  // The demo's register lookup: a self-reported certificate or one already missing stays not found; others are confirmed.
  app.post('/api/certificates/check', need('team', 'maker'), async (req, res) => {
    const makerId = req.user.role === 'maker' ? req.user.id : clean(req.body.makerId, 80);
    const m = store.getManufacturer(makerId);
    const c = m?.certifications.find((x) => x.name === req.body.cert);
    if (!c) return res.status(404).json({ error: 'That certificate is not on the profile.' });
    const today = new Date().toISOString().slice(0, 10);
    const found = c.issuer !== 'Self-reported' && c.check?.status !== 'not-found';
    const check = { status: found ? 'checked' : 'not-found', on: today, register: `${c.issuer === 'Self-reported' ? 'Issuer' : c.issuer} public register` };
    store.setCertificateCheck(makerId, c.name, check);
    store.notify(makerId, 'certificate', found ? `${c.name} confirmed in the register` : `${c.name} not found in the register`, found ? 'Brands now see it marked as checked.' : 'Upload the scope certificate so the team can look again.', `#/m/${makerId}`);
    store.track('certificate_check', { who: req.user.id, result: check.status });
    await done(res, { certificate: { ...c, check, state: certState({ ...c, check }) } });
  });

  // ---------- quote requests ----------
  app.get('/api/rfqs', need(), (req, res) => {
    const u = req.user;
    const mine = store.rfqs().filter((r) => u.role === 'team' || r.brandId === u.id || r.makerIds.includes(u.id));
    res.json(mine.map((r) => rfqSummary(r, u)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });
  app.post('/api/rfqs', need('brand'), writeLimit, async (req, res) => {
    const b = req.body, errors = {};
    const title = clean(b.title, 120), detail = clean(b.detail, 600), quantity = Math.round(num(b.quantity, 1, 1e7) || 0);
    const makerIds = [...new Set(list(b.makerIds, 8))].filter((id) => store.getManufacturer(id));
    if (!title) errors.title = 'Say what you want made.';
    if (!quantity) errors.quantity = 'Write the quantity as a number.';
    if (!makerIds.length) errors.makerIds = 'Choose at least one manufacturer.';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
    const r = store.addRfq({ id: store.newId('rfq'), brandId: req.user.id, title, detail, materials: list(b.materials), quantity, target: clean(b.target, 60) || 'Open to quotes',
      certifications: list(b.certifications, 6), makerIds, createdAt: new Date().toISOString(), deadline: clean(b.deadline, 20) || null, status: 'open', awardedTo: null });
    for (const id of makerIds) {
      store.upsertQuote({ id: `${r.id}:${id}`, rfqId: r.id, makerId: id, status: 'requested', at: r.createdAt });
      store.notify(id, 'rfq', `${req.user.name} asks for a quote`, `${title}, ${quantity.toLocaleString()} units.`, `#/quotes/${r.id}`);
    }
    store.track('rfq_sent', { who: req.user.id, makers: makerIds.length });
    await done(res, rfqSummary(r, req.user), 201);
  });
  app.get('/api/rfqs/:id', need(), (req, res) => {
    const r = store.getRfq(req.params.id), u = req.user;
    if (!r || !canSee(u, r)) return res.status(404).json({ error: 'That quote request is not here.' });
    const quotes = store.quotesFor(r.id).filter((q) => u.role !== 'maker' || q.makerId === u.id);
    res.json({ ...rfqSummary(r, u), makers: r.makerIds.map((id) => publicMaker(store.getManufacturer(id))).filter(Boolean), quotes });
  });
  app.post('/api/rfqs/:id/quote', need('maker'), async (req, res) => {
    const r = store.getRfq(req.params.id), u = req.user, b = req.body;
    if (!r || !r.makerIds.includes(u.id)) return res.status(404).json({ error: 'That quote request is not here.' });
    if (r.status !== 'open') return res.status(409).json({ error: 'This request is closed.' });
    let q;
    if (b.status === 'declined') q = { status: 'declined', note: clean(b.note, 300) };
    else {
      const errors = {};
      const unitPrice = num(b.unitPrice, 0.01, 1e5), moq = num(b.moq, 1, 1e7), leadTimeDays = num(b.leadTimeDays, 1, 365);
      if (unitPrice === null) errors.unitPrice = 'Write the price a piece as a number.';
      if (moq === null) errors.moq = 'Write the minimum order as a number.';
      if (leadTimeDays === null) errors.leadTimeDays = 'Write the lead time in days.';
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
      q = { status: 'quoted', unitPrice: money(unitPrice), moq: Math.round(moq), leadTimeDays: Math.round(leadTimeDays), sampleCost: num(b.sampleCost, 0, 1e5), sampleDays: num(b.sampleDays, 1, 120), incoterm: clean(b.incoterm, 4).toUpperCase() || 'FOB', note: clean(b.note, 300) };
    }
    const saved = store.upsertQuote({ id: `${r.id}:${u.id}`, rfqId: r.id, makerId: u.id, at: new Date().toISOString(), ...q });
    store.notify(r.brandId, 'quote', q.status === 'quoted' ? `${u.name} sent a quote` : `${u.name} declined`, q.status === 'quoted' ? `US$${q.unitPrice} a piece, ${q.moq.toLocaleString()} minimum, ${q.leadTimeDays} days.` : q.note || 'No reason given.', `#/quotes/${r.id}`);
    store.track(q.status === 'quoted' ? 'quote_received' : 'quote_declined', { who: u.id, rfq: r.id });
    await done(res, saved);
  });
  app.post('/api/rfqs/:id/simulate', need('brand', 'team'), async (req, res) => {
    const r = store.getRfq(req.params.id), u = req.user;
    if (!r || (u.role === 'brand' && r.brandId !== u.id)) return res.status(404).json({ error: 'That quote request is not here.' });
    let n = 0;
    for (const q of store.quotesFor(r.id).filter((x) => x.status === 'requested')) {
      const m = store.getManufacturer(q.makerId), reply = simulatedReply(m, r);
      if (!reply) continue;
      store.upsertQuote({ ...q, ...reply, at: new Date().toISOString(), simulated: true }); n++;
      store.notify(r.brandId, 'quote', reply.status === 'quoted' ? `${m.name} sent a quote` : `${m.name} declined`, reply.status === 'quoted' ? `US$${reply.unitPrice} a piece, ${reply.moq.toLocaleString()} minimum, ${reply.leadTimeDays} days.` : reply.note, `#/quotes/${r.id}`);
      store.track(reply.status === 'quoted' ? 'quote_received' : 'quote_declined', { who: m.id, rfq: r.id, simulated: true });
    }
    await done(res, { replies: n });
  });
  app.post('/api/rfqs/:id/award', need('brand'), async (req, res) => {
    const r = store.getRfq(req.params.id);
    if (!r || r.brandId !== req.user.id) return res.status(404).json({ error: 'That quote request is not here.' });
    const q = store.quotesFor(r.id).find((x) => x.makerId === req.body.makerId && x.status === 'quoted');
    if (!q) return res.status(400).json({ error: 'Choose a manufacturer that sent a quote.' });
    store.updateRfq(r.id, { status: 'awarded', awardedTo: q.makerId, awardedAt: new Date().toISOString() });
    for (const x of store.quotesFor(r.id)) {
      if (x.makerId === q.makerId) store.notify(x.makerId, 'award', `${req.user.name} chose your quote`, `${r.title}, ${r.quantity.toLocaleString()} units. They will email you to arrange samples.`, `#/quotes/${r.id}`);
      else if (x.status === 'quoted') store.notify(x.makerId, 'rfq', `${req.user.name} chose another quote`, `${r.title}. Thank you for quoting.`, `#/quotes/${r.id}`);
    }
    store.track('award', { who: req.user.id, rfq: r.id });
    await done(res, rfqSummary(store.getRfq(r.id), req.user));
  });
  app.post('/api/rfqs/:id/close', need('brand'), async (req, res) => {
    const r = store.getRfq(req.params.id);
    if (!r || r.brandId !== req.user.id) return res.status(404).json({ error: 'That quote request is not here.' });
    store.updateRfq(r.id, { status: 'closed' });
    await done(res, rfqSummary(store.getRfq(r.id), req.user));
  });

  // ---------- events and metrics ----------
  const EVENTS = new Set(['question', 'profile_view', 'shortlist', 'enquiry', 'quotes_compared', 'map_open', 'directory_filter']);
  app.post('/api/events', async (req, res) => {
    const type = clean(req.body.type, 40);
    if (!EVENTS.has(type)) return res.status(400).json({ error: 'Unknown event.' });
    store.track(type, { session: clean(req.body.session, 40), ref: clean(req.body.ref, 80) });
    await done(res, { ok: true }, 202);
  });
  app.get('/api/metrics', (req, res) => {
    const ev = store.events(), p = store.pilot();
    const count = (t) => ev.filter((e) => e.type === t).length;
    const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    // minutes from a visitor's first question to their first shortlist save, per session
    const firstQ = {}, firstS = {};
    for (const e of ev) { if (!e.session) continue; if (e.type === 'question') firstQ[e.session] ??= e.at; if (e.type === 'shortlist') firstS[e.session] ??= e.at; }
    const liveMinutes = Object.keys(firstS).filter((s) => firstQ[s] && firstQ[s] <= firstS[s]).map((s) => Math.round((new Date(firstS[s]) - new Date(firstQ[s])) / 6e4));
    const rfqById = new Map(store.rfqs().map((r) => [r.id, r]));
    const replyHours = store.rfqs().flatMap((r) => store.quotesFor(r.id)).filter((q) => q.status !== 'requested' && rfqById.get(q.rfqId)).map((q) => Math.max(0, Math.round((new Date(q.at) - new Date(rfqById.get(q.rfqId).createdAt)) / 36e5)));
    const quotes = store.rfqs().flatMap((r) => store.quotesFor(r.id));
    const live = {
      questions: count('question'), profileViews: count('profile_view'), shortlists: count('shortlist'), enquiries: count('enquiry'),
      rfqs: store.rfqs().length, quotesReceived: quotes.filter((q) => q.status === 'quoted').length, quotesCompared: count('quotes_compared'),
      awards: store.rfqs().filter((r) => r.status === 'awarded').length, signIns: count('sign_in'), whatsapp: count('whatsapp'),
      minutesToShortlist: median(liveMinutes), replyHours: median(replyHours),
    };
    res.json({ pilot: { ...p, minutesToShortlist: median(p.minutesToShortlist), replyHours: median(p.replyHours) }, live, storage: store.storageKind(),
      makers: store.getManufacturers().length, brands: store.getBrands().length });
  });

  // ---------- WhatsApp ----------
  // The channel a provider (Twilio, Meta Cloud API) would post to. The demo's simulator posts here with the
  // manufacturer's id; a launch maps the sender's number to the company instead.
  app.post('/api/whatsapp/inbound', waLimit, async (req, res) => {
    const from = clean(req.body.from, 80), text = clean(req.body.text, 600);
    if (!text) return res.status(400).json({ error: 'Write a message.' });
    const reply = waReply(from, text, { simulatedReply, alertForNewMaker });
    store.track('whatsapp', { who: from || 'new' });
    await done(res, reply);
  });
}
