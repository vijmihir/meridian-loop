// Trade details for every manufacturer, worked out from what the profile already says, so the demo can answer
// the questions brands really ask: price, samples, capacity, per-colour minimums, terms, traceability.
// A profile that states a field keeps its own value. Everything here is dummy data.

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 2 ** 32; };
const round = (n, step) => Math.round(n / step) * step;
const money = (n) => Math.round(n * 100) / 100;

// Price bands per piece (or per metre for cloth), in US dollars, by what the maker makes.
const BANDS = [
  [/suit|blazer|tailor/i, 40, 95, 'piece'],
  [/parka|jacket|outerwear|coat/i, 18, 36, 'piece'],
  [/silk/i, 14, 30, 'piece'],
  [/denim|jeans|chino/i, 9, 17, 'piece'],
  [/sweater|cardigan|knitwear|wool/i, 12, 26, 'piece'],
  [/swim|lingerie|bra|intimate/i, 5, 12, 'piece'],
  [/activewear|leggings|yoga|cycling|running|team kit|sportswear/i, 6, 13, 'piece'],
  [/fabric by the metre|fabric,|yarn|by the metre|woven fabric|cloth/i, 3.5, 9, 'metre'],
  [/handwoven|handloom|block-printed|batik|piña|scarves|sarong/i, 8, 22, 'piece'],
  [/hemp|nettle/i, 8, 16, 'piece'],
  [/t-shirt|tee|polo|basics|babywear|bodysuit|hoodie|sweatshirt|loungewear/i, 3, 8, 'piece'],
];

const LANGS = {
  India: ['English', 'Hindi'], Vietnam: ['Vietnamese', 'English'], China: ['Chinese', 'English'], Bangladesh: ['Bengali', 'English'],
  Cambodia: ['Khmer', 'English'], Indonesia: ['Indonesian', 'English'], 'Sri Lanka': ['English', 'Sinhala'], Thailand: ['Thai', 'English'],
  Pakistan: ['Urdu', 'English'], Nepal: ['Nepali', 'English'], Philippines: ['English', 'Filipino'], Laos: ['Lao', 'English'], Japan: ['Japanese', 'English'],
};

const STAGES = ['Fibre', 'Yarn', 'Fabric', 'Dyeing', 'Sewing'];

export function certState(c, today = new Date()) {
  if (c.validUntil && new Date(c.validUntil) < today) return 'expired';
  return c.check?.status || 'given';
}

export function enrichMaker(m) {
  const r = hash(m.id);
  const text = `${m.makes} ${m.materials.join(' ')}`;
  const [, lo, hi, unit] = BANDS.find(([re]) => re.test(text)) || [null, 6, 14, 'piece'];
  const k = 0.85 + r * 0.3;
  const priceFrom = money(lo * k), priceTo = money(hi * k);
  const certNames = m.certifications.map((c) => c.name).join(' ');
  const fibreDoc = /GOTS|GRS|OCS|RCS|RWS|European Flax|FSC/.test(certNames);
  const vertical = /vertical|integrated|grows, spins|raises its own|from fibre|hand-spun|one supply chain/i.test(m.about);
  const trace = STAGES.map((stage, i) => {
    let level = 'unknown';
    if (i >= 3) level = 'documented';                       // dyeing and sewing happen in the maker's own unit
    if (i === 2) level = vertical || fibreDoc ? 'documented' : 'self-declared';
    if (i === 1) level = vertical || (fibreDoc && r > 0.45) ? 'documented' : fibreDoc ? 'self-declared' : 'unknown';
    if (i === 0) level = fibreDoc ? 'documented' : vertical ? 'self-declared' : (r > 0.55 ? 'self-declared' : 'unknown');
    return { stage, level };
  });
  const certifications = m.certifications.map((c, i) => {
    if (c.check) return c;
    if (c.issuer === 'Self-reported') return { ...c, check: { status: 'given' } };
    const h = hash(`${m.id}:${c.name}:${i}`);
    const status = h < 0.78 ? 'checked' : 'given';   // 'not-found' only where a scenario sets it
    return { ...c, check: status === 'checked' ? { status, on: '2026-10-1' + Math.floor(h * 9), register: `${c.issuer} public register` } : status === 'not-found' ? { status, on: '2026-10-21', register: `${c.issuer} public register` } : { status } };
  });
  return {
    priceRange: { from: priceFrom, to: priceTo, currency: 'US$', unit },
    sampleCost: Math.max(25, round(priceTo * 6, 5)),
    sampleDays: Math.max(7, Math.round(m.leadTimeDays / 3)),
    capacityPerMonth: Math.max(m.moq * 4, round(m.moq * (6 + r * 18), 100)),
    moqPerColour: Math.max(10, round(m.moq * (m.moq >= 500 ? 0.4 : 0.6), 10)),
    incoterms: m.moq >= 1000 ? ['FOB', 'CIF', 'DDP'] : r > 0.5 ? ['FOB', 'CIF'] : ['EXW', 'FOB'],
    languages: LANGS[m.country] || ['English'],
    whatsapp: r > 0.25,
    traceability: trace,
    ...m,
    certifications,
    // passport-ready: every stage documented, and a fibre certificate the register confirms and that is in date
    dppReady: m.dppReady ?? (trace.every((t) => t.level === 'documented')
      && certifications.some((c) => /GOTS|GRS|OCS|RCS|RWS|European Flax|FSC/.test(c.name) && certState(c) === 'checked')),
  };
}

export const TRACE_STAGES = STAGES;
