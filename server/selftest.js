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
  assert.equal(names(engine.search('brand', 'waste cotton'))[0], 'Panipat ReWeave Mills');
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
  assert.ok(list.length === 17 && !('email' in list[0]));
  const one = await (await fetch(`${base}/manufacturers/kaveri-organic-knits`)).json();
  assert.equal(one.contact, 'Anitha Raman');
});
await t('joining checks the form and makes the company searchable', async () => {
  const bad = await post('/join', { side: 'maker', name: '', email: 'nope' });
  assert.equal(bad.status, 400); assert.ok(bad.body.fields.name && bad.body.fields.email && bad.body.fields.materials);
  const ok = await post('/join', { side: 'maker', name: 'Hue Linen Works', contact: 'Lan Pham', email: 'lan@hue-linen.example', country: 'Vietnam', city: 'Hue', makes: 'Linen shirts and dresses', materials: 'linen, organic cotton', moq: 120 });
  assert.equal(ok.status, 200);
  const found = await post('/search', { side: 'brand', query: 'linen shirts in Vietnam' });
  assert.equal(found.body.matches[0].name, 'Hue Linen Works');
});

// The assistant: drive a conversation through the built-in engine, carrying state between turns.
const { builtinTurn } = await import('./assistant.js');
const talk = (lines) => { let st = {}; return lines.map((l) => { const r = builtinTurn(l, st); st = r.state; return r; }); };
const textOf = (r) => r.events.filter((e) => e.type === 'text').map((e) => e.text).join(' ');
const kinds = (r) => r.events.map((e) => e.type);
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

server.close();
console.log(`\n${passed} checks passed`);
