import { verifyCertificate } from './issuers.js';

// Document intelligence: pulls structured facts out of certificates, audit summaries
// and lab reports so they can be verified, attached to a profile and indexed for search.

const STANDARDS = [
  ['Bio-based content (ASTM D6866)', /astm d6866|bio-?based carbon/i],
  ['GOTS', /global organic textile standard|\bgots\b/i], ['GRS', /global recycled standard|\bgrs\b/i], ['RCS', /recycled claim standard|\brcs\b/i],
  ['OEKO-TEX Standard 100', /oeko[- ]?tex/i], ['SMETA 4-Pillar', /smeta/i], ['SA8000', /sa ?8000/i], ['bluesign', /bluesign/i],
  ['FSC Chain of Custody', /\bfsc\b/i], ['Fair Trade', /fair ?trade|wfto/i], ['LWG', /leather working group|\blwg\b/i],
  ['ISO 14001', /iso ?14001/i], ['WRAP', /\bwrap\b/i], ['Higg FEM', /higg/i],
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function toIso(s) {
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = s.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/i);
  if (m && MONTHS[m[1].toLowerCase()]) { // month + year → last day of month
    const y = +m[2], mo = MONTHS[m[1].toLowerCase()];
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return `${y}-${String(mo).padStart(2, '0')}-${last}`;
  }
  return null;
}

const grab = (text, re) => { const m = text.match(re); return m ? m[1].trim() : null; };

const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

// `given` holds fields Claude read from the original PDF; when present they win over the text rules.
export function extractDocument(text, manufacturers = [], given = null) {
  const fields = [];
  const std = STANDARDS.find(([, re]) => re.test(given?.standard || text));
  const standard = std ? std[0] : (given?.standard || null);

  const number = given ? (given.number || null) : grab(text, /(?:certificate|report|audit)\s*(?:number|no\.?|reference|ref\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9.\-\/]{3,})/i);
  const issuer = given ? (given.issuer || null) : grab(text, /(?:laboratory|auditor|issued by|certification body)\s*[:\-]\s*([^\n(,—]+)/i)
    || grab(text, /—\s*auditor:\s*([^\n]+)/i)
    || (text.split('\n')[0].match(/^[A-Z][A-Z &]{5,}$/) ? text.split('\n')[0].trim() : null);
  const expiresRaw = grab(text, /(?:valid until|expiry date|expires(?: on)?|next audit due|valid through)\s*[:\-]?\s*([^\n]+)/i);
  const expires = given ? isoDate(given.expires) : toIso(expiresRaw);
  const issuedRaw = grab(text, /(?:date of issue|issued|audit date)[^:\n]*[:,]?\s*([^\n—]+)/i);
  const issued = given ? isoDate(given.issued) : toIso(issuedRaw);

  let company = given ? (given.company || null) : grab(text, /certify that\s+([^,\n]+)/i) || grab(text, /(?:client|site|supplier|company)\s*:\s*([^,\n]+)/i);
  const match = company ? manufacturers.find((m) => company.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(company.toLowerCase())) : null;

  const findings = given ? (given.findings || []).slice(0, 6) : [];
  if (!given) for (const line of text.split('\n')) {
    if (/\d+\s*%|non-?conformit|critical|result|compliant|products?:|processing steps/i.test(line) && line.length < 160) findings.push(line.trim());
  }

  const add = (label, value, confidence) => value && fields.push({ label, value, confidence: given ? Math.max(confidence, 0.9) : confidence });
  add('Standard', standard, std ? 0.95 : 0);
  add('Certificate / report no.', number, 0.9);
  add('Issuing body', issuer, 0.8);
  add('Company', company, match ? 0.95 : 0.6);
  add('Issued', issued, 0.85);
  add('Valid until', expires, 0.9);

  const issues = [];
  if (!standard) issues.push('Could not identify a known certification standard.');
  if (!expires) issues.push('No expiry / validity date found.');
  if (expires && new Date(expires) < new Date()) issues.push('Document is already expired.');
  if (issued && new Date(issued) > new Date()) issues.push('The issue date is in the future, so check the document is genuine.');
  if (company && !match) issues.push('Company name does not match a platform profile.');

  const registry = standard ? verifyCertificate({ standard, number, holder: match?.name || company, expires }) : null;
  return { standard, number, issuer, company, registry, matchedManufacturerId: match?.id || null, issued, expires, findings: findings.slice(0, 6), fields, issues, confidence: Math.round((fields.reduce((s, f) => s + f.confidence, 0) / 6) * 100) };
}
