// Quantitative decision intelligence: scores each manufacturer on seven dimensions
// (0–100, higher is better) and combines them with user-adjustable weights.

export const DIMENSIONS = [
  { key: 'cost', label: 'Cost' },
  { key: 'sustainability', label: 'Sustainability' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'quality', label: 'Quality' },
  { key: 'leadTime', label: 'Lead time' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'risk', label: 'Low risk' },
];

export const DEFAULT_WEIGHTS = { cost: 15, sustainability: 25, reliability: 15, quality: 15, leadTime: 10, compliance: 10, risk: 10 };

// How much each certification contributes to the sustainability score.
const CERT_WEIGHT = [
  [/gots/i, 30], [/grs|rcs/i, 28], [/bluesign/i, 22], [/fair ?trade|wfto/i, 22], [/leed/i, 18], [/higg/i, 15], [/zdhc/i, 15],
  [/lwg/i, 15], [/fsc/i, 15], [/oeko-tex step/i, 15], [/oeko-tex/i, 10], [/sa8000/i, 12], [/iso 14001/i, 10], [/peta|biopreferred/i, 10],
  [/craftmark/i, 8], [/better cotton/i, 8], [/wrap|bsci|smeta|accord|rsc|better factories/i, 6],
];

const COUNTRY_RISK = { China: 70, Vietnam: 80, India: 74, Bangladesh: 62, Cambodia: 66, Indonesia: 72 };

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const TODAY = () => new Date();

export function certStatus(cert, now = TODAY()) {
  const exp = new Date(cert.expires);
  const days = Math.round((exp - now) / 86400000);
  const reg = cert.registry?.status;
  if (days < 0) return { state: 'expired', days };
  if (reg === 'withdrawn') return { state: 'withdrawn', days };
  if (!cert.verified || reg === 'not_found' || reg === 'mismatch') return { state: 'unverified', days, reason: reg };
  if (days < 120) return { state: 'expiring', days };
  return { state: 'valid', days };
}

export function scoreManufacturer(m, now = TODAY()) {
  const statuses = m.certifications.map((c) => ({ ...c, status: certStatus(c, now) }));
  const live = statuses.filter((c) => !['expired', 'withdrawn'].includes(c.status.state));
  let certPts = 0;
  for (const c of live) {
    const w = CERT_WEIGHT.find(([re]) => re.test(c.name));
    certPts += (w ? w[1] : 5) * (c.status.state === 'unverified' ? 0.5 : 1);
  }
  const certScore = Math.min(100, certPts);
  const expired = statuses.filter((c) => ['expired', 'withdrawn'].includes(c.status.state)).length;
  const expiring = statuses.filter((c) => c.status.state === 'expiring').length;
  const unverified = statuses.filter((c) => c.status.state === 'unverified').length;
  const years = now.getFullYear() - m.founded;

  const scores = {
    cost: clamp(((5 - m.priceIndex) / 4) * 100),
    sustainability: clamp(0.45 * certScore + 0.3 * m.renewableEnergy + 0.25 * m.waterRecycled),
    reliability: clamp(((m.onTimeRate - 0.8) / 0.18) * 85 + Math.min(15, years / 2)),
    quality: clamp(((0.035 - m.defectRate) / 0.03) * 100),
    leadTime: clamp(((70 - m.leadTimeDays) / 45) * 100),
    compliance: clamp(m.auditScore - expired * 12 - unverified * 6 - expiring * 3),
    risk: clamp((COUNTRY_RISK[m.country] ?? 70) + (m.capacity > 100000 ? 8 : m.capacity < 15000 ? -8 : 0) - expired * 10 - expiring * 3 + (m.exportMarkets.length >= 4 ? 5 : 0)),
  };

  const flags = [];
  for (const c of statuses) {
    if (c.status.state === 'expired') flags.push({ level: 'high', text: `${c.name} certificate expired ${-c.status.days} days ago` });
    else if (c.status.state === 'withdrawn') flags.push({ level: 'high', text: `${c.name}: ${c.registry.note}` });
    else if (c.status.reason === 'mismatch') flags.push({ level: 'medium', text: `${c.name} does not match the issuer’s register. ${c.registry.note}` });
    else if (c.status.reason === 'not_found') flags.push({ level: 'medium', text: `${c.name} not confirmed by the issuer. ${c.registry.note}` });
    else if (c.status.state === 'unverified') flags.push({ level: 'medium', text: `${c.name} not yet verified; evidence pending` });
    else if (c.status.state === 'expiring') flags.push({ level: 'low', text: `${c.name} expires in ${c.status.days} days` });
  }
  if (m.isNew) flags.push({ level: 'low', text: 'New on Meridian Loop: delivery and quality figures are estimates until the first orders ship' });
  if (!m.isNew && m.defectRate > 0.025) flags.push({ level: 'medium', text: `Defect rate ${(m.defectRate * 100).toFixed(1)}% is above platform median` });
  if (!m.isNew && m.onTimeRate < 0.88) flags.push({ level: 'medium', text: `On-time delivery ${(m.onTimeRate * 100).toFixed(0)}% is below 88%` });

  return { scores, certifications: statuses, flags };
}

export function composite(scores, weights = DEFAULT_WEIGHTS) {
  const total = Object.values(weights).reduce((a, b) => a + Number(b || 0), 0) || 1;
  let s = 0;
  for (const d of DIMENSIONS) s += (scores[d.key] || 0) * Number(weights[d.key] || 0);
  return Math.round(s / total);
}

// Check parsed constraints against a manufacturer; returns pass/fail list for the UI.
export function checkConstraints(m, c) {
  const checks = [];
  if (c.countries.length) checks.push({ label: `Located in ${c.countries.join('/')}`, ok: c.countries.includes(m.country) });
  if (c.excludeCountries.length) checks.push({ label: `Not in ${c.excludeCountries.join('/')}`, ok: !c.excludeCountries.includes(m.country) });
  if (c.categories.length) checks.push({ label: `Makes ${c.categories.join('/')}`, ok: c.categories.some((x) => m.categories.includes(x)) });
  for (const cert of c.certifications) {
    const has = m.certifications.some((x) => x.name.toLowerCase().includes(cert.toLowerCase().split(' ')[0]) && !['expired', 'withdrawn'].includes(certStatus(x).state));
    checks.push({ label: `${cert} certified`, ok: has });
  }
  if (c.maxMoq) checks.push({ label: `MOQ ≤ ${c.maxMoq} (theirs: ${m.moq})`, ok: m.moq <= c.maxMoq });
  if (c.maxLeadDays) checks.push({ label: `Lead time ≤ ${c.maxLeadDays}d (theirs: ${m.leadTimeDays}d)`, ok: m.leadTimeDays <= c.maxLeadDays });
  return checks;
}

// Explain a ranking in plain words: top strengths and the biggest trade-off.
export function explain(m, scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const label = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label.toLowerCase()]));
  const strengths = sorted.slice(0, 2).map(([k, v]) => `${label[k]} (${v})`);
  const [wk, wv] = sorted[sorted.length - 1];
  return `Strongest on ${strengths.join(' and ')}; main trade-off is ${label[wk]} (${wv}).`;
}
