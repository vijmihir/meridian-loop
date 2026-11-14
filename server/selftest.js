// Quick sanity checks for the retrieval + scoring engine. Run: npm test
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

// Run against clean seed data, never the live demo state.
process.env.MERIDIAN_STATE = path.join(os.tmpdir(), `meridian-selftest-${process.pid}.json`);
const engine = await import('./engine.js');
const { extractDocument } = await import('./docintel.js');
const { getManufacturers, sampleDocuments } = await import('./store.js');

engine.rebuildIndex();
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

t('organic cotton in India finds Kaveri first', () => {
  const r = engine.matchManufacturers('GOTS organic cotton t-shirts in India, MOQ under 500');
  assert.equal(r.results[0].manufacturer.id, 'm-tirupur-organics');
  assert.ok(r.constraints.countries.includes('India'));
  assert.equal(r.constraints.maxMoq, 500);
});
t('vegan sneakers routes to footwear makers', () => {
  const r = engine.matchManufacturers('vegan sneakers with natural rubber soles');
  assert.ok(['m-binhduong-footwear', 'm-semarang-footwear'].includes(r.results[0].manufacturer.id), r.results[0].manufacturer.id);
});
t('typo tolerance: "recycled polyster activewear"', () => {
  const r = engine.matchManufacturers('recycled polyster activewear');
  assert.ok(['m-bengaluru-active', 'm-ningbo-rpet', 'm-saigon-greenthread'].includes(r.results[0].manufacturer.id));
});
t('expired certificate is flagged', () => {
  const d = engine.manufacturerDetail('m-danang-bamboo');
  assert.ok(d.flags.some((f) => f.level === 'high'));
});
t('manufacturer demand: Panipat sees recycled throws request', () => {
  const r = engine.findDemand('m-panipat-recycle');
  assert.equal(r.results[0].request.id, 'r-hl-2');
});
t('consumer discovery respects price', () => {
  const r = engine.discoverProducts('sustainable sneakers under $100');
  assert.ok(r.results.length > 0 && r.results.every((x) => x.product.price <= 100));
});
t('vegan search excludes animal leather', () => {
  const r = engine.discoverProducts('vegan sneakers under $120');
  assert.ok(r.results.length > 0 && !r.results.some((x) => x.product.id === 'p-22'));
});
t('document extraction reads GOTS certificate', () => {
  const ex = extractDocument(sampleDocuments[0].text, getManufacturers());
  assert.equal(ex.standard, 'GOTS');
  assert.equal(ex.expires, '2027-11-30');
  assert.equal(ex.matchedManufacturerId, 'm-phnompenh-knit');
});
t('document extraction reads SMETA month-year date', () => {
  const ex = extractDocument(sampleDocuments.find((d) => /SMETA/.test(d.text)).text, getManufacturers());
  assert.equal(ex.expires, '2027-09-30');
  assert.equal(ex.issuer, 'SGS');
});
const { verifyCertificate } = await import('./issuers.js');
t('issuer register confirms a clean certificate', () => assert.equal(verifyCertificate({ standard: 'GOTS', number: 'CU-GOTS-884213', holder: 'Kaveri Organic Knits', expires: '2027-03-31' }).status, 'confirmed'));
t('issuer register catches a withdrawn certificate', () => assert.equal(verifyCertificate({ standard: 'OEKO-TEX Standard 100', number: 'OT-22.BD.54012', holder: 'Karnaphuli Knit Composite', expires: '2027-08-31' }).status, 'withdrawn'));
t('issuer register catches a date that disagrees', () => assert.equal(verifyCertificate({ standard: 'LWG Gold', number: 'LWG-KN-0441', holder: 'Ganga Tannery & Leathercraft', expires: '2027-07-31' }).status, 'mismatch'));
t('issuer register catches a borrowed number', () => assert.equal(verifyCertificate({ standard: 'GOTS', number: 'CU-GOTS-884213', holder: 'Padma Green Denim', expires: '2027-03-31' }).status, 'mismatch'));
t('issuer register rejects a malformed number', () => assert.equal(verifyCertificate({ standard: 'FSC', number: 'FSC-123', holder: 'x', expires: '2027-01-01' }).status, 'not_found'));
t('standards without a register ask for a manual check', () => assert.equal(verifyCertificate({ standard: 'ISO 14001', number: 'ISO14-IN-7781' }).status, 'manual'));
t('a withdrawn certificate raises a high flag', () => { const d = engine.manufacturerDetail('m-chittagong-knit'); assert.ok(d.flags.some((f) => f.level === 'high' && /Withdrawn/.test(f.text))); });
const notify = await import('./notify.js');
const storeMod = await import('./store.js');
t('certificate check emails a digest once per problem', () => {
  const first = notify.runCertificateCheck();
  assert.ok(first.length > 0);
  assert.ok(first.some((e) => e.about.manufacturerId === 'm-chittagong-knit' && /Withdrawn/.test(e.text)));
  assert.equal(notify.runCertificateCheck().length, 0);
});
t('quote request emails the manufacturer, with user text escaped', () => {
  const rfq = storeMod.addRfq({ brandId: 'b-meadow-thread', manufacturerId: 'm-tirupur-organics', message: '<script>alert(1)</script> 600 hoodies' });
  const e = notify.quoteRequested(rfq);
  assert.equal(e.to, 'anitha@kaveri-organic-knits.example');
  assert.ok(!e.html.includes('<script>') && e.html.includes('&lt;script&gt;'));
});
t('nothing is sent without SMTP', () => assert.equal(notify.mailMode().mode, 'preview'));
const fs = await import('node:fs');
const { pdfText, isPdf } = await import('./pdf.js');
for (const [file, id, expires] of [['gots-scope-certificate', 'm-phnompenh-knit', '2027-11-30'], ['oeko-tex-renewal', 'm-danang-bamboo', '2027-10-31'], ['social-audit-summary', 'm-kanpur-leather', '2027-09-30']]) {
  const buf = fs.readFileSync(new URL(`../client/public/samples/${file}.pdf`, import.meta.url));
  const { text } = await pdfText(buf);
  const ex = extractDocument(text, getManufacturers());
  t(`PDF read: ${file}`, () => { assert.ok(isPdf(buf)); assert.equal(ex.matchedManufacturerId, id); assert.equal(ex.expires, expires); });
}
t('Claude fields override the text rules', () => {
  const ex = extractDocument('scan', getManufacturers(), { standard: 'Global Organic Textile Standard', number: 'X-1', issuer: 'Control Union', company: 'Kaveri Organic Knits', issued: '2026-01-01', expires: '2028-01-31', findings: [], text: '' });
  assert.equal(ex.standard, 'GOTS'); assert.equal(ex.expires, '2028-01-31'); assert.equal(ex.matchedManufacturerId, 'm-tirupur-organics');
});
// ---------- HTTP permission checks against the real server ----------
const { app } = await import('./index.js');
const { DEMO_PASSWORD } = await import('../data/seed.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;
const client = () => {
  let cookie = '';
  const call = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b || {}), patch: (u, b) => call('PATCH', u, b) };
};
const asyncChecks = [];
const at = (name, fn) => asyncChecks.push([name, fn]);
at('signed-out visitors can browse but not shortlist', async () => {
  const c = client();
  assert.equal((await c.post('/match', { query: 'gots' })).status, 200);
  assert.equal((await c.get('/shortlist')).status, 401);
});
at('wrong password is refused without saying which part was wrong', async () => {
  const r = await client().post('/auth/login', { email: 'anitha@kaveri-organic-knits.example', password: 'nope-nope' });
  assert.equal(r.status, 401); assert.ok(!/email/i.test(r.body.error.split('match')[1] || ''));
});
at('a manufacturer signs in and edits only its own profile', async () => {
  const c = client();
  assert.equal((await c.post('/auth/login', { email: 'anitha@kaveri-organic-knits.example', password: DEMO_PASSWORD })).status, 200);
  assert.equal((await c.patch('/manufacturers/m-tirupur-organics', { moq: 250 })).status, 200);
  assert.equal((await c.patch('/manufacturers/m-dhaka-denim', { moq: 1 })).status, 403);
  assert.equal((await c.get('/shortlist')).status, 403);
});
at('a brand cannot send a quote request as another brand', async () => {
  const c = client();
  await c.post('/auth/demo', { accountId: 'acct-b-kinetic-earth' });
  const r = await c.post('/rfqs', { brandId: 'b-meadow-thread', manufacturerId: 'm-ningbo-rpet', message: 'Quote for 3,000 tees?' });
  assert.equal(r.status, 200); assert.equal(r.body.brandId, 'b-kinetic-earth');
});
at('emails stay with their recipients', async () => {
  const brand = client(); await brand.post('/auth/demo', { accountId: 'acct-b-kinetic-earth' });
  const maker = client(); await maker.post('/auth/demo', { accountId: 'acct-m-ningbo-rpet' });
  const mine = (await maker.get('/outbox')).body.emails;
  assert.ok(mine.length > 0 && mine.every((e) => e.about.manufacturerId === 'm-ningbo-rpet'));
  assert.equal((await brand.get(`/outbox/${mine[0].id}`)).status, 404);
});
at('sign-up creates a new factory profile and signs it in', async () => {
  const c = client();
  const bad = await c.post('/auth/signup', { role: 'manufacturer', name: 'A', email: 'not-an-email', password: 'short' });
  assert.equal(bad.status, 400); assert.ok(bad.body.fields.email && bad.body.fields.password);
  const r = await c.post('/auth/signup', { role: 'manufacturer', name: 'Lan Pham', email: 'lan@new-mill.example', password: 'long-enough-1', company: 'New Mill Co', country: 'Vietnam', city: 'Hue', categories: ['Fashion'], materials: 'organic cotton, linen' });
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'manufacturer');
  const me = (await c.get('/auth/me')).body.user;
  assert.equal(me.entityName, 'New Mill Co');
  assert.ok((await client().post('/match', { query: 'New Mill linen Vietnam' })).body.results.some((x) => x.manufacturer.name === 'New Mill Co'));
});
at('writes without JSON are refused', async () => {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
  assert.equal(r.status, 415);
});
for (const [name, fn] of asyncChecks) { await fn(); passed++; console.log('✓', name); }
server.close();
console.log(`\n${passed} checks passed`);
