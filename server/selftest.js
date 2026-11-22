// Checks for the search, the assistant and joining. Run: npm test
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.MERIDIAN_STATE = path.join(os.tmpdir(), `meridian-selftest-${process.pid}.json`);
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
const engine = await import('./engine.js');
const { app } = await import('./index.js');
engine.rebuildIndex();

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('✓', name); };
const names = (r) => r.matches.map((m) => m.name);

await t('a brand finds GOTS knitters in India first', () => {
  const r = engine.search('brand', 'GOTS organic cotton loungewear, small MOQ, India or Cambodia');
  assert.equal(r.matches[0].name, 'Kaveri Organic Knits');
  assert.ok(r.matches[0].meetsAll);
  assert.deepEqual(r.understood, ['in India or Cambodia', 'with GOTS', 'MOQ ≤ 300']);
});
await t('Sustainable India’s categories work as searches', () => {
  assert.equal(names(engine.search('brand', 'biodegradable fabric'))[0], 'Malabar Natural Fibres');
  assert.ok(names(engine.search('brand', 'waste cotton')).slice(0, 2).includes('Panipat ReWeave Mills'));
});
await t('typos still find the right maker', () => assert.equal(names(engine.search('brand', 'recycled polyster activewear'))[0], 'Deccan Performance Apparel'));
await t('a manufacturer finds brands that need what it makes', () => {
  assert.equal(names(engine.search('maker', 'peace silk scarves'))[0], 'Sora Silk Studio');
  assert.equal(names(engine.search('maker', 'waste cotton'))[0], 'Kumo Basics');
});
await t('answers cite numbered sources', () => {
  const r = engine.search('brand', 'low-water denim in Bangladesh');
  assert.equal(r.matches[0].name, 'Padma Green Denim');
  assert.match(r.answer, /\[1\]/);
  assert.equal(r.sources[0].n, 1);
});

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;
const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() }));
await t('lists hide contact details; profiles show them', async () => {
  const list = await (await fetch(`${base}/manufacturers`)).json();
  assert.ok(list.length >= 40 && !('email' in list[0]) && list[0].geo);
  const one = await (await fetch(`${base}/manufacturers/kaveri-organic-knits`)).json();
  assert.equal(one.contact, 'Anitha Raman');
});
await t('joining checks the form and makes the company searchable', async () => {
  const bad = await post('/join', { side: 'maker', name: '', email: 'nope' });
  assert.equal(bad.status, 400); assert.ok(bad.body.fields.name && bad.body.fields.email && bad.body.fields.materials);
  const ok = await post('/join', { side: 'maker', name: 'Hue Linen Works', contact: 'Lan Pham', email: 'lan@hue-linen.example', country: 'Vietnam', city: 'Hue', makes: 'Ramie shirts and dresses', materials: 'ramie, organic cotton', moq: 120 });
  assert.equal(ok.status, 200);
  const found = await post('/search', { side: 'brand', query: 'ramie shirts in Vietnam' });
  assert.equal(found.body.matches[0].name, 'Hue Linen Works');
});

// The assistant: drive a conversation through the built-in engine, carrying state between turns.
const { builtinTurn } = await import('./assistant.js');
const talk = (lines) => { let st = {}; return lines.map((l) => { const r = builtinTurn(l, st); st = r.state; return r; }); };
const textOf = (r) => r.events.filter((e) => e.type === 'text').map((e) => e.text).join(' ');
const kinds = (r) => r.events.map((e) => e.type);
await t('the larger network is searchable and mapped', () => {
  assert.equal(names(engine.search('brand', 'swimwear in Sri Lanka'))[0], 'Lanka EcoActive');
  assert.equal(names(engine.search('brand', 'selvedge denim from Japan'))[0], 'Kojima Selvedge Works');
  assert.ok(engine.search('brand', 'hemp shirts').matches.every((m) => m.geo && m.geo.exact));
});
await t('the assistant asks which side you are on, then what you need', () => {
  const [hi, role] = talk(['hello', "I'm a brand looking for a manufacturer"]);
  assert.ok(kinds(hi).includes('choices'));
  assert.match(textOf(role), /what you want made/);
  assert.ok(!kinds(role).includes('results'));
});
await t('the assistant keeps the brief while it is refined', () => {
  const [, first, gots, india] = talk(["I'm a brand", 'organic cotton t-shirts, about 500 units', 'Only GOTS certified', 'Only in India']);
  assert.ok(kinds(first).includes('results'));
  const res = india.events.find((e) => e.type === 'results');
  assert.match(res.query, /organic cotton t-shirts/); assert.match(res.query, /India/); assert.match(res.query, /GOTS/); assert.match(res.query, /500/);
  assert.equal(res.matches[0].name, 'Kaveri Organic Knits');
  assert.ok(gots.state.brief.certifications.includes('GOTS'));
});
await t('the assistant answers follow-ups about the companies it showed', () => {
  const turns = talk(['GOTS loungewear in India', 'tell me more about the first one', 'how do I contact them?', 'compare the top 3']);
  assert.equal(turns[1].events.find((e) => e.type === 'profile').entity.id, 'kaveri-organic-knits');
  assert.match(textOf(turns[2]), /Anitha Raman/);
  assert.ok(turns[3].events.find((e) => e.type === 'compare').rows.length >= 2);
});
await t('the assistant explains terms and stays on topic', () => {
  assert.match(textOf(talk(['what is GOTS?'])[0]), /Global Organic Textile Standard/);
  const off = talk(['what is the weather today'])[0];
  assert.ok(!kinds(off).includes('results')); assert.match(textOf(off), /only help with sourcing/);
});
await t('a manufacturer is matched with brands', () => {
  const r = talk(['We make organic cotton babywear'])[0];
  assert.equal(r.events.find((e) => e.type === 'results').matches[0].name, 'Little Sprout');
});
await t('the chat endpoint streams events', async () => {
  const res = await fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'biodegradable fabric' }], state: {} }) });
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const evs = (await res.text()).split('\n\n').filter(Boolean).map((c) => JSON.parse(c.replace(/^data: /, '')));
  assert.equal(evs.find((e) => e.type === 'results').matches[0].name, 'Malabar Natural Fibres');
  assert.deepEqual(evs.at(-1), { type: 'done', mode: 'built-in' });
});

// The marketplace: accounts, quote requests, alerts, certificates, documents, WhatsApp, metrics.
const jar = {};
const as = (who) => async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(jar[who] ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get('set-cookie'); if (set) jar[who] = set.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const brandApi = as('brand'), makerApi = as('maker'), teamApi = as('team'), anon = as('anon');
await t('demo sign-in sets a session for a brand, a manufacturer and the team', async () => {
  assert.equal((await anon('GET', '/rfqs')).status, 401);
  assert.equal((await brandApi('POST', '/session', { id: 'meadow-and-thread' })).body.user.role, 'brand');
  assert.equal((await makerApi('POST', '/session', { id: 'kaveri-organic-knits' })).body.user.role, 'maker');
  assert.equal((await teamApi('POST', '/session', { id: 'team' })).body.user.role, 'team');
  assert.equal((await brandApi('GET', '/session')).body.user.id, 'meadow-and-thread');
  assert.equal((await anon('POST', '/session', { id: 'nobody-here' })).status, 400);
});
await t('seeded quote requests show in every state', async () => {
  const mine = (await brandApi('GET', '/rfqs')).body;
  assert.ok(mine.some((r) => r.id === 'rfq-1001' && r.counts.quoted === 2 && r.counts.declined === 1 && r.counts.waiting === 1));
  const forKaveri = (await makerApi('GET', '/rfqs')).body;
  assert.ok(forKaveri.some((r) => r.id === 'rfq-1004' && r.myQuote.status === 'requested'));
  assert.equal(forKaveri.find((r) => r.id === 'rfq-1001').bestPrice, undefined);
});
let rfqId;
await t('a brand sends a quote request, replies arrive, and it chooses one', async () => {
  const bad = await brandApi('POST', '/rfqs', { title: '', quantity: 'x', makerIds: [] });
  assert.equal(bad.status, 400); assert.ok(bad.body.fields.title && bad.body.fields.quantity && bad.body.fields.makerIds);
  assert.equal((await makerApi('POST', '/rfqs', { title: 'x', quantity: 5, makerIds: ['kaveri-organic-knits'] })).status, 403);
  const r = await brandApi('POST', '/rfqs', { title: 'GOTS lounge set', quantity: 800, certifications: 'GOTS', makerIds: ['kaveri-organic-knits', 'tirupur-quickstitch', 'hanoi-small-batch', 'mekong-fair-apparel'] });
  assert.equal(r.status, 201); rfqId = r.body.id; assert.equal(r.body.counts.invited, 4);
  const q = await makerApi('POST', `/rfqs/${rfqId}/quote`, { unitPrice: 14.2, moq: 300, leadTimeDays: 35, sampleCost: 60, sampleDays: 10, incoterm: 'FOB' });
  assert.equal(q.body.status, 'quoted');
  const sim = await brandApi('POST', `/rfqs/${rfqId}/simulate`);
  assert.equal(sim.body.replies, 3);
  const d = (await brandApi('GET', `/rfqs/${rfqId}`)).body;
  const by = Object.fromEntries(d.quotes.map((x) => [x.makerId, x]));
  assert.equal(by['tirupur-quickstitch'].status, 'declined');                     // its GOTS certificate has expired
  assert.match(by['tirupur-quickstitch'].note, /GOTS/);
  assert.equal(by['hanoi-small-batch'].status, 'declined');                       // holds no GOTS
  assert.equal(by['mekong-fair-apparel'].status, 'quoted');
  const award = await brandApi('POST', `/rfqs/${rfqId}/award`, { makerId: 'kaveri-organic-knits' });
  assert.equal(award.body.status, 'awarded');
  const inbox = (await makerApi('GET', '/me/notifications')).body;
  assert.ok(inbox.some((n) => n.kind === 'award' && n.link.endsWith(rfqId)));
  assert.equal((await makerApi('POST', `/rfqs/${rfqId}/quote`, { unitPrice: 1, moq: 1, leadTimeDays: 1 })).status, 409);
  const mail = (await teamApi('GET', '/outbox')).body;
  assert.ok(mail.some((m) => m.to.includes('kaveri') && /chose your quote/.test(m.subject)));
});
await t('a manufacturer cannot see competing quotes', async () => {
  const other = as('other'); await other('POST', '/session', { id: 'mekong-fair-apparel' });
  const d = (await other('GET', `/rfqs/${rfqId}`)).body;
  assert.ok(d.quotes.every((q) => q.makerId === 'mekong-fair-apparel'));
  const stranger = as('stranger'); await stranger('POST', '/session', { id: 'kojima-selvedge-works' });
  assert.equal((await stranger('GET', `/rfqs/${rfqId}`)).status, 404);
});
await t('profile edits validate and show in search at once', async () => {
  const bad = await makerApi('PATCH', '/me/profile', { moq: 'lots', priceFrom: 9, priceTo: 3 });
  assert.equal(bad.status, 400); assert.ok(bad.body.fields.moq && bad.body.fields.priceFrom);
  const ok = await makerApi('PATCH', '/me/profile', { moq: 250, priceFrom: 3.1, priceTo: 6.9, materials: 'organic cotton, jersey, ramie' });
  assert.equal(ok.body.company.moq, 250); assert.equal(ok.body.company.priceRange.to, 6.9);
  assert.ok(engine.search('brand', 'ramie').matches.some((m) => m.id === 'kaveri-organic-knits'));
});
await t('certificates are checked against the register by the team', async () => {
  assert.equal((await brandApi('POST', '/certificates/check', { makerId: 'jaipur-zari-studio', cert: 'GOTS' })).status, 403);
  const nf = await teamApi('POST', '/certificates/check', { makerId: 'jaipur-zari-studio', cert: 'GOTS' });
  assert.equal(nf.body.certificate.check.status, 'not-found');
  const ok = await teamApi('POST', '/certificates/check', { makerId: 'ludhiana-woolcraft', cert: 'RWS' });
  assert.equal(ok.body.certificate.state, 'checked');
  const r = engine.search('brand', 'hand embroidery on embellished dresses, GOTS').matches.find((m) => m.id === 'jaipur-zari-studio');
  assert.ok(r.checks.some((c) => !c.ok && /not in the register/.test(c.label)));
});
await t('documents upload with type and size checks', async () => {
  const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 demo').toString('base64')}`;
  assert.equal((await makerApi('POST', '/me/documents', { name: 'x', dataUrl: 'data:text/html;base64,PGI+' })).status, 400);
  const up = await makerApi('POST', '/me/documents', { name: 'GOTS scope 2026', kind: 'certificate', dataUrl: pdf });
  assert.equal(up.status, 201);
  const file = await fetch(`${base}/documents/${up.body.doc.id}`);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.ok((await (await fetch(`${base}/companies/kaveri-organic-knits/documents`)).json()).some((d) => d.id === up.body.doc.id));
});
await t('saved searches raise an alert when a new manufacturer fits', async () => {
  await brandApi('POST', '/me/saved', { query: 'ramie shirts in Vietnam' });
  const before = (await brandApi('GET', '/me/notifications')).body.length;
  const j = await post('/join', { side: 'maker', name: 'Hue Ramie House', contact: 'Mai Do', email: 'mai@hue-ramie.example', country: 'Vietnam', city: 'Hue', makes: 'Ramie shirts', materials: 'ramie', moq: 80 });
  assert.equal(j.status, 200); assert.ok(j.body.rank.position >= 1);
  const after = (await brandApi('GET', '/me/notifications')).body;
  assert.ok(after.length > before && after.some((n) => n.kind === 'alert' && /Hue Ramie House/.test(n.body)));
});
await t('WhatsApp works in the manufacturer’s language and can quote', async () => {
  const hi = await post('/whatsapp/inbound', { from: 'jaipur-zari-studio', text: 'मदद' });
  assert.equal(hi.body.lang, 'hi'); assert.match(hi.body.reply, /कोटेशन/);
  const vi = await post('/whatsapp/inbound', { from: 'hanoi-small-batch', text: 'MOQ 25' });
  assert.equal(vi.body.lang, 'vi'); assert.match(vi.body.reply, /hồ sơ/);
  const q = await post('/whatsapp/inbound', { from: 'red-river-knitting', text: 'QUOTE 1004 7.20 1500 30' });
  assert.match(q.body.reply, /Little Sprout/);
  const join = await post('/whatsapp/inbound', { from: '', text: 'JOIN Can Tho Linen | Can Tho, Vietnam | linen shirts | linen | 150' });
  assert.ok(join.body.joined);
});
await t('metrics report the pilot and the live funnel', async () => {
  await post('/events', { type: 'question', session: 's1' }); await post('/events', { type: 'shortlist', session: 's1' });
  assert.equal((await post('/events', { type: 'nonsense' })).status, 400);
  const m = await (await fetch(`${base}/metrics`)).json();
  assert.ok(m.pilot.rfqs > 0 && m.live.rfqs >= 7 && m.live.quotesReceived > 0 && m.live.awards >= 2);
  assert.equal(m.live.minutesToShortlist, 0);
});

// Resilience: bad input never crashes the server or leaks a stack trace.
const chat = (body, raw) => fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(body) });
const eventsOf = async (res) => (await res.text()).split('\n\n').filter((c) => c.startsWith('data: ')).map((c) => JSON.parse(c.slice(6)));
await t('malformed requests get short JSON errors', async () => {
  const bad = await chat(null, '{"messages": [');
  assert.equal(bad.status, 400); assert.match((await bad.json()).error, /JSON/);
  const empty = await chat({ messages: [] });
  assert.equal(empty.status, 400);
  const missing = await fetch(`${base}/nothing-here`);
  assert.equal(missing.status, 404); assert.ok((await missing.json()).error);
  const health = await (await fetch(`${base}/health`)).json();
  assert.ok(health.ok && health.makers >= 40);
});
await t('a hostile conversation state is cleaned, and the turn still answers', async () => {
  const res = await chat({ messages: [{ role: 'user', content: 'organic cotton tees' }], state: { side: 'pirate', brief: { topic: 7, countries: 'India', certifications: [{}] }, shown: 'nope', focus: { x: 1 } } });
  const evs = await eventsOf(res);
  assert.ok(evs.some((e) => e.type === 'results'));
  assert.equal(evs.at(-1).type, 'done');
});
await t('very long and strange messages are handled', async () => {
  const evs = await eventsOf(await chat({ messages: [{ role: 'user', content: 'x'.repeat(20000) }, { role: 'assistant', content: 'hi' }, { role: 'user', content: '<script>alert(1)</script> ✓✓ 🧵 []{}' }] }));
  assert.equal(evs.at(-1).type, 'done');
});
await t('duplicate company names are refused', async () => {
  const dup = await post('/join', { side: 'maker', name: 'Kaveri Organic Knits', contact: 'A B', email: 'a@b.example', country: 'India', city: 'Tirupur', makes: 'Tees', materials: 'cotton', moq: 100 });
  assert.equal(dup.status, 409); assert.ok(dup.body.fields.name);
});
await t('the state store survives a damaged file', async () => {
  const fs = await import('node:fs');
  const file = path.join(os.tmpdir(), `meridian-broken-${process.pid}.json`);
  fs.writeFileSync(file, '{ this is not json');
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', "const s = await import('./server/store.js'); await s.ready(); await s.flush(); console.log(s.getManufacturers().length)"], { env: { ...process.env, MERIDIAN_STATE: file }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.ok(Number(out.trim()) >= 40);
  assert.ok(fs.readdirSync(os.tmpdir()).some((f) => f.startsWith(`meridian-broken-${process.pid}.json.broken-`)));
});
await t('chat is rate limited per visitor', async () => {
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) { const r = await chat({ messages: [{ role: 'user', content: 'hi' }] }); if (r.status === 429) limited = true; else await r.text(); }
  assert.ok(limited);
});

server.close();
console.log(`\n${passed} checks passed`);
