// Email alerts. Every alert is written to the outbox, so it can be previewed in the app.
// It is only sent for real when SMTP_URL is set; DEMO_INBOX redirects all mail to one address.
import nodemailer from 'nodemailer';
import * as store from './store.js';
import { scoreManufacturer, certStatus } from './scoring.js';

// On Render, RENDER_EXTERNAL_URL is the site's public address, so email buttons link to the live site.
const APP_URL = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 8787}`).replace(/\/$/, '');
const FROM = process.env.MAIL_FROM || 'Meridian Loop <alerts@meridian-loop.example>';
const DEMO_INBOX = process.env.DEMO_INBOX || '';
let transport = null;
if (process.env.SMTP_URL) transport = nodemailer.createTransport(process.env.SMTP_URL);

export const mailMode = () => ({ mode: transport ? 'smtp' : 'preview', redirect: transport && DEMO_INBOX ? DEMO_INBOX : null });

// ---------- Recipients (demo addresses on the reserved .example domain) ----------
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function makerContact(m) {
  const person = (m.contact || 'Team').split(',')[0].trim();
  return { name: person, first: person.split(' ')[0], email: m.contactEmail || `${slug(person.split(' ')[0])}@${slug(m.name)}.example` };
}
export function brandContact(b) {
  return { name: `${b.name} sourcing team`, first: `${b.name} team`, email: b.contactEmail || `sourcing@${slug(b.name)}.example` };
}

// ---------- Template ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function layout({ preheader, greeting, paragraphs, quote, rows, action }) {
  const rowsHtml = rows?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0">${rows.map((r) => `<tr><td style="padding:12px 0;border-top:1px solid #dfe3d8;font:600 15px/1.4 Arial,sans-serif;color:#1d2823">${esc(r.title)}<div style="font:400 14px/1.5 Arial,sans-serif;color:#4b5650">${esc(r.detail)}</div></td><td align="right" style="padding:12px 0;border-top:1px solid #dfe3d8;font:600 13px/1.4 Arial,sans-serif;color:${r.tone === 'bad' ? '#5b6159' : '#0b6b45'};white-space:nowrap">${esc(r.badge)}</td></tr>`).join('')}</table>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(preheader)}</title></head>
<body style="margin:0;padding:0;background:#f4f1e8">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1e8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border-radius:14px">
<tr><td style="padding:28px 32px 8px;font:700 20px/1 Arial,sans-serif;color:#0b6b45">Meridian Loop</td></tr>
<tr><td style="padding:8px 32px 28px;font:400 16px/1.6 Arial,sans-serif;color:#1d2823">
<p style="margin:0 0 14px">${esc(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join('')}
${quote ? `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#eef3ea;border-radius:10px;font:400 15px/1.55 Arial,sans-serif;color:#1d2823">${esc(quote)}</blockquote>` : ''}
${rowsHtml}
${action ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="background:#0b6b45;border-radius:10px"><a href="${esc(action.url)}" style="display:inline-block;padding:13px 22px;font:600 15px/1 Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(action.label)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #dfe3d8;font:400 12px/1.5 Arial,sans-serif;color:#6b736d">You get this because your company has a profile on Meridian Loop. Demo build: every company in it is fictional.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [greeting, ...paragraphs, quote ? `"${quote}"` : '', ...(rows || []).map((r) => `- ${r.title}: ${r.detail} (${r.badge})`), action ? `${action.label}: ${action.url}` : '', '', 'Meridian Loop. Demo build: every company in it is fictional.'].filter((x) => x !== '').join('\n\n');
  return { html, text };
}

// ---------- Queue and send ----------
export function queue({ kind, to, subject, body, about }) {
  const { html, text } = layout(body);
  const email = store.addEmail({ kind, to: to.email, toName: to.name, subject, html, text, about, from: FROM });
  if (transport) {
    const rcpt = DEMO_INBOX || to.email;
    transport.sendMail({ from: FROM, to: rcpt, subject: DEMO_INBOX ? `[for ${to.email}] ${subject}` : subject, html, text })
      .then((info) => store.updateEmail(email.id, { status: 'sent', sentTo: rcpt, messageId: info.messageId }))
      .catch((err) => store.updateEmail(email.id, { status: 'failed', error: err.message }));
  }
  return email;
}

// ---------- Alerts ----------
export function quoteRequested(rfq) {
  const m = store.getManufacturer(rfq.manufacturerId), b = store.getBrand(rfq.brandId);
  if (!m || !b) return null;
  const to = makerContact(m);
  return queue({
    kind: 'quote-request', to, about: { audience: 'maker', manufacturerId: m.id, brandId: b.id, rfqId: rfq.id },
    subject: `New quote request from ${b.name}`,
    body: { preheader: `${b.name} wants a quote`, greeting: `Hi ${to.first},`, paragraphs: [`${b.name} (${b.hq}) sent ${m.name} a quote request on Meridian Loop.`], quote: rfq.message, action: { label: 'Reply with a quote', url: `${APP_URL}/#/maker/inbox` } },
  });
}

export function proposalSent(rfq) {
  const m = store.getManufacturer(rfq.manufacturerId), b = store.getBrand(rfq.brandId);
  if (!m || !b) return null;
  const to = brandContact(b);
  return queue({
    kind: 'proposal', to, about: { audience: 'brand', manufacturerId: m.id, brandId: b.id, rfqId: rfq.id },
    subject: `${m.name} sent a proposal${rfq.requestTitle ? ` for ${rfq.requestTitle}` : ''}`,
    body: { preheader: `A proposal from ${m.name}`, greeting: `Hi ${to.first},`, paragraphs: [`${m.name} in ${m.city}, ${m.country} answered your sourcing request${rfq.requestTitle ? ` “${rfq.requestTitle}”` : ''}.`], quote: rfq.message, action: { label: 'Open the proposal', url: `${APP_URL}/#/brand/rfqs` } },
  });
}

export function replied(rfq, from, text) {
  const m = store.getManufacturer(rfq.manufacturerId), b = store.getBrand(rfq.brandId);
  if (!m || !b) return null;
  const toMaker = from === 'brand';
  const to = toMaker ? makerContact(m) : brandContact(b);
  const sender = toMaker ? b.name : m.name;
  return queue({
    kind: 'reply', to, about: { audience: toMaker ? 'maker' : 'brand', manufacturerId: m.id, brandId: b.id, rfqId: rfq.id },
    subject: `${sender} replied${rfq.requestTitle ? `: ${rfq.requestTitle}` : ''}`,
    body: { preheader: `New reply from ${sender}`, greeting: `Hi ${to.first},`, paragraphs: [`${sender} replied to your conversation on Meridian Loop.`], quote: text, action: { label: 'Open the conversation', url: `${APP_URL}/#/${toMaker ? 'maker/inbox' : 'brand/rfqs'}` } },
  });
}

// Stages a certificate can reach; each is emailed once.
function certStage(c) {
  const st = certStatus(c);
  if (st.state === 'withdrawn') return { stage: 'withdrawn', badge: 'Withdrawn by issuer', detail: c.registry?.note || 'Withdrawn by the issuer', tone: 'bad' };
  if (st.state === 'expired') return { stage: 'expired', badge: 'Expired', detail: `Expired on ${fmt(c.expires)}. Brands now see it as lapsed.`, tone: 'bad' };
  if (st.reason === 'mismatch') return { stage: 'mismatch', badge: 'Differs from issuer', detail: c.registry?.note || '', tone: 'bad' };
  if (st.days <= 30) return { stage: 'due-30', badge: `${st.days} days left`, detail: `Expires on ${fmt(c.expires)}. Upload the renewal to keep your score.`, tone: 'warn' };
  if (st.days <= 60) return { stage: 'due-60', badge: `${st.days} days left`, detail: `Expires on ${fmt(c.expires)}.`, tone: 'warn' };
  return null;
}

// The daily certificate check: one digest email per manufacturer with anything new to report.
export function runCertificateCheck() {
  const sent = [];
  for (const m of store.getManufacturers()) {
    const items = [];
    for (const c of m.certifications) {
      const s = certStage(c);
      if (!s) continue;
      const key = `${m.id}|${c.id}|${s.stage}`;
      if (!store.alertSent(key)) items.push({ key, title: `${c.name}, ${c.id}`, ...s });
    }
    if (!items.length) continue;
    items.sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
    const to = makerContact(m);
    const bad = items.filter((i) => i.tone === 'bad').length;
    const score = scoreManufacturer(m);
    const email = queue({
      kind: 'certificate-check', to, about: { audience: 'maker', manufacturerId: m.id },
      subject: bad ? `Action needed: ${bad === 1 ? 'a certificate' : `${bad} certificates`} for ${m.name}` : `${items.length === 1 ? 'A certificate for ' + m.name + ' expires soon' : `${items.length} certificates for ${m.name} expire soon`}`,
      body: {
        preheader: `${items.length} certificate${items.length > 1 ? 's' : ''} need attention`,
        greeting: `Hi ${to.first},`,
        paragraphs: [`Today’s certificate check found ${items.length === 1 ? 'one certificate' : `${items.length} certificates`} on your Meridian Loop profile that need attention. Brands see these when they compare suppliers.`, ...(score.flags.some((f) => f.level === 'high') ? ['Until this is fixed, your profile ranks lower in brand searches.'] : [])],
        rows: items,
        action: { label: 'Upload a renewal', url: `${APP_URL}/#/maker/documents` },
      },
    });
    store.markAlerts(items.map((i) => i.key));
    sent.push(email);
  }
  return sent;
}

// Runs the check now and then every six hours.
export function startCertificateSchedule() {
  runCertificateCheck();
  const t = setInterval(runCertificateCheck, 6 * 60 * 60 * 1000);
  t.unref?.();
}
