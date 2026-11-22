// Optional: with ANTHROPIC_API_KEY set, Claude writes the answer from the retrieved passages.
// Without it, the built-in answer is used. Any error falls back to the built-in answer too.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.MERIDIAN_MODEL || 'claude-opus-5-5';
export const llmEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client;
const SYSTEM = `You are the search assistant on Meridian Loop, which connects sustainable clothing brands with manufacturers in Asia.
Answer only from the numbered SOURCES. Cite each fact inline as [n]. Never invent a company, number or certification.
Name the two or three best fits, give the facts that matter (place, what they make or need, minimum order or quantity, certifications), and say plainly if something in the request is not met.
Keep it under 120 words, in short paragraphs, with company names in **bold**. No headings, no lists, no dashes.`;

export async function writeAnswer({ side, query, sources }) {
  client ||= new Anthropic();
  const who = side === 'maker' ? 'a manufacturer looking for brands to supply' : 'a clothing brand looking for a manufacturer';
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `I am ${who}.\n\nSOURCES\n${sources.map((s) => `[${s.n}] ${s.title}\n${s.text}`).join('\n\n') || '(none)'}\n\nQUESTION\n${query}` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('declined');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) throw new Error('empty answer');
  return text;
}
