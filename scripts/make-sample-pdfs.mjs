// Builds the demo's sample certificate PDFs from data/seed.js into client/public/samples.
// Run: node scripts/make-sample-pdfs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sampleDocuments } from '../data/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'client', 'public', 'samples');
fs.mkdirSync(out, { recursive: true });
export const slug = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ink = rgb(0.12, 0.16, 0.14), muted = rgb(0.38, 0.42, 0.4), green = rgb(0.05, 0.42, 0.27), rule = rgb(0.8, 0.82, 0.78);
const manifest = [];

for (const doc of sampleDocuments) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.label); pdf.setAuthor('Meridian Loop demo'); pdf.setSubject('Fictional sample document for the Meridian Loop demo');
  const page = pdf.addPage([595, 842]); // A4
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 28, y: 28, width: 539, height: 786, borderColor: green, borderWidth: 1.5 });
  page.drawRectangle({ x: 34, y: 34, width: 527, height: 774, borderColor: rule, borderWidth: 0.75 });

  const [issuer, title, ...rest] = doc.text.split('\n');
  let y = 760;
  page.drawText(issuer, { x: 60, y, size: 13, font: sansBold, color: green });
  y -= 44;
  const wrap = (txt, font, size, width) => {
    const words = txt.split(' '); const lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  };
  for (const l of wrap(title, serifBold, 20, 475)) { page.drawText(l, { x: 60, y, size: 20, font: serifBold, color: ink }); y -= 26; }
  y -= 8;
  page.drawLine({ start: { x: 60, y }, end: { x: 535, y }, thickness: 0.75, color: rule });
  y -= 30;
  for (const line of rest) {
    const m = /^([A-Za-z /]+):\s*(.*)$/.exec(line);
    if (m && m[1].length < 40) {
      page.drawText(m[1] + ':', { x: 60, y, size: 11, font: sans, color: muted });
      const lines = wrap(m[2], serif, 13, 330);
      lines.forEach((l, i) => page.drawText(l, { x: 205, y: y - i * 18, size: 13, font: serif, color: ink }));
      y -= 18 * Math.max(1, lines.length) + 10;
    } else {
      for (const l of wrap(line, serif, 13, 475)) { page.drawText(l, { x: 60, y, size: 13, font: serif, color: ink }); y -= 18; }
      y -= 10;
    }
  }
  // A seal, drawn as two rings and a word: plain geometry, no picture.
  page.drawCircle({ x: 470, y: 120, size: 46, borderColor: green, borderWidth: 2 });
  page.drawCircle({ x: 470, y: 120, size: 39, borderColor: green, borderWidth: 0.75 });
  page.drawText('VERIFIED', { x: 470 - sansBold.widthOfTextAtSize('VERIFIED', 10) / 2, y: 116, size: 10, font: sansBold, color: green });
  page.drawText('Fictional sample for the Meridian Loop demo. Not a real certificate.', { x: 60, y: 52, size: 8, font: sans, color: muted });

  const file = `${slug(doc.label)}.pdf`;
  fs.writeFileSync(path.join(out, file), await pdf.save());
  manifest.push({ label: doc.label, file });
  console.log('wrote', file);
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(manifest, null, 2));
