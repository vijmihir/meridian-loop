// A WhatsApp channel for manufacturers: see quote requests, quote or decline, update the profile, or join,
// in short commands. Replies come in the manufacturer's first language: English, Hindi, Vietnamese or Bengali.
import * as store from './store.js';

const LANG = { Hindi: 'hi', Vietnamese: 'vi', Bengali: 'bn' };
const T = {
  menu: {
    en: 'Meridian Loop on WhatsApp. Reply with:\nREQUESTS to see quote requests\nQUOTE <code> <price> <minimum> <days> to send a quote\nDECLINE <code> <reason> to say no\nMOQ <number>, LEAD <days> or PRICE <from>-<to> to update your profile\nPROFILE to see what brands see',
    hi: 'WhatsApp पर Meridian Loop। जवाब में लिखें:\nREQUESTS: कोटेशन अनुरोध देखने के लिए\nQUOTE <कोड> <कीमत> <न्यूनतम> <दिन>: कोटेशन भेजने के लिए\nDECLINE <कोड> <कारण>: मना करने के लिए\nMOQ <संख्या>, LEAD <दिन> या PRICE <से>-<तक>: प्रोफ़ाइल बदलने के लिए\nPROFILE: ब्रांड क्या देखते हैं',
    vi: 'Meridian Loop trên WhatsApp. Trả lời bằng:\nREQUESTS: xem yêu cầu báo giá\nQUOTE <mã> <giá> <tối thiểu> <ngày>: gửi báo giá\nDECLINE <mã> <lý do>: từ chối\nMOQ <số>, LEAD <ngày> hoặc PRICE <từ>-<đến>: cập nhật hồ sơ\nPROFILE: xem hồ sơ của bạn',
    bn: 'WhatsApp-এ Meridian Loop। উত্তরে লিখুন:\nREQUESTS: কোটেশনের অনুরোধ দেখতে\nQUOTE <কোড> <দাম> <সর্বনিম্ন> <দিন>: কোটেশন পাঠাতে\nDECLINE <কোড> <কারণ>: না বলতে\nMOQ <সংখ্যা>, LEAD <দিন> বা PRICE <থেকে>-<পর্যন্ত>: প্রোফাইল বদলাতে\nPROFILE: ব্র্যান্ডরা কী দেখে',
  },
  none: { en: 'You have no open quote requests.', hi: 'आपके पास कोई खुला कोटेशन अनुरोध नहीं है।', vi: 'Bạn không có yêu cầu báo giá nào đang mở.', bn: 'আপনার কোনো খোলা কোটেশনের অনুরোধ নেই।' },
  list: { en: 'Open quote requests:', hi: 'खुले कोटेशन अनुरोध:', vi: 'Yêu cầu báo giá đang mở:', bn: 'খোলা কোটেশনের অনুরোধ:' },
  quoted: { en: 'Quote sent to {brand}: US${price} a piece, {moq} minimum, {days} days.', hi: '{brand} को कोटेशन भेजा गया: US${price} प्रति पीस, न्यूनतम {moq}, {days} दिन।', vi: 'Đã gửi báo giá cho {brand}: US${price} một chiếc, tối thiểu {moq}, {days} ngày.', bn: '{brand}-কে কোটেশন পাঠানো হয়েছে: প্রতি পিস US${price}, সর্বনিম্ন {moq}, {days} দিন।' },
  declined: { en: 'You declined the request from {brand}.', hi: 'आपने {brand} का अनुरोध मना कर दिया।', vi: 'Bạn đã từ chối yêu cầu của {brand}.', bn: 'আপনি {brand}-এর অনুরোধ ফিরিয়ে দিয়েছেন।' },
  updated: { en: 'Profile updated: {what}.', hi: 'प्रोफ़ाइल अपडेट हुई: {what}।', vi: 'Đã cập nhật hồ sơ: {what}.', bn: 'প্রোফাইল আপডেট হয়েছে: {what}।' },
  nocode: { en: 'No open request has the code {code}. Reply REQUESTS to see them.', hi: '{code} कोड वाला कोई खुला अनुरोध नहीं है। देखने के लिए REQUESTS लिखें।', vi: 'Không có yêu cầu nào đang mở với mã {code}. Trả lời REQUESTS để xem.', bn: '{code} কোডের কোনো খোলা অনুরোধ নেই। দেখতে REQUESTS লিখুন।' },
  unclear: { en: 'I did not understand that. Reply HELP for the commands.', hi: 'यह समझ नहीं आया। आदेश देखने के लिए HELP लिखें।', vi: 'Tôi chưa hiểu tin nhắn này. Trả lời HELP để xem các lệnh.', bn: 'এটা বুঝতে পারিনি। নির্দেশগুলো দেখতে HELP লিখুন।' },
  profile: { en: '{name}: {makes}. Minimum {moq}, {days} days, US${from} to {to} a {unit}.', hi: '{name}: {makes}। न्यूनतम {moq}, {days} दिन, US${from} से {to} प्रति {unit}।', vi: '{name}: {makes}. Tối thiểu {moq}, {days} ngày, US${from} đến {to} một {unit}.', bn: '{name}: {makes}। সর্বনিম্ন {moq}, {days} দিন, প্রতি {unit} US${from} থেকে {to}।' },
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const say = (lang, key, v = {}) => fill(T[key][lang] || T[key].en, v);

const KEY = {
  help: /^(help|hi|hello|menu|मदद|नमस्ते|giúp|xin chào|সাহায্য|হ্যালো)(?=\s|$|[.!?])/i,
  requests: /^(requests?|rfqs?|अनुरोध|yêu cầu|অনুরোধ)(?=\s|$|[.!?])/i,
  profile: /^(profile|प्रोफ़ाइल|प्रोफाइल|hồ sơ|প্রোফাইল)(?=\s|$|[.!?])/i,
};
const codeOf = (id) => id.slice(-4);

export function waReply(from, text, { simulatedReply, alertForNewMaker }) {
  const m = store.getManufacturer(from);
  const t = text.trim();

  if (!m) {
    // a number Meridian Loop does not know yet: offer to list the factory
    const j = /^join\s+(.+)$/i.exec(t);
    if (j) {
      const [name, place, makes, materials, moq] = j[1].split('|').map((x) => x.trim());
      const [city, country] = (place || '').split(',').map((x) => x.trim());
      if (!name || !city || !country || !makes || !materials || !(Number(moq) > 0)) return { reply: 'To list your factory, reply: JOIN name | city, country | what you make | materials | minimum order', lang: 'en' };
      if (store.getManufacturers().some((x) => x.name.toLowerCase() === name.toLowerCase())) return { reply: `${name} is already on Meridian Loop.`, lang: 'en' };
      const rec = store.addManufacturer({ name, city, country, makes, materials: materials.split(',').map((x) => x.trim()).filter(Boolean), processes: [], certifications: [], moq: Math.round(Number(moq)), leadTimeDays: 45, about: `${name} joined Meridian Loop on WhatsApp.`, contact: 'WhatsApp contact', email: '', whatsapp: true, founded: new Date().getFullYear() });
      alertForNewMaker(rec);
      return { reply: `${rec.name} is listed. Brands can find you now. Reply HELP for the commands.`, lang: 'en', joined: rec.id };
    }
    return { reply: 'Welcome to Meridian Loop. To list your factory, reply: JOIN name | city, country | what you make | materials | minimum order', lang: 'en' };
  }

  const lang = LANG[(m.languages || [])[0]] || 'en';
  const open = store.rfqs().filter((r) => r.status === 'open' && r.makerIds.includes(m.id));
  const byCode = (code) => open.find((r) => codeOf(r.id) === code || r.id === code);

  if (KEY.help.test(t)) return { reply: say(lang, 'menu'), lang };
  if (KEY.requests.test(t)) {
    if (!open.length) return { reply: say(lang, 'none'), lang };
    const rows = open.map((r) => {
      const q = store.quotesFor(r.id).find((x) => x.makerId === m.id);
      return `${codeOf(r.id)}: ${store.getBrand(r.brandId)?.name}, ${r.title}, ${r.quantity.toLocaleString()} (${q?.status === 'quoted' ? `US$${q.unitPrice}` : q?.status || 'requested'})`;
    });
    return { reply: `${say(lang, 'list')}\n${rows.join('\n')}`, lang };
  }
  if (KEY.profile.test(t)) {
    const p = m.priceRange || { from: '?', to: '?', unit: 'piece' };
    return { reply: say(lang, 'profile', { name: m.name, makes: m.makes, moq: m.moq.toLocaleString(), days: m.leadTimeDays, from: p.from, to: p.to, unit: p.unit }), lang };
  }
  let x = /^quote\s+(\w+)\s+\$?([\d.]+)\s+([\d,]+)\s+(\d+)/i.exec(t);
  if (x) {
    const r = byCode(x[1]);
    if (!r) return { reply: say(lang, 'nocode', { code: x[1] }), lang };
    const q = { status: 'quoted', unitPrice: Math.round(Number(x[2]) * 100) / 100, moq: Number(x[3].replace(/,/g, '')), leadTimeDays: Number(x[4]), sampleCost: m.sampleCost, sampleDays: m.sampleDays, incoterm: (m.incoterms || ['FOB'])[0], note: 'Sent on WhatsApp.', via: 'whatsapp' };
    store.upsertQuote({ id: `${r.id}:${m.id}`, rfqId: r.id, makerId: m.id, at: new Date().toISOString(), ...q });
    store.notify(r.brandId, 'quote', `${m.name} sent a quote`, `US$${q.unitPrice} a piece, ${q.moq.toLocaleString()} minimum, ${q.leadTimeDays} days.`, `#/quotes/${r.id}`);
    store.track('quote_received', { who: m.id, rfq: r.id, via: 'whatsapp' });
    return { reply: say(lang, 'quoted', { brand: store.getBrand(r.brandId)?.name, price: q.unitPrice, moq: q.moq.toLocaleString(), days: q.leadTimeDays }), lang };
  }
  x = /^decline\s+(\w+)\s*(.*)$/i.exec(t);
  if (x) {
    const r = byCode(x[1]);
    if (!r) return { reply: say(lang, 'nocode', { code: x[1] }), lang };
    store.upsertQuote({ id: `${r.id}:${m.id}`, rfqId: r.id, makerId: m.id, at: new Date().toISOString(), status: 'declined', note: x[2] || '', via: 'whatsapp' });
    store.notify(r.brandId, 'quote', `${m.name} declined`, x[2] || 'No reason given.', `#/quotes/${r.id}`);
    return { reply: say(lang, 'declined', { brand: store.getBrand(r.brandId)?.name }), lang };
  }
  x = /^(moq|lead|price)\s+([\d.,]+)(?:\s*-\s*([\d.]+))?/i.exec(t);
  if (x) {
    const k = x[1].toLowerCase(), a = Number(x[2].replace(/,/g, '')), b = Number(x[3]);
    let patch, what;
    if (k === 'moq' && a > 0) { patch = { moq: Math.round(a) }; what = `MOQ ${Math.round(a).toLocaleString()}`; }
    if (k === 'lead' && a > 0 && a < 366) { patch = { leadTimeDays: Math.round(a) }; what = `${Math.round(a)} days`; }
    if (k === 'price' && a > 0 && b >= a) { patch = { priceRange: { ...(m.priceRange || { currency: 'US$', unit: 'piece' }), from: a, to: b } }; what = `US$${a} to ${b}`; }
    if (!patch) return { reply: say(lang, 'unclear'), lang };
    store.editCompany(m.id, patch);
    return { reply: say(lang, 'updated', { what }), lang };
  }
  return { reply: say(lang, 'unclear'), lang };
}
