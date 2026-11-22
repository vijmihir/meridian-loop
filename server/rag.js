// Retrieval layer for Meridian Loop.
// Hybrid retrieval: BM25 over words + phrases, plus character-trigram cosine for fuzzy
// matches (typos, partial words). Runs fully in-process, no external services.

const STOP = new Set(('a an the and or of for to in on with by from at as is are be we i our my me you your ' +
  'need needs looking find want who which that this these those can could should would will any some ' +
  'please help show give me us it its into about than then there their them what where how do does ' +
  'manufacturer manufacturers supplier suppliers factory factories brand brands product products make made making').split(' '));

// Domain synonyms used for query expansion. Each group is treated as related terms.
const SYNONYM_GROUPS = [
  ['organic cotton', 'gots'],
  ['recycled polyester', 'rpet', 'grs', 'plastic bottles', 'recycled plastic'],
  ['recycled nylon', 'econyl'],
  ['recycled', 'upcycled', 'grs', 'rcs', 'circular', 'post-consumer'],
  ['vegan leather', 'plant-based leather', 'cactus leather', 'apple leather', 'grape leather', 'leather alternative'],
  ['vegan', 'peta', 'plant-based'],
  ['leather', 'tannery', 'lwg'],
  ['shoes', 'footwear', 'sneakers', 'sneaker', 'trainers', 'sandals', 'boots', 'espadrilles'],
  ['bags', 'bag', 'tote', 'totes', 'handbag', 'handbags', 'backpack', 'crossbody', 'accessories', 'wallet'],
  ['home', 'bedding', 'bed linen', 'quilt', 'duvet', 'pillowcase', 'throw', 'blanket', 'rug', 'rugs', 'home textiles', 'table linen', 'napkins', 'towels'],
  ['activewear', 'sportswear', 'leggings', 'yoga', 'running', 'athleisure', 'performance'],
  ['t-shirt', 't-shirts', 'tee', 'tees', 'basics', 'jersey'],
  ['loungewear', 'sleepwear', 'hoodie', 'joggers', 'french terry'],
  ['babywear', 'baby', 'kidswear', 'kids', 'bodysuit', 'swaddle'],
  ['denim', 'jeans'],
  ['silk', 'mulberry silk', 'peace silk', 'ahimsa'],
  ['fair trade', 'wfto', 'fairtrade', 'living wage', 'fair wages', 'ethical', 'social'],
  ['natural dyes', 'natural dyeing', 'indigo', 'plant dyes', 'madder'],
  ['handmade', 'artisan', 'hand weaving', 'handwoven', 'hand block printing', 'craft', 'hand loom'],
  ['lyocell', 'tencel', 'modal', 'cellulosic'],
  ['solar', 'renewable energy', 'renewable'],
  ['water', 'zero liquid discharge', 'zld', 'water recycling', 'ozone'],
  ['chemicals', 'bluesign', 'zdhc', 'oeko-tex', 'non-toxic'],
  ['plastic-free', 'biodegradable', 'compostable', 'jute', 'rattan'],
  ['biodegradable fabric', 'biodegradable', 'jute', 'coir', 'banana fibre', 'hemp', 'lyocell', 'natural fibres'],
  ['waste cotton', 'recycled cotton', 'post-consumer textile waste', 'pre-consumer cutting waste', 'upcycling'],
  ['organic fabric', 'organic cotton', 'gots', 'organic silk'],
  ['small moq', 'low moq', 'small batch', 'small runs', 'startup', 'emerging', 'micro runs', 'deadstock'],
  // what a garment should feel like or be for, mapped to the fibres and makers that deliver it
  ['breathable', 'summer', 'hot weather', 'lightweight', 'linen', 'cotton voile', 'ramie', 'tencel', 'bamboo'],
  ['warm', 'winter', 'cold weather', 'wool', 'merino', 'fleece', 'knitwear', 'sweaters'],
  ['stretch', 'stretchy', 'elastane', 'seamless', 'leggings'],
  ['moisture-wicking', 'quick-dry', 'sweat', 'running', 'recycled polyester', 'performance'],
  ['luxury', 'premium', 'high end', 'silk', 'cashmere', 'tailoring', 'hand embroidery'],
  ['children', 'school uniforms', 'kidswear'],
  ['formal', 'office', 'smart', 'shirts', 'tailoring', 'suits', 'blazers'],
  ['resort', 'beachwear', 'holiday', 'kaftans', 'sarongs', 'swimwear'],
  ['traceable', 'traceability', 'product passport', 'digital product passport', 'dpp', 'documented', 'vertically integrated'],
  ['embroidery', 'embellished', 'beadwork', 'zari'],
  ['deadstock', 'surplus fabric', 'end of roll'],
  ['merch', 'merchandise', 'event tees', 'printed tees', 'screen printing'],
  ['outerwear', 'jackets', 'parkas', 'rain jackets', 'coats'],
];

const SYN = new Map();
for (const group of SYNONYM_GROUPS) for (const t of group) SYN.set(t, group);

export function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -1);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function words(text) {
  return text.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9\-]+/).filter(Boolean);
}

// Unigrams (stemmed, stopwords removed) + bigrams for phrase precision.
export function tokenize(text) {
  const ws = words(text).filter((w) => !STOP.has(w));
  const toks = ws.map(stem);
  for (let i = 0; i < ws.length - 1; i++) toks.push(stem(ws[i]) + '_' + stem(ws[i + 1]));
  return toks;
}

function trigrams(text) {
  const s = ' ' + text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const m = new Map();
  for (let i = 0; i < s.length - 2; i++) {
    const g = s.slice(i, i + 3);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, v] of small) { const w = big.get(k); if (w) dot += v * w; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Expand a query into weighted terms: original terms weight 1, synonyms weight 0.5.
export function expandQuery(q) {
  const lower = q.toLowerCase();
  const weights = new Map();
  for (const t of tokenize(q)) weights.set(t, 1);
  const expansions = new Set();
  for (const [term, group] of SYN) {
    const re = new RegExp(`(^|[^a-z])${term.replace(/[-]/g, '[- ]?')}([^a-z]|$)`);
    if (re.test(lower)) for (const g of group) if (g !== term) expansions.add(g);
  }
  for (const e of expansions) for (const t of tokenize(e)) if (!weights.has(t)) weights.set(t, 0.5);
  return { weights, expansions: [...expansions] };
}

export class Index {
  constructor() { this.docs = []; this.df = new Map(); this.avgLen = 0; }

  build(docs) {
    this.docs = docs.map((d) => {
      const toks = tokenize(d.title + ' ' + d.text);
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      return { ...d, tf, len: toks.length, tri: trigrams(d.title + ' ' + d.text) };
    });
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
    return this;
  }

  search(query, { kinds, k = 12, filter } = {}) {
    const { weights, expansions } = expandQuery(query);
    const qTri = trigrams(query);
    const N = this.docs.length, k1 = 1.4, b = 0.75;
    const pool = this.docs.filter((d) => (!kinds || kinds.includes(d.kind)) && (!filter || filter(d)));
    const scored = pool.map((d) => {
      let bm = 0; const hits = [];
      for (const [t, w] of weights) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        bm += w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / this.avgLen));
        if (w === 1 && !t.includes('_')) hits.push(t);
      }
      const fuzzy = cosine(qTri, d.tri);
      return { doc: d, bm25: bm, fuzzy, hits };
    });
    const maxBm = Math.max(1e-9, ...scored.map((s) => s.bm25));
    for (const s of scored) s.score = 0.8 * (s.bm25 / maxBm) + 0.2 * s.fuzzy;
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, k).filter((s) => s.score > 0.02), expansions };
  }
}

// ---------- Query understanding: pull structured constraints out of natural language ----------
export const COUNTRIES = {
  India: ['india', 'indian'], Vietnam: ['vietnam', 'vietnamese', 'viet nam'], China: ['china', 'chinese', 'prc'],
  Bangladesh: ['bangladesh', 'bangladeshi'], Cambodia: ['cambodia', 'cambodian'], Indonesia: ['indonesia', 'indonesian', 'bali', 'java'],
  'Sri Lanka': ['sri lanka', 'sri lankan', 'lanka'], Thailand: ['thailand', 'thai'], Pakistan: ['pakistan', 'pakistani'], Nepal: ['nepal', 'nepali', 'nepalese'],
  Philippines: ['philippines', 'filipino', 'philippine'], Laos: ['laos', 'lao'], Japan: ['japan', 'japanese'],
};
const CATEGORIES = {
  Footwear: ['shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'sandal', 'sandals', 'trainers', 'boots', 'espadrille'],
  Accessories: ['bag', 'bags', 'tote', 'totes', 'handbag', 'wallet', 'accessories', 'scarf', 'scarves', 'hat', 'backpack', 'crossbody', 'sleep mask'],
  'Home Textiles': ['home', 'bedding', 'quilt', 'duvet', 'pillowcase', 'throw', 'blanket', 'rug', 'rugs', 'towel', 'towels', 'table linen', 'napkin', 'cushion', 'home textiles', 'swaddle'],
  Fashion: ['apparel', 'clothing', 'garment', 'garments', 't-shirt', 't-shirts', 'tee', 'tees', 'hoodie', 'leggings', 'activewear', 'jeans', 'denim', 'dress', 'dresses', 'jacket', 'loungewear', 'babywear', 'fashion', 'shirt', 'shirts'],
};
export const CERTS = [
  ['GOTS', /\bgots\b|organic certif/], ['GRS', /\bgrs\b|global recycled/], ['RCS', /\brcs\b/], ['OEKO-TEX', /oeko[- ]?tex/],
  ['Fair Trade', /fair ?trade|wfto/], ['bluesign', /bluesign/], ['FSC', /\bfsc\b/], ['SA8000', /sa ?8000/], ['LWG', /\blwg\b|leather working group/],
  ['WRAP', /\bwrap\b/], ['Higg FEM', /\bhigg\b/], ['ZDHC', /\bzdhc\b/], ['amfori BSCI', /\bbsci\b|amfori/], ['SMETA', /smeta|sedex/],
  ['PETA', /\bpeta\b|vegan certif/], ['OCS', /\bocs\b|organic content standard/], ['RWS', /\brws\b|responsible wool/], ['ISO 14001', /iso ?14001/],
];

export function parseConstraints(q) {
  const s = q.toLowerCase();
  const out = { countries: [], categories: [], certifications: [], maxMoq: null, maxLeadDays: null, maxPrice: null, budget: false, vegan: false, excludeCountries: [], minCapacity: null, verifiedOnly: false, needsDpp: false };
  for (const [c, keys] of Object.entries(COUNTRIES)) {
    for (const k of keys) {
      const re = new RegExp(`(not|outside|except|excluding|avoid)\\s+(from\\s+|in\\s+)?${k}\\b`);
      if (re.test(s)) { out.excludeCountries.push(c); break; }
      if (new RegExp(`\\b${k}\\b`).test(s)) { out.countries.push(c); break; }
    }
  }
  for (const [c, keys] of Object.entries(CATEGORIES)) if (keys.some((k) => new RegExp(`\\b${k}\\b`).test(s))) out.categories.push(c);
  for (const [name, re] of CERTS) if (re.test(s)) out.certifications.push(name);

  let m = s.match(/(?:moq|minimum order|min\.? order)[^0-9]{0,25}(\d[\d,]*)/) || s.match(/(?:under|below|less than|fewer than|max(?:imum)?|up to|<)\s*(\d[\d,]*)\s*(?:units|pieces|pcs|moq)/);
  if (m) out.maxMoq = parseInt(m[1].replace(/,/g, ''), 10);
  else if (/(small|low) (moq|batch|minimum|run)|small runs|start-?up|emerging brand/.test(s)) out.maxMoq = 300;

  m = s.match(/(?:within|under|less than|in|below|max(?:imum)?)\s*(\d+)\s*(day|days|week|weeks)/);
  if (m) out.maxLeadDays = parseInt(m[1], 10) * (m[2].startsWith('week') ? 7 : 1);
  else if (/(fast|quick|short) (lead|turnaround|delivery)|urgent|asap/.test(s)) out.maxLeadDays = 35;

  m = s.match(/(?:under|below|less than|max|up to|at|<)\s*(?:us)?\$\s?(\d+(?:\.\d+)?)/) || s.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollars)/);
  if (m) out.maxPrice = parseFloat(m[1]);
  if (/\bvegan\b|animal[- ]free|cruelty[- ]free/.test(s)) out.vegan = true;
  m = s.match(/(\d[\d,]*)\s*(k)?\s*(?:units|pieces|pcs)?\s*(?:a|per|each)\s*month/);
  if (m) out.minCapacity = parseInt(m[1].replace(/,/g, ''), 10) * (m[2] ? 1000 : 1);
  if (/(checked|verified|confirmed)\s+(certific|certs?)|certificates?\s+(checked|verified)|verified only/.test(s)) out.verifiedOnly = true;
  if (/product passport|\bdpp\b|traceab|every stage documented|fully documented/.test(s)) out.needsDpp = true;
  if (/cheap|low cost|low-cost|budget|affordable|cost[- ]effective|competitive pric/.test(s)) out.budget = true;
  return out;
}

export function describeConstraints(c) {
  const parts = [];
  if (c.categories.length) parts.push(c.categories.join(' / '));
  if (c.countries.length) parts.push('in ' + c.countries.join(' or '));
  if (c.excludeCountries.length) parts.push('excluding ' + c.excludeCountries.join(', '));
  if (c.certifications.length) parts.push('with ' + c.certifications.join(' + '));
  if (c.maxMoq) parts.push(`MOQ ≤ ${c.maxMoq}`);
  if (c.maxLeadDays) parts.push(`lead time ≤ ${c.maxLeadDays} days`);
  if (c.maxPrice) parts.push(`price ≤ $${c.maxPrice}`);
  if (c.minCapacity) parts.push(`${c.minCapacity.toLocaleString()}+ a month`);
  if (c.verifiedOnly) parts.push('checked certificates');
  if (c.needsDpp) parts.push('passport-ready');
  if (c.vegan) parts.push('vegan');
  if (c.budget) parts.push('cost-sensitive');
  return parts;
}
