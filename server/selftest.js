// Checks for the two-way search and joining. Run: npm test
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.MERIDIAN_STATE = path.join(os.tmpdir(), `meridian-selftest-${process.pid}.json`);
delete process.env.ANTHROPIC_API_KEY;
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
server.close();
console.log(`\n${passed} checks passed`);
