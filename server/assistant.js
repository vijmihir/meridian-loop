// The sourcing assistant. One conversation turn in, a stream of events out:
//   text      a piece of the reply, to append
//   results   a ranked list of companies, with the passages it was built from
//   profile   one company in detail
//   compare   manufacturers side by side
//   choices   suggested replies the person can tap
//   state     the conversation state to send back next turn
// With an API key, Claude runs the turn and calls tools over the search index.
// Without one, a built-in assistant does: it reads the request, keeps the brief between turns,
// asks a question when the brief is too thin, and offers refinements drawn from the results.
import Anthropic from '@anthropic-ai/sdk';
import * as engine from './engine.js';
import * as store from './store.js';
import { parseConstraints, COUNTRIES, CERTS, tokenize, expandQuery } from './rag.js';

export const MODEL = process.env.MERIDIAN_MODEL || 'claude-opus-5-5';
export const llmEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const placeOf = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'self-reported');
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const listJoin = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// ---------- shared views of the data ----------

export function makerView(m) {
  return { type: 'maker', id: m.id, name: m.name, place: placeOf(m), country: m.country, founded: m.founded, makes: m.makes, about: m.about, materials: m.materials, processes: m.processes, moq: m.moq, leadTimeDays: m.leadTimeDays, certifications: m.certifications.map((c) => ({ name: c.name, issuer: c.issuer, validUntil: c.validUntil })), contact: m.contact, email: m.email };
}
export function brandView(b) {
  return { type: 'brand', id: b.id, name: b.name, place: placeOf(b), country: b.country, founded: b.founded, sells: b.sells, about: b.about, values: b.values, needs: b.needs, contact: b.contact, email: b.email };
}
const findEntity = (id) => { const m = store.getManufacturer(id); if (m) return makerView(m); const b = store.getBrand(id); return b ? brandView(b) : null; };

function compareRows(ids) {
  return ids.map((id) => store.getManufacturer(id)).filter(Boolean).slice(0, 4).map((m) => ({ id: m.id, name: m.name, place: placeOf(m), makes: m.makes, materials: m.materials.slice(0, 4), moq: m.moq, leadTimeDays: m.leadTimeDays, certifications: m.certifications.map((c) => c.name) }));
}

// Search, renumbering sources so citations stay unique across a turn.
function runSearch(side, query, offset = 0) {
  const r = engine.search(side, query);
  const shift = (s) => s.replace(/\[(\d+)\]/g, (_, n) => `[${Number(n) + offset}]`);
  return {
    side, query, understood: r.understood,
    sources: r.sources.map((s) => ({ ...s, n: s.n + offset })),
    matches: r.matches.map((m) => ({ ...m, cite: shift(m.cite) })),
    answer: shift(r.answer),
  };
}

// ---------- the brief: what the person has asked for so far ----------

const COUNTRY_WORDS = Object.values(COUNTRIES).flat();
function stripConstraints(text) {
  let s = ` ${text} `;
  for (const k of COUNTRY_WORDS) s = s.replace(new RegExp(`\\b(only\\s+)?((made|based)\\s+)?(in|from)?\\s*${k}\\b`, 'gi'), ' ');
  for (const [, re] of CERTS) s = s.replace(new RegExp(re.source, 'gi'), ' ');
  s = s.replace(/\b(certified|certification|only|or)\b/gi, ' ')
    .replace(/(?:moq|minimum order|min\.? order)[^0-9]{0,25}\d[\d,]*(\s*(units|pieces|pcs))?/gi, ' ')
    .replace(/(?:under|below|less than|fewer than|max(?:imum)?|up to|<)\s*\d[\d,]*\s*(?:units|pieces|pcs|moq)/gi, ' ')
    .replace(/(?:lead time\s*)?(?:within|under|less than|in|below|max(?:imum)?)\s*\d+\s*(?:day|days|week|weeks)/gi, ' ')
    .replace(/\b(small|low) (moq|batch|minimum|run)s?\b/gi, ' ')
    .replace(/(?:about|around|roughly|approx\.?|~)?\s*\d[\d,]*\s*(?:units|pieces|pcs)\b/gi, ' ');
  return s.replace(/[,.;]+(\s*[,.;]+)+/g, ',').replace(/\s+/g, ' ').replace(/^[\s,.;]+|[\s,.;]+$/g, '').trim();
}
function constraintsOf(text) {
  const c = parseConstraints(text);
  const q = text.toLowerCase().match(/(?:about|around|roughly|approx\.?|~)?\s*(\d[\d,]*)\s*(?:units|pieces|pcs)\b/);
  const quantity = q ? parseInt(q[1].replace(/,/g, ''), 10) : null;
  // A run of N units needs a manufacturer whose minimum order is N or less.
  return { countries: c.countries, certifications: c.certifications, maxMoq: c.maxMoq || quantity, maxLeadDays: c.maxLeadDays, quantity };
}

// Is this about clothing at all? Checked against the words in every profile, with room for typos.
function onTopic(text) {
  const vocab = new Set();
  for (const m of store.getManufacturers()) for (const t of tokenize(`${m.makes} ${m.materials.join(' ')} ${m.processes.join(' ')}`)) vocab.add(t);
  for (const b of store.getBrands()) for (const t of tokenize(`${b.sells} ${b.needs.map((n) => `${n.title} ${n.materials.join(' ')}`).join(' ')}`)) vocab.add(t);
  for (const w of ['cloth', 'clothing', 'garment', 'apparel', 'fabric', 'textil', 'fashion', 'wear', 'shirt', 'dress', 'yarn', 'fibr', 'knit', 'weav', 'sustain', 'organ', 'recycl', 'factori', 'manufactur', 'mill', 'supplier', 'brand']) vocab.add(w);
  const toks = [...tokenize(text), ...(expandQuery(text).expansions || []).flatMap((e) => tokenize(e))].filter((t) => !t.includes('_'));
  if (toks.some((t) => vocab.has(t) || [...vocab].some((v) => v.length >= 4 && (t.startsWith(v) || v.startsWith(t) && t.length >= 4)))) return true;
  return toks.some((t) => t.length >= 5 && [...vocab].some((v) => !v.includes('_') && v.slice(0, 3) === t.slice(0, 3) && Math.abs(v.length - t.length) <= 2 && [...t].filter((ch, i) => v[i] === ch).length >= t.length - 3));
}
function briefQuery(b) {
  const parts = [b.topic];
  if (b.countries.length) parts.push(`in ${b.countries.join(' or ')}`);
  if (b.certifications.length) parts.push(`${b.certifications.join(' and ')} certified`);
  if (b.maxMoq) parts.push(`minimum order under ${b.maxMoq} units`);
  if (b.maxLeadDays) parts.push(`within ${b.maxLeadDays} days`);
  return parts.filter(Boolean).join(', ');
}

// ---------- the built-in assistant ----------

const GLOSSARY = [
  [/\bgots\b/, 'GOTS', 'the Global Organic Textile Standard. It certifies organic fibre through the whole chain, from spinning to the finished garment, and sets environmental and social rules for every step. A product labelled organic must hold at least 95% certified organic fibre.'],
  [/oeko[- ]?tex/, 'OEKO-TEX Standard 100', 'a test of the finished textile for harmful substances. Every component, down to threads and buttons, is checked against a list of restricted chemicals.'],
  [/\bgrs\b|global recycled/, 'GRS', 'the Global Recycled Standard. It verifies recycled content and tracks it through the supply chain, with social, environmental and chemical requirements on top.'],
  [/\brcs\b/, 'RCS', 'the Recycled Claim Standard. It verifies recycled content through the supply chain, without the extra social and chemical rules GRS adds.'],
  [/fair ?trade|wfto/, 'Fair Trade', 'a family of schemes (Fairtrade International, WFTO, Fair Trade USA) that check fair pay and decent working conditions for the people who grow the fibre and make the garment.'],
  [/bluesign/, 'bluesign', 'a system for chemical management in textile production: which chemicals go in, how they are handled, and what leaves the factory.'],
  [/\bmoq\b|minimum order/, 'MOQ', 'the minimum order quantity: the smallest run a manufacturer will take on, usually per style or colour. Small brands look for a low MOQ.'],
  [/lead time/, 'Lead time', 'the time from a confirmed order to finished goods leaving the factory. On Meridian Loop it is given in days.'],
];

const ROLE_BRAND = /\b(i'?m|i am|we'?re|we are) (a |an )?(clothing |fashion |apparel )?(brand|label|designer|startup|buyer)\b|brand looking for|find (a |me a )?(manufacturer|factory|supplier|maker)/;
const ROLE_MAKER = /\b(i'?m|i am|we'?re|we are) (a |an )?(manufacturer|factory|mill|supplier|maker|workshop|weaver|tailoring unit)\b|manufacturer looking for|find (me )?(brands|buyers|clients)|\bwe (make|produce|manufacture|supply|weave|knit|dye|sew|print)\b|\bour (factory|mill|unit|workshop)\b/;
const VAGUE = /^(hi|hello|hey|yes|ok|okay|sure|please|i need|i want|i'?m looking for|looking for|find|help|can you help|show me)?\s*(me\s+)?(a |an |some )?(good |sustainable |ethical |eco )?(manufacturers?|factory|factories|suppliers?|makers?|brands?|buyers?|clients?|partners?|something)?\s*(please)?[.!?]*$/;
const ORDINALS = { first: 0, '1st': 0, '#1': 0, top: 0, second: 1, '2nd': 1, '#2': 1, third: 2, '3rd': 2, '#3': 2, fourth: 3, '#4': 3 };

function companiesIn(text) {
  const s = text.toLowerCase();
  const all = [...store.getManufacturers().map((m) => ({ id: m.id, name: m.name })), ...store.getBrands().map((b) => ({ id: b.id, name: b.name }))];
  const GENERIC = new Set(['the', 'little', 'salt', 'west', 'remake', 'indigo', 'da', 'ha', 'mekong']);
  const hits = [];
  for (const c of all) {
    const full = c.name.toLowerCase();
    const first = full.split(' ')[0];
    const firstTwo = full.split(' ').slice(0, 2).join(' ');
    const at = [s.indexOf(full), !GENERIC.has(first) && first.length >= 4 ? s.search(new RegExp(`\\b${first}\\b`)) : -1, s.indexOf(firstTwo)].filter((i) => i >= 0);
    if (at.length) hits.push({ id: c.id, at: Math.min(...at) });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.id);
}
function ordinalPick(text, ids) {
  for (const [w, i] of Object.entries(ORDINALS)) if (new RegExp(`(^|\\s)${w.replace('#', '\\#')}(\\s|$|\\b)`).test(text) && ids[i]) return ids[i];
  return null;
}

function refineChoices(side, brief, matches) {
  const out = [];
  if (side === 'brand') {
    const top = matches[0];
    if (top) out.push(`Tell me more about ${top.name}`);
    if (matches.length >= 2) out.push(`Compare the top ${Math.min(3, matches.length)}`);
    if (!brief.maxMoq) {
      const moqs = matches.map((m) => m.moq).sort((a, b) => a - b);
      if (moqs.length > 1 && moqs[0] < moqs[moqs.length - 1]) out.push(`Minimum order under ${moqs[0] <= 300 ? 300 : 500} units`);
    }
    if (!brief.certifications.length) {
      const counts = {};
      for (const m of matches) for (const k of new Set(m.certifications.flatMap((c) => parseConstraints(c).certifications))) counts[k] = (counts[k] || 0) + 1;
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] < matches.length) out.push(`Only ${best[0]} certified`);
    }
    if (!brief.countries.length) {
      const countries = [...new Set(matches.map((m) => m.place.split(', ').pop()))];
      if (countries.length > 1) out.push(`Only in ${countries[0]}`);
    } else out.push('Any country');
    if (!brief.maxLeadDays && out.length < 5) out.push('Lead time within 45 days');
  } else {
    if (matches[0]) out.push(`Tell me more about ${matches[0].name}`);
    if (matches[0]) out.push(`How do I contact ${matches[0].name}?`);
    if (matches[1]) out.push(`Tell me more about ${matches[1].name}`);
  }
  out.push('Start a new search');
  return out.slice(0, 5);
}

function profileText(e) {
  // The card below carries the facts; the reply carries what the card does not.
  if (e.type === 'maker') {
    const soon = e.certifications.filter((c) => c.validUntil && new Date(c.validUntil) - Date.now() < 1000 * 60 * 60 * 24 * 120);
    return `**${e.name}** has been making clothing in ${e.place} since ${e.founded}. ${e.about}${soon.length ? `\n\nWorth checking: their ${listJoin(soon.map((c) => c.name))} certificate${soon.length > 1 ? 's run' : ' runs'} out in ${fmtDate(soon[0].validUntil)}, so ask for the renewal.` : ''}`;
  }
  return `**${e.name}** is a clothing brand in ${e.place}. ${e.about}`;
}

// The built-in lead: who fits, and the one comparison worth making. The sheet carries the rest.
function leadForMakers(matches) {
  const fits = matches.filter((m) => m.meetsAll);
  const lead = (fits.length ? fits : matches).slice(0, 3);
  const names = listJoin(lead.map((m) => `**${m.name}** ${m.cite}`.trim()));
  const lines = [];
  if (fits.length) lines.push(`${fits.length === 1 ? 'One manufacturer fits' : `${fits.length} manufacturers fit`} your brief${fits.length > 3 ? '. The strongest are' : ':'} ${names}.`);
  else {
    const top = matches[0];
    const miss = top.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    lines.push(`Nobody meets everything you asked for. The closest is **${top.name}** ${top.cite}, which misses ${listJoin(miss)}.`);
  }
  if (lead.length > 1) {
    const small = [...lead].sort((a, b) => a.moq - b.moq)[0];
    const fast = [...lead].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
    lines.push(small.id === fast.id
      ? `${small.name} takes the smallest runs (${small.moq.toLocaleString()} units) and is also the quickest, at ${small.leadTimeDays} days.`
      : `${small.name} takes the smallest runs (${small.moq.toLocaleString()} units); ${fast.name} is the quickest, at ${fast.leadTimeDays} days.`);
  }
  return lines.join(' ');
}
function leadForBrands(matches) {
  const top = matches.slice(0, 3);
  return `${matches.length === 1 ? 'One brand is' : `${matches.length} brands are`} asking for something close to what you make. ${top.map((b) => `**${b.name}** wants ${lowerFirst(b.need.title)} (${b.need.quantity.toLocaleString()} units) ${b.cite}`.trim()).join('; ')}.`;
}

function compareText(rows) {
  const lowMoq = [...rows].sort((a, b) => a.moq - b.moq)[0];
  const fast = [...rows].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
  const certs = [...rows].sort((a, b) => b.certifications.length - a.certifications.length)[0];
  const lines = [`Here are ${listJoin(rows.map((r) => `**${r.name}**`))} side by side.`];
  lines.push(`${lowMoq.name} takes the smallest orders (from ${lowMoq.moq.toLocaleString()} units). ${fast.id === lowMoq.id ? 'It is also the quickest' : `${fast.name} is the quickest`}, at ${fast.leadTimeDays} days.${certs.certifications.length ? ` ${certs.name} holds the most certifications (${certs.certifications.length}).` : ''}`);
  return lines.join('\n\n');
}

const greet = (stats) => ({
  text: `Hello. I match sustainable clothing brands with manufacturers across Asia, using the ${stats.makers} manufacturers and ${stats.brands} brands listed on Meridian Loop.\n\nWhich side are you on?`,
  choices: ['I\'m a brand looking for a manufacturer', 'I\'m a manufacturer looking for brands', 'Explain how matching works'],
});

export function builtinTurn(text, prev) {
  const state = { side: null, brief: null, shown: [], focus: null, ...prev };
  text = text.replace(/[’‘]/g, "'");
  const s = text.toLowerCase().trim();
  const events = [];
  const say = (t) => events.push({ type: 'text', text: t });
  const choices = (c) => events.push({ type: 'choices', options: c });
  const stats = engine.stats();

  // Start over, or nothing said yet.
  if (!s || /^(start (a )?new search|start over|new search|reset|clear)\b/.test(s)) {
    const g = greet(stats); say(g.text); choices(g.choices);
    return { events, state: { side: null, brief: null, shown: [], focus: null } };
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b[!. ]*$/.test(s) || /what can you do|who are you/.test(s)) {
    const g = greet(stats); say(g.text); choices(g.choices);
    return { events, state };
  }
  if (/how (does )?(matching|it|this) work|explain how/.test(s)) {
    say(`Tell me what you need in plain words. I read out the garment, materials, quantity, country and certifications, then search every manufacturer profile and every open brand request on Meridian Loop.\n\nEach result shows which of your requirements it meets, and every claim points to the profile line it came from. Ask follow-ups to narrow the list, compare manufacturers, or get a contact.`);
    choices(['I\'m a brand looking for a manufacturer', 'I\'m a manufacturer looking for brands']);
    return { events, state };
  }

  // Definitions.
  const term = /^(what('?s| is| are| does)|explain|define|meaning of)\b/.test(s) && GLOSSARY.find(([re]) => re.test(s));
  if (term) {
    say(`**${term[1]}** is ${term[2]}`);
    choices(state.brief ? [`Only ${term[1].split(' ')[0]} certified`, 'Start a new search'] : ['I\'m a brand looking for a manufacturer', 'I\'m a manufacturer looking for brands']);
    return { events, state };
  }

  // Role, with or without a request attached.
  const isBrand = ROLE_BRAND.test(s), isMaker = !isBrand && ROLE_MAKER.test(s);
  if (isBrand) state.side = 'brand';
  if (isMaker) state.side = 'maker';
  const roleOnly = (isBrand || isMaker) && stripConstraints(s.replace(ROLE_BRAND, '').replace(ROLE_MAKER, '')).replace(/\b(looking for|find|a|an|and|to|work with|new|some|manufacturers?|factory|factories|suppliers?|makers?|brands?|buyers?|clients?)\b/g, '').replace(/[^a-z]/g, '').length < 4;
  if (roleOnly) {
    state.brief = null; state.shown = [];
    if (state.side === 'brand') {
      say('Good. Tell me what you want made: the garment and the material, roughly how many units, and any country or certification you need.');
      choices(['Organic cotton T-shirts, about 500 units', 'GOTS loungewear, small MOQ, India or Cambodia', 'Low-water denim in Bangladesh', 'Biodegradable fabric']);
    } else {
      say('Good. Tell me what you make and which materials you work with, and I’ll find brands that are looking for it.');
      choices(['We make organic cotton babywear', 'Waste cotton yarn and fabric', 'Peace silk scarves in Vietnam', 'Recycled polyester, small runs']);
    }
    return { events, state };
  }

  // A company by name or by position in the last list.
  const named = companiesIn(s);
  const picked = named[0] || ordinalPick(s, state.shown) || (/\b(them|they|their|it|this one|that one)\b/.test(s) ? state.focus : null);

  if (/\bcompare\b|side by side|difference between|versus|\bvs\.?\b/.test(s)) {
    let ids = named.filter((id) => store.getManufacturer(id));
    if (ids.length === 1 && state.focus && state.focus !== ids[0] && store.getManufacturer(state.focus)) ids = [state.focus, ids[0]];
    if (ids.length < 2) ids = state.shown.filter((id) => store.getManufacturer(id)).slice(0, Number((s.match(/top (\d)/) || [])[1]) || 3);
    const rows = compareRows(ids);
    if (rows.length >= 2) {
      say(compareText(rows));
      events.push({ type: 'compare', rows });
      choices([...rows.slice(0, 2).map((r) => `How do I contact ${r.name}?`), 'Start a new search']);
      return { events, state: { ...state, focus: rows[0].id } };
    }
    say('I can compare manufacturers once we have a few on the table. Tell me what you want made first.');
    return { events, state };
  }

  if (picked && /contact|email|reach|get in touch|talk to|speak to|introduc/.test(s)) {
    const e = findEntity(picked);
    say(`You can reach **${e.name}** through ${e.contact} at ${e.email}. Open the card below to write to them; I’ve filled in the subject line.`);
    events.push({ type: 'profile', entity: e });
    choices(state.side === 'maker' ? ['Show the other brands', 'Start a new search'] : ['Compare the top 3', 'Start a new search']);
    return { events, state: { ...state, focus: e.id } };
  }

  if (picked && (/tell me (more )?about|more about|details|who is|who are|what (do|does)|profile|^(and )?(the )?(first|second|third)|^#\d/.test(s) || named.length && s.split(/\s+/).length <= 5)) {
    const e = findEntity(picked);
    say(profileText(e));
    events.push({ type: 'profile', entity: e });
    const others = state.shown.filter((id) => id !== e.id && store.getManufacturer(id));
    choices(e.type === 'maker'
      ? [`How do I contact ${e.name}?`, ...(others[0] ? [`Compare with ${findEntity(others[0]).name}`] : []), 'Show the other options', 'Start a new search']
      : [`How do I contact ${e.name}?`, 'Show the other brands', 'Start a new search']);
    return { events, state: { ...state, focus: e.id } };
  }
  if (/^compare with /.test(s) && state.focus) {
    const rows = compareRows([state.focus, ...named]);
    if (rows.length >= 2) { say(compareText(rows)); events.push({ type: 'compare', rows }); choices(['Start a new search']); return { events, state }; }
  }

  // Show the last list again.
  if (/show (me )?(the )?other (options|brands|manufacturers)|back to (the )?(list|results)/.test(s) && state.brief) {
    const r = runSearch(state.side, briefQuery(state.brief));
    say('Here is the list again.');
    events.push({ type: 'results', ...r });
    choices(refineChoices(state.side, state.brief, r.matches));
    return { events, state: { ...state, shown: r.matches.map((m) => m.id) } };
  }

  // Too thin to search.
  if (VAGUE.test(s)) {
    if (!state.side) state.side = /brand|buyer|client/.test(s) ? 'maker' : 'brand';
    say(state.side === 'brand'
      ? 'Happy to. What would you like made? The garment and the material is enough to start; quantity, country and certifications help me narrow it down.'
      : 'Happy to. What do you make, and in which materials? I’ll look for brands asking for it.');
    choices(state.side === 'brand' ? ['Organic cotton T-shirts, about 500 units', 'Recycled polyester activewear', 'Handwoven linen shirts'] : ['We make organic cotton babywear', 'Waste cotton yarn and fabric']);
    return { events, state };
  }

  // A refinement of the brief, or a new request.
  const c = constraintsOf(s);
  if (!onTopic(text) && !(state.brief && (c.countries.length || c.certifications.length || c.maxMoq || c.maxLeadDays || /\bany (country|where)\b|anywhere/.test(s)))) {
    say('I can only help with sourcing sustainable clothing: finding manufacturers for a brand, or brands for a manufacturer. Tell me a garment, a fabric or a material and I’ll search.');
    choices(state.brief ? ['Show the other options', 'Start a new search'] : ['I\'m a brand looking for a manufacturer', 'I\'m a manufacturer looking for brands', 'What is GOTS?']);
    return { events, state };
  }
  const topic = stripConstraints(text.replace(ROLE_BRAND, '').replace(ROLE_MAKER, ''));
  const hasConstraint = c.countries.length || c.certifications.length || c.maxMoq || c.maxLeadDays;
  const anyCountry = /\bany (country|where)\b|anywhere|remove the country/.test(s);
  const refining = state.brief && (anyCountry || /^(only|just|and|also|but|must|needs? to|with|without|under|below|within|in|from|less|fewer|faster|cheaper|smaller|minimum|moq|lead)\b/.test(s) || (hasConstraint && topic.split(' ').filter(Boolean).length <= 2));
  let brief;
  if (refining) {
    brief = { ...state.brief };
    if (anyCountry) brief.countries = [];
    if (c.countries.length) brief.countries = c.countries;
    if (c.certifications.length) brief.certifications = [...new Set([...brief.certifications, ...c.certifications])];
    if (c.maxMoq) brief.maxMoq = c.maxMoq;
    if (c.maxLeadDays) brief.maxLeadDays = c.maxLeadDays;
    if (!hasConstraint && !anyCountry && topic.split(' ').length > 1) brief.topic = `${brief.topic} ${topic}`;
  } else {
    brief = { topic: topic || text, ...c };
    if (!state.side) state.side = ROLE_MAKER.test(s) ? 'maker' : 'brand';
  }
  const side = state.side || 'brand';
  const r = runSearch(side, briefQuery(brief));

  if (!r.matches.length) {
    say(side === 'brand'
      ? `Nobody on Meridian Loop fits ${refining ? 'that narrower brief' : 'that'} yet. I search clothing manufacturers only, so name a garment or material, or loosen a requirement.`
      : 'No brand on Meridian Loop is asking for that yet. Try a material you work with, or a garment you make.');
    choices(refining ? ['Any country', 'Start a new search'] : ['Organic cotton T-shirts', 'Recycled polyester activewear', 'Start a new search']);
    return { events, state: { ...state, side, brief: refining ? state.brief : null } };
  }

  const answer = side === 'brand' ? leadForMakers(r.matches) : leadForBrands(r.matches);
  say(refining ? `Narrowed down. ${answer}` : answer);
  events.push({ type: 'results', ...r });
  const missing = [!brief.maxMoq && 'roughly how many units you need', !brief.certifications.length && 'whether it needs a certification', !brief.countries.length && 'any country you prefer'].filter(Boolean);
  if (side === 'brand' && missing.length >= 2 && !refining) say(`To narrow this down, tell me ${listJoin(missing)}.`);
  else if (side === 'brand' && r.matches[0]) say(`Want the details on ${r.matches[0].name}, or the top few side by side?`);
  else say('Open one for what they need and who to talk to.');
  choices(refineChoices(side, brief, r.matches));
  return { events, state: { ...state, side, brief, shown: r.matches.map((m) => m.id), focus: r.matches[0].id } };
}

// ---------- Claude ----------

const SYSTEM = `You are the sourcing assistant on Meridian Loop, a platform that connects sustainable clothing brands with clothing and textile manufacturers across Asia. Meridian Loop grew out of Sustainable India (2019), which set out to be the bridge between manufacturers and designers.

Who you talk to:
- Brands looking for a manufacturer. Use search_manufacturers.
- Manufacturers looking for brands to supply. Use search_brands.
If you cannot tell which side someone is on, ask, and offer both as replies.

How to work:
- Search before you answer anything about who makes or needs what. Never name a company, number, certification or date that did not come back from a tool.
- If the request is too thin to search usefully (no garment or material), ask one short question first. Once there is a garment or material, search straight away and ask about missing details (quantity, country, certification, lead time) afterwards.
- Keep the person's earlier requirements when they refine ("only in India", "under 500 units"): rewrite the full brief and search again.
- Each search result is shown to the person as a ruled list, so do not repeat every row. Say which two or three fit best and why, and say plainly what a match does not meet.
- Cite the numbered sources inline as [n], using the numbers the tool returned.
- Use get_company when someone asks about one company, and compare_manufacturers when they want options side by side.
- End every reply by calling suggest_replies with two to four short replies the person is likely to want next, written in their voice (for example "Only GOTS certified", "Compare the top 3", "How do I contact Kaveri?").
- Write plainly, at most about 90 words per reply, in short paragraphs. Company names in **bold**. No headings, no bullet lists, no em dashes.
- Only discuss sourcing for sustainable clothing and textiles. Politely steer anything else back.`;

const TOOLS = [
  { name: 'search_manufacturers', description: 'Search manufacturer profiles for a brand. Pass the whole brief in plain words, including garment, materials, quantity, countries, certifications and lead time. Returns ranked manufacturers with which requirements they meet, plus numbered source passages to cite.', strict: true, eager_input_streaming: true, input_schema: { type: 'object', properties: { brief: { type: 'string', description: 'The full brief, e.g. "GOTS organic cotton loungewear, minimum order under 500 units, India or Cambodia"' } }, required: ['brief'], additionalProperties: false } },
  { name: 'search_brands', description: 'Search open brand requests for a manufacturer. Pass what the manufacturer makes and the materials they use. Returns ranked brands with what each is looking for, plus numbered source passages to cite.', strict: true, eager_input_streaming: true, input_schema: { type: 'object', properties: { offer: { type: 'string', description: 'What the manufacturer makes, e.g. "organic cotton babywear and knit basics"' } }, required: ['offer'], additionalProperties: false } },
  { name: 'get_company', description: 'Get one company\'s full profile by id (from a search result): what they make or need, minimums, certifications with issuer and expiry, and the contact person and email.', strict: true, eager_input_streaming: true, input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
  { name: 'compare_manufacturers', description: 'Show two to four manufacturers side by side by id: place, products, minimum order, lead time and certifications.', strict: true, eager_input_streaming: true, input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'], additionalProperties: false } },
  { name: 'suggest_replies', description: 'Show two to four short tappable replies under your message, in the person\'s voice. Call once, at the end of every reply.', strict: true, eager_input_streaming: true, input_schema: { type: 'object', properties: { replies: { type: 'array', items: { type: 'string' } } }, required: ['replies'], additionalProperties: false } },
];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.every(isStr);

let client;
export async function claudeTurn(history, emit) {
  client ||= new Anthropic();
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let cites = 0, wrote = false;
  for (let step = 0; step < 6; step++) {
    const stream = client.beta.messages.stream({
      model: MODEL, max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM, tools: TOOLS, messages,
    });
    stream.on('text', (delta) => { wrote = true; emit({ type: 'text', delta }); });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') { if (!wrote) throw new Error('declined'); return; }
    const uses = msg.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) return;
    if (msg.stop_reason === 'max_tokens') throw new Error('cut off');
    messages.push({ role: 'assistant', content: msg.content });
    const results = [];
    for (const u of uses) {
      const i = u.input || {};
      let out;
      if (u.name === 'search_manufacturers' && isStr(i.brief)) {
        const r = runSearch('brand', i.brief.slice(0, 300), cites); cites += r.sources.length;
        emit({ type: 'results', ...r });
        out = { understood: r.understood, matches: r.matches.map(({ id, name, place, summary, moq, leadTimeDays, certifications, checks, meetsAll, cite }) => ({ id, name, place, makes: summary, moq, leadTimeDays, certifications, meetsAll, missing: checks.filter((c) => !c.ok).map((c) => c.label), cite })), sources: r.sources.map(({ n, title, text }) => ({ n, title, text })) };
      } else if (u.name === 'search_brands' && isStr(i.offer)) {
        const r = runSearch('maker', i.offer.slice(0, 300), cites); cites += r.sources.length;
        emit({ type: 'results', ...r });
        out = { matches: r.matches.map(({ id, name, place, need, cite }) => ({ id, name, place, lookingFor: need, cite })), sources: r.sources.map(({ n, title, text }) => ({ n, title, text })) };
      } else if (u.name === 'get_company' && isStr(i.id)) {
        const e = findEntity(i.id.trim());
        if (e) emit({ type: 'profile', entity: e });
        out = e || { error: `No company with id ${i.id}` };
      } else if (u.name === 'compare_manufacturers' && isStrArr(i.ids)) {
        const rows = compareRows(i.ids);
        if (rows.length >= 2) emit({ type: 'compare', rows });
        out = rows.length >= 2 ? { shown: rows } : { error: 'Need at least two valid manufacturer ids.' };
      } else if (u.name === 'suggest_replies' && isStrArr(i.replies)) {
        emit({ type: 'choices', options: i.replies.slice(0, 4).map((r) => r.slice(0, 60)) });
        out = { shown: true };
      } else {
        results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: JSON.stringify({ INVALID_INPUT: u.input }) });
        continue;
      }
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) });
    }
    messages.push({ role: 'user', content: results });
    if (uses.every((u) => u.name === 'suggest_replies')) return;
  }
}
