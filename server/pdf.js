// Reads the text layer of an uploaded PDF, locally, without running any script inside it.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PAGES = 10;

export const isPdf = (buf) => buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-';

export async function pdfText(buf) {
  const task = getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false, // never evaluate code embedded in the file
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const total = doc.numPages;
  const pages = Math.min(total, MAX_PAGES);
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    // Group text runs into lines by their vertical position, then read left to right.
    const lines = new Map();
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ x: it.transform[4], s: it.str });
    }
    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, runs]) => runs.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ').replace(/\s+/g, ' ').trim());
    out.push(ordered.join('\n'));
  }
  await task.destroy();
  return { text: out.join('\n\n').trim(), pages: total };
}
