// Dummy companies that cover the edge cases a demo should show, plus seeded activity: quote requests in every
// state, replies, notifications, saved searches, and demo pilot figures. Everything here is fictional.

const cert = (name, issuer, validUntil, check) => ({ name, issuer, validUntil, ...(check ? { check } : {}) });
const checked = (register, on = '2026-10-14') => ({ status: 'checked', on, register });
const maker = (o) => ({ processes: [], certifications: [], email: `${o.contact.split(' ')[0].toLowerCase()}@${o.id}.example`, ...o });
const brand = (o) => ({ values: [], email: `${o.contact.split(' ')[0].toLowerCase()}@${o.id}.example`, ...o,
  needs: o.needs.map(([title, detail, materials, quantity, target, certifications = [], countries = [], extra = {}]) => ({ title, detail, materials, quantity, target, certifications, countries, ...extra })) });

export const scenarioManufacturers = [
  maker({ id: 'tirupur-quickstitch', name: 'Tirupur QuickStitch', country: 'India', city: 'Tirupur', founded: 2012,
    makes: 'Fast-turnaround T-shirts, polos and sweatshirts', materials: ['organic cotton', 'cotton jersey', 'fleece'], processes: ['knitting', 'cut and sew', 'screen printing'],
    certifications: [cert('GOTS', 'Control Union', '2026-08-31', checked('Control Union public register', '2025-09-02'))], moq: 1000, leadTimeDays: 18,
    about: 'Built for rush drops: cut, sewn and packed in 18 days. Its GOTS certificate lapsed in August and the renewal audit is booked.', contact: 'Vimal Raj' }),
  maker({ id: 'hanoi-small-batch', name: 'Hanoi Small Batch Atelier', country: 'Vietnam', city: 'Hanoi', founded: 2019,
    makes: 'Linen dresses, shirts and trousers in micro runs', materials: ['linen', 'organic cotton', 'deadstock fabric'], processes: ['pattern making', 'cut and sew'],
    certifications: [], moq: 20, leadTimeDays: 24, languages: ['Vietnamese'], whatsapp: true,
    about: 'A six-person atelier that sews 20 pieces a style for new labels, often from deadstock rolls. Replies on WhatsApp in Vietnamese.', contact: 'Ngoc Anh Vu' }),
  maker({ id: 'dhaka-mega-knit', name: 'Dhaka Mega Knit Composite', country: 'Bangladesh', city: 'Gazipur', founded: 1996,
    makes: 'T-shirts, polos and hoodies at very large volume', materials: ['organic cotton', 'recycled cotton', 'recycled polyester'], processes: ['spinning', 'knitting', 'dyeing', 'cut and sew'],
    certifications: [cert('GOTS', 'Control Union', '2027-12-31'), cert('amfori BSCI', 'amfori', '2027-06-30'), cert('Higg FEM', 'Cascale', '2027-03-31')],
    moq: 5000, leadTimeDays: 55, priceRange: { from: 2.1, to: 3.4, currency: 'US$', unit: 'piece' }, capacityPerMonth: 400000,
    about: 'One of the largest knit composites in Gazipur, spinning to packing under one roof. Best for runs of five thousand and up.', contact: 'Shahidul Karim' }),
  maker({ id: 'jaipur-zari-studio', name: 'Jaipur Zari & Embroidery Studio', country: 'India', city: 'Jaipur', founded: 2008,
    makes: 'Hand embroidery, beadwork and embellished dresses', materials: ['organic cotton', 'silk', 'recycled zari'], processes: ['hand embroidery', 'beadwork', 'cut and sew'],
    certifications: [cert('GOTS', 'Ecocert', '2027-05-31', { status: 'not-found', on: '2026-10-21', register: 'GOTS public database' })], moq: 80, leadTimeDays: 60, languages: ['Hindi'], whatsapp: true,
    about: 'Forty embroiderers working by hand. The GOTS licence number it gave could not be found in the public database; ask for the scope certificate.', contact: 'Imran Qureshi' }),
  maker({ id: 'colombo-tech-knit', name: 'Colombo 3D Knit Lab', country: 'Sri Lanka', city: 'Colombo', founded: 2017,
    makes: 'Seamless 3D-knit tops, base layers and activewear', materials: ['recycled nylon', 'merino', 'TENCEL lyocell'], processes: ['3D knitting', 'bonding'],
    certifications: [cert('bluesign', 'bluesign technologies', '2027-09-30'), cert('OEKO-TEX Standard 100', 'TESTEX', '2027-09-30')], moq: 300, leadTimeDays: 75,
    priceRange: { from: 16, to: 32, currency: 'US$', unit: 'piece' },
    about: 'Knits whole garments with no cutting waste. Slow to start because every style is programmed and tested first.', contact: 'Ruwan Jayasuriya' }),
  maker({ id: 'surat-recycled-poly', name: 'Surat Recycled Poly Mills', country: 'India', city: 'Surat', founded: 2002,
    makes: 'Recycled polyester fabric by the metre for activewear and linings', materials: ['recycled polyester', 'recycled nylon'], processes: ['bottle-to-yarn recycling', 'weaving', 'knitting'],
    certifications: [cert('GRS', 'Control Union', '2027-08-31'), cert('OEKO-TEX Standard 100', 'Hohenstein', '2027-02-28')], moq: 3000, leadTimeDays: 30,
    about: 'Turns collected PET bottles into yarn and fabric. Sells by the metre; minimum 3,000 metres a colour.', contact: 'Hetal Desai' }),
  maker({ id: 'saigon-little-ones', name: 'Saigon Little Ones', country: 'Vietnam', city: 'Ho Chi Minh City', founded: 2014,
    makes: 'Kidswear, babywear and school uniforms', materials: ['organic cotton', 'bamboo viscose'], processes: ['knitting', 'cut and sew', 'printing'],
    certifications: [cert('OEKO-TEX Standard 100', 'Hohenstein', '2027-04-30'), cert('GOTS', 'Control Union', '2027-04-30')], moq: 500, leadTimeDays: 40, languages: ['Vietnamese', 'English'],
    about: 'Soft, tested kidswear with nickel-free snaps and no loose trims, sized from newborn to 12 years.', contact: 'Thanh Le' }),
  maker({ id: 'lahore-vegan-leather', name: 'Lahore Plant Leather Works', country: 'Pakistan', city: 'Lahore', founded: 2018,
    makes: 'Jackets, bags and trims in plant-based leather', materials: ['cactus leather', 'apple leather', 'recycled polyester lining'], processes: ['cutting', 'stitching', 'edge painting'],
    certifications: [cert('PETA', 'PETA', '2027-01-15'), cert('GRS', 'Intertek', '2027-06-30')], moq: 150, leadTimeDays: 50,
    about: 'Moved from animal leather to cactus and apple leather in 2018. Jackets are lined in recycled polyester.', contact: 'Sana Butt' }),
];

export const scenarioBrands = [
  brand({ id: 'tiny-batch-studio', name: 'Tiny Batch Studio', country: 'Hong Kong', city: 'Hong Kong', founded: 2025, sells: 'Linen womenswear in drops of 50',
    about: 'A one-person label in Sheung Wan selling each style once, in 50 pieces.', values: ['small batches', 'natural fibres'],
    needs: [['Linen wrap dresses', '50 pieces, two colours, garment washed.', ['linen'], 50, 'US$24 to 30']], contact: 'Cheryl Wong' }),
  brand({ id: 'rapid-drop-co', name: 'Rapid Drop Co.', country: 'Singapore', city: 'Singapore', founded: 2023, sells: 'Event and launch merchandise',
    about: 'Makes tees for launches and festivals, usually with three weeks’ notice.', values: ['speed', 'organic'],
    needs: [['Organic tees in 25 days', '2,000 printed tees, delivered within 25 days of approval.', ['organic cotton'], 2000, 'US$4 to 6', ['GOTS'], [], { maxLeadDays: 25 }]], contact: 'Marcus Lim' }),
  brand({ id: 'budget-basics', name: 'Budget Basics', country: 'Australia', city: 'Brisbane', founded: 2021, sells: 'Low-price organic basics',
    about: 'Sells three-packs of organic tees at supermarket prices, so the price per piece decides everything.', values: ['price', 'organic'],
    needs: [['Organic tees at US$2.50', '10,000 crew tees at US$2.50 a piece or less.', ['organic cotton'], 10000, 'US$2 to 2.50', ['GOTS'], [], { maxPrice: 2.5 }]], contact: 'Ella Brooks' }),
  brand({ id: 'passport-ready', name: 'Passport Ready Denim', country: 'France', city: 'Paris', founded: 2022, sells: 'Traceable denim for the EU market',
    about: 'Needs every stage documented for the EU digital product passport before it places an order.', values: ['traceability', 'compliance'],
    needs: [['Traceable organic jeans', '1,500 pairs with every stage documented, fibre to sewing.', ['organic cotton', 'natural indigo'], 1500, 'US$12 to 16', ['GOTS'], [], { needsDpp: true }]], contact: 'Camille Martin' }),
  brand({ id: 'vegan-moto', name: 'Vegan Moto', country: 'Germany', city: 'Hamburg', founded: 2020, sells: 'Animal-free motorcycle-style jackets',
    about: 'Jackets that look like leather and are not.', values: ['vegan', 'durability'],
    needs: [['Plant leather jackets', '300 jackets in cactus or apple leather, lined.', ['cactus leather', 'apple leather'], 300, 'US$55 to 70', ['PETA']]], contact: 'Jonas Weber' }),
  brand({ id: 'kids-cotton-club', name: 'Kids Cotton Club', country: 'South Korea', city: 'Busan', founded: 2021, sells: 'Tested kidswear',
    about: 'Kidswear tested for harmful substances, sold through Korean department stores.', values: ['safety', 'organic'],
    needs: [['OEKO-TEX kidswear sets', '800 two-piece sets, nickel-free snaps.', ['organic cotton'], 800, 'US$7 to 9', ['OEKO-TEX'], ['Vietnam']]], contact: 'Ji-woo Han' }),
];

// Seeded activity, dated relative to the moment the demo state is created.
export function seedActivity(now = Date.now()) {
  const ago = (days, hours = 0) => new Date(now - (days * 24 + hours) * 3600e3).toISOString();
  const rfq = (id, brandId, title, detail, materials, quantity, target, certifications, makerIds, created, extra = {}) =>
    ({ id, brandId, title, detail, materials, quantity, target, certifications, makerIds, createdAt: created, deadline: extra.deadline || null, status: extra.status || 'open', awardedTo: extra.awardedTo || null });
  const q = (rfqId, makerId, status, at, f = {}) => ({ id: `${rfqId}:${makerId}`, rfqId, makerId, status, at, ...f });
  const rfqs = [
    rfq('rfq-1001', 'meadow-and-thread', 'Organic cotton loungewear set', 'Two-piece set, GOTS jersey, three colours.', ['organic cotton'], 600, 'US$14 to 18', ['GOTS'], ['kaveri-organic-knits', 'sanganer-handblock', 'kannur-handloom', 'mekong-fair-apparel'], ago(6)),
    rfq('rfq-1002', 'kinetic-earth', 'Recycled running tee and shorts', 'Moisture-wicking set from GRS recycled polyester.', ['recycled polyester'], 3000, 'US$9 to 12 a set', ['GRS'], ['deccan-performance', 'pearl-river-activewear', 'siam-circular-sportswear'], ago(12), { status: 'awarded', awardedTo: 'pearl-river-activewear' }),
    rfq('rfq-1003', 'indigo-roots', 'Hemp and organic cotton jeans', 'Straight leg, 13 oz, natural indigo welcome.', ['hemp', 'organic cotton'], 2500, 'US$11 to 14', [], ['padma-green-denim', 'faisalabad-organic-mills', 'kojima-selvedge-works', 'ahmedabad-indigo'], ago(4)),
    rfq('rfq-1004', 'little-sprout', 'Organic cotton bodysuit three-pack', 'Envelope neck, nickel-free snaps.', ['organic cotton'], 1500, 'US$7 to 9 a pack', ['GOTS'], ['kaveri-organic-knits', 'red-river-knitting', 'saigon-little-ones'], ago(0, 5)),
    rfq('rfq-1005', 'tiny-batch-studio', 'Linen wrap dresses', '50 pieces, two colours, garment washed.', ['linen'], 50, 'US$24 to 30', [], ['perfume-river-linen', 'hanoi-small-batch', 'hoi-an-atelier'], ago(3)),
    rfq('rfq-1006', 'budget-basics', 'Organic tees at US$2.50', '10,000 crew tees, 160 gsm.', ['organic cotton'], 10000, 'US$2 to 2.50', ['GOTS'], ['dhaka-mega-knit', 'narayanganj-green-knit', 'kaveri-organic-knits'], ago(9), { status: 'closed' }),
  ];
  const quotes = [
    q('rfq-1001', 'kaveri-organic-knits', 'quoted', ago(5, 2), { unitPrice: 15.8, moq: 300, leadTimeDays: 35, sampleCost: 60, sampleDays: 10, incoterm: 'FOB', note: 'Three colours from our standard GOTS dye list; custom colours add 5 days.' }),
    q('rfq-1001', 'mekong-fair-apparel', 'quoted', ago(4, 6), { unitPrice: 14.6, moq: 500, leadTimeDays: 44, sampleCost: 45, sampleDays: 14, incoterm: 'FOB', note: 'Fair Trade premium included in the price.' }),
    q('rfq-1001', 'sanganer-handblock', 'declined', ago(5, 20), { note: 'We weave and print; we do not knit jersey.' }),
    q('rfq-1001', 'kannur-handloom', 'requested', ago(6)),
    q('rfq-1002', 'deccan-performance', 'quoted', ago(11), { unitPrice: 10.9, moq: 500, leadTimeDays: 42, sampleCost: 70, sampleDays: 12, incoterm: 'FOB' }),
    q('rfq-1002', 'pearl-river-activewear', 'quoted', ago(10, 4), { unitPrice: 9.4, moq: 500, leadTimeDays: 30, sampleCost: 55, sampleDays: 8, incoterm: 'FOB', note: 'Seamless shorts cut sewing time.' }),
    q('rfq-1002', 'siam-circular-sportswear', 'quoted', ago(10), { unitPrice: 11.6, moq: 800, leadTimeDays: 38, sampleCost: 80, sampleDays: 10, incoterm: 'CIF' }),
    q('rfq-1003', 'padma-green-denim', 'quoted', ago(3, 3), { unitPrice: 12.4, moq: 800, leadTimeDays: 50, sampleCost: 90, sampleDays: 15, incoterm: 'FOB' }),
    q('rfq-1003', 'faisalabad-organic-mills', 'quoted', ago(2, 10), { unitPrice: 11.2, moq: 2000, leadTimeDays: 50, sampleCost: 75, sampleDays: 14, incoterm: 'FOB', note: 'Laser finishing, no stone wash.' }),
    q('rfq-1003', 'kojima-selvedge-works', 'declined', ago(3), { note: 'Selvedge on shuttle looms would put the price near US$38 a pair.' }),
    q('rfq-1003', 'ahmedabad-indigo', 'requested', ago(4)),
    q('rfq-1004', 'kaveri-organic-knits', 'requested', ago(0, 5)),
    q('rfq-1004', 'red-river-knitting', 'requested', ago(0, 5)),
    q('rfq-1004', 'saigon-little-ones', 'requested', ago(0, 5)),
    q('rfq-1005', 'perfume-river-linen', 'declined', ago(2, 14), { note: 'Our minimum is 120 pieces a style.' }),
    q('rfq-1005', 'hanoi-small-batch', 'quoted', ago(2, 3), { unitPrice: 27.5, moq: 20, leadTimeDays: 24, sampleCost: 40, sampleDays: 7, incoterm: 'EXW', note: 'Deadstock linen available in sand and black.' }),
    q('rfq-1005', 'hoi-an-atelier', 'quoted', ago(1, 20), { unitPrice: 31, moq: 30, leadTimeDays: 21, sampleCost: 35, sampleDays: 5, incoterm: 'EXW' }),
    q('rfq-1006', 'dhaka-mega-knit', 'quoted', ago(8), { unitPrice: 2.45, moq: 5000, leadTimeDays: 55, sampleCost: 25, sampleDays: 10, incoterm: 'FOB' }),
    q('rfq-1006', 'narayanganj-green-knit', 'quoted', ago(8, 3), { unitPrice: 2.9, moq: 3000, leadTimeDays: 45, sampleCost: 30, sampleDays: 10, incoterm: 'FOB' }),
    q('rfq-1006', 'kaveri-organic-knits', 'declined', ago(8, 8), { note: 'We cannot reach US$2.50 with GOTS jersey.' }),
  ];
  const note = (to, kind, title, body, link, at, read = false) => ({ id: `n-${to}-${at}-${kind}`, to, kind, title, body, link, at, read });
  const notifications = [
    note('meadow-and-thread', 'quote', 'Mekong Fair Apparel sent a quote', 'US$14.60 a set, 500 minimum, 44 days.', '#/quotes/rfq-1001', ago(4, 6)),
    note('meadow-and-thread', 'quote', 'Kaveri Organic Knits sent a quote', 'US$15.80 a set, 300 minimum, 35 days.', '#/quotes/rfq-1001', ago(5, 2), true),
    note('kaveri-organic-knits', 'rfq', 'Little Sprout asks for a quote', 'Organic cotton bodysuit three-pack, 1,500 packs.', '#/quotes/rfq-1004', ago(0, 5)),
    note('kaveri-organic-knits', 'alert', 'A new brand request fits what you make', 'Rapid Drop Co. wants 2,000 organic tees in 25 days.', '#/b/rapid-drop-co', ago(1, 2)),
    note('pearl-river-activewear', 'award', 'Kinetic Earth chose your quote', 'Recycled running tee and shorts, 3,000 sets.', '#/quotes/rfq-1002', ago(9), true),
    note('indigo-roots', 'quote', 'Faisalabad Organic Mills sent a quote', 'US$11.20 a pair, 2,000 minimum, 50 days.', '#/quotes/rfq-1003', ago(2, 10)),
    note('tiny-batch-studio', 'quote', 'Hoi An Atelier Tailors sent a quote', 'US$31 a dress, 30 minimum, 21 days.', '#/quotes/rfq-1005', ago(1, 20)),
  ];
  const saved = [
    { id: 's-1', owner: 'meadow-and-thread', query: 'GOTS loungewear, small runs, India or Cambodia', at: ago(14) },
    { id: 's-2', owner: 'passport-ready', query: 'traceable organic denim with every stage documented', at: ago(7) },
  ];
  // Demo pilot figures for the metrics page: five brands and ten makers over the last four weeks.
  const pilot = {
    label: 'Demo pilot: 5 brands and 10 manufacturers, last 28 days',
    questions: 412, profileViews: 188, shortlists: 71, enquiries: 34, rfqs: 12, quotesReceived: 29, quotesCompared: 9, awards: 3,
    minutesToShortlist: [14, 9, 22, 6, 11, 18, 7, 12, 25, 10, 8, 16],
    replyHours: [5, 11, 26, 3, 9, 30, 14, 7, 19, 4, 22, 8],
  };
  return { rfqs, quotes, notifications, saved, pilot };
}
