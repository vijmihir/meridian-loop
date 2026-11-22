// Scores the search against data/eval-briefs.js. Run: npm run eval  (add --verbose to list every brief)
// hit@1: the top result is one an expert would choose; hit@3: one of them is in the top three.
import os from 'node:os';
import path from 'node:path';

process.env.MERIDIAN_STATE = path.join(os.tmpdir(), `meridian-eval-${process.pid}.json`);
const store = await import('./store.js');
await store.ready();
const engine = await import('./engine.js');
engine.rebuildIndex();
const { briefs } = await import('../data/eval-briefs.js');

const verbose = process.argv.includes('--verbose');
let h1 = 0, h3 = 0;
const misses = [];
for (const [side, q, want] of briefs) {
  const ids = engine.search(side, q).matches.map((m) => m.id);
  const top1 = want.includes(ids[0]), top3 = ids.slice(0, 3).some((id) => want.includes(id));
  h1 += top1; h3 += top3;
  if (!top1) misses.push({ q, got: ids.slice(0, 3), want, top3 });
  if (verbose) console.log(`${top1 ? '✓' : top3 ? '~' : '✗'} ${q}  →  ${ids.slice(0, 3).join(', ')}`);
}
const pct = (n) => `${Math.round((n / briefs.length) * 100)}%`;
console.log(`\n${briefs.length} briefs: hit@1 ${h1} (${pct(h1)}), hit@3 ${h3} (${pct(h3)})`);
if (misses.length) {
  console.log('\nNot first:');
  for (const m of misses) console.log(`${m.top3 ? '~' : '✗'} "${m.q}"  got ${m.got.join(', ') || 'nothing'}  wanted ${m.want.join(' or ')}`);
}
await store.flush();
process.exit(h3 / briefs.length >= 0.9 ? 0 : 1);
