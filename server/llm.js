// Optional Claude generation layer. When ANTHROPIC_API_KEY is set, answers are written by
// Claude from the retrieved sources; otherwise the server uses its built-in answer composer.
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

export const MODEL = process.env.MERIDIAN_MODEL || 'claude-opus-5-5';
export const llmEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.MERIDIAN_OFFLINE !== '1';

let client;

// Streams Claude's answer, calling onText for each text delta. Throws on API errors or refusals
// so the caller can fall back to the offline composer.
export async function streamAnswer({ system, messages, onText }) {
  client ||= new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // re-runs a declined request on Anthropic's recommended fallback model
    output_config: { effort: process.env.MERIDIAN_EFFORT || 'low' },
    system,
    messages,
  });
  stream.on('text', onText);
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('Model declined the request');
  return final;
}

// Reads a certificate, audit summary or lab report PDF and returns its key fields as JSON.
// Throws on any API error or refusal so the caller can fall back to the local text reader.
const CERT_SCHEMA = {
  type: 'object',
  properties: {
    standard: { type: 'string', description: 'The certification standard or test, e.g. GOTS, GRS, OEKO-TEX Standard 100, SMETA 4-Pillar. Empty if none.' },
    number: { type: 'string', description: 'Certificate, licence, report or audit reference number exactly as printed. Empty if none.' },
    issuer: { type: 'string', description: 'The certification body, laboratory or auditor. Empty if none.' },
    company: { type: 'string', description: 'The certified company or site. Empty if none.' },
    issued: { type: 'string', description: 'Issue or audit date as YYYY-MM-DD. Empty if none.' },
    expires: { type: 'string', description: 'Valid-until, expiry or next-audit date as YYYY-MM-DD. For a month and year only, use the last day of that month. Empty if none.' },
    findings: { type: 'array', items: { type: 'string' }, description: 'Up to six short lines worth checking: scope, products, percentages, non-conformities, test results.' },
    text: { type: 'string', description: 'The document text, transcribed line by line.' },
  },
  required: ['standard', 'number', 'issuer', 'company', 'issued', 'expires', 'findings', 'text'],
  additionalProperties: false,
};

export async function readCertificatePdf(base64) {
  client ||= new Anthropic();
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: jsonSchemaOutputFormat(CERT_SCHEMA) },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'This is a sustainability certificate, audit summary or lab report uploaded by a textile manufacturer. Extract its fields exactly as printed. Do not guess: leave a field empty when the document does not state it.' },
      ],
    }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('Claude could not read this document');
  return res.parsed_output;
}
