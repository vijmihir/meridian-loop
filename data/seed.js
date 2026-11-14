// Demo seed data for Meridian Loop.
// All companies, people and products are fictional. Certification standards are real
// schemes (GOTS, GRS, OEKO-TEX, etc.) but the certificate numbers are made up.

// Password for every seeded demo account (brands, manufacturers, the demo shopper and the team
// account). Demo only: real accounts are created through sign-up with their own passwords.
export const DEMO_PASSWORD = 'meridian-demo-2026';

const C = (name, id, issuer, expires, verified = true) => ({ name, id, issuer, expires, verified });

export const manufacturers = [
  // ---------------- INDIA ----------------
  {
    id: 'm-tirupur-organics', name: 'Kaveri Organic Knits', country: 'India', city: 'Tirupur, Tamil Nadu', founded: 2004, employees: 640,
    categories: ['Fashion'], materials: ['organic cotton', 'recycled cotton', 'organic cotton jersey', 'french terry'],
    processes: ['knitting', 'garment dyeing', 'cut & sew', 'screen printing'],
    products: 'T-shirts, sweatshirts, loungewear, babywear, polos',
    certifications: [C('GOTS', 'CU-GOTS-884213', 'Control Union', '2027-03-31'), C('OEKO-TEX Standard 100', 'OT-21.HIN.66120', 'Hohenstein', '2026-12-15'), C('Fair Trade Textile', 'FT-TX-3321', 'Fairtrade International', '2027-06-30'), C('SA8000', 'SA-IN-1192', 'SAI', '2027-09-01')],
    moq: 300, leadTimeDays: 35, priceIndex: 2, capacity: 120000, onTimeRate: 0.94, defectRate: 0.012, auditScore: 91, renewableEnergy: 62, waterRecycled: 78, sampleDays: 7,
    contact: 'Anitha Raman, Export Manager', exportMarkets: ['EU', 'UK', 'Japan', 'Hong Kong'],
    description: 'Vertically integrated organic knitwear unit in Tirupur running rooftop solar and a zero-liquid-discharge (ZLD) effluent plant. Specialises in GOTS-certified jersey basics and babywear with low-impact reactive dyes.',
  },
  {
    id: 'm-jaipur-blockprint', name: 'Sanganer Handblock Collective', country: 'India', city: 'Jaipur, Rajasthan', founded: 1998, employees: 210,
    categories: ['Fashion', 'Home Textiles'], materials: ['organic cotton', 'cotton voile', 'linen', 'natural dyes', 'indigo'],
    processes: ['hand block printing', 'natural dyeing', 'hand embroidery', 'cut & sew'],
    products: 'Block-printed dresses, kaftans, bed linen, table linen, cushion covers, quilts',
    certifications: [C('GOTS', 'ECO-GOTS-55102', 'Ecocert', '2026-11-30'), C('Fair Trade (WFTO)', 'WFTO-IN-221', 'World Fair Trade Organization', '2027-02-28'), C('Craftmark', 'CM-RJ-0912', 'All India Artisans and Craftworkers Welfare Association', '2027-08-01')],
    moq: 100, leadTimeDays: 45, priceIndex: 3, capacity: 18000, onTimeRate: 0.88, defectRate: 0.025, auditScore: 86, renewableEnergy: 35, waterRecycled: 55, sampleDays: 10,
    contact: 'Rakesh Chhipa, Founder', exportMarkets: ['EU', 'US', 'Australia'],
    description: 'Artisan cooperative of 140 block printers using natural dyes (indigo, madder, pomegranate) on organic cotton and linen. Low MOQs suit emerging brands; every piece is hand-printed so slight variation is expected.',
  },
  {
    id: 'm-kanpur-leather', name: 'Ganga Tannery & Leathercraft', country: 'India', city: 'Kanpur, Uttar Pradesh', founded: 1987, employees: 880,
    categories: ['Footwear', 'Accessories'], materials: ['chrome-free leather', 'vegetable-tanned leather', 'recycled leather fibre'],
    processes: ['vegetable tanning', 'cutting', 'stitching', 'shoe lasting', 'bag assembly'],
    products: 'Leather bags, belts, wallets, sandals, loafers',
    certifications: [C('LWG Gold', 'LWG-KN-0441', 'Leather Working Group', '2027-07-31'), C('ISO 14001', 'ISO14-IN-7781', 'Bureau Veritas', '2027-01-20'), C('SMETA 4-Pillar', 'SED-ZC-998812', 'Sedex', '2026-05-15', false)],
    moq: 250, leadTimeDays: 55, priceIndex: 3, capacity: 40000, onTimeRate: 0.9, defectRate: 0.018, auditScore: 82, renewableEnergy: 28, waterRecycled: 64, sampleDays: 14,
    contact: 'Imran Qureshi, Director', exportMarkets: ['EU', 'UK', 'Middle East'],
    description: 'LWG Gold-rated tannery producing vegetable-tanned and chrome-free leather plus in-house leather goods. Common effluent treatment and chrome recovery. SMETA audit renewal is pending.',
  },
  {
    id: 'm-panipat-recycle', name: 'Panipat ReWeave Mills', country: 'India', city: 'Panipat, Haryana', founded: 2009, employees: 430,
    categories: ['Home Textiles', 'Accessories'], materials: ['recycled cotton', 'recycled polyester', 'post-consumer textile waste', 'recycled wool'],
    processes: ['mechanical recycling', 'open-end spinning', 'weaving', 'tufting'],
    products: 'Rugs, throws, blankets, tote bags, upholstery fabric',
    certifications: [C('GRS', 'CU-GRS-120934', 'Control Union', '2027-04-30'), C('RCS', 'CU-RCS-120935', 'Control Union', '2027-04-30'), C('OEKO-TEX Standard 100', 'OT-22.IN.44021', 'TESTEX', '2027-10-10')],
    moq: 200, leadTimeDays: 40, priceIndex: 1, capacity: 60000, onTimeRate: 0.91, defectRate: 0.02, auditScore: 84, renewableEnergy: 40, waterRecycled: 90, sampleDays: 8,
    contact: 'Neha Goel, Sustainability Lead', exportMarkets: ['EU', 'US', 'Japan'],
    description: 'Textile-to-textile recycler in Panipat, the world’s largest hub for recycled throws. Shreds post-consumer garments into recycled yarn — no dyeing needed because fibre is colour-sorted. Very low water use.',
  },
  {
    id: 'm-kerala-coir', name: 'Malabar Natural Fibres', country: 'India', city: 'Alappuzha, Kerala', founded: 2001, employees: 160,
    categories: ['Home Textiles', 'Accessories'], materials: ['coir', 'jute', 'banana fibre', 'organic cotton'],
    processes: ['hand weaving', 'braiding', 'natural dyeing'],
    products: 'Doormats, baskets, jute bags, rugs, planters',
    certifications: [C('Fair Trade (WFTO)', 'WFTO-IN-418', 'World Fair Trade Organization', '2027-05-31'), C('FSC Chain of Custody', 'FSC-C155210', 'SCS Global', '2027-08-31')],
    moq: 150, leadTimeDays: 38, priceIndex: 1, capacity: 25000, onTimeRate: 0.87, defectRate: 0.03, auditScore: 80, renewableEnergy: 50, waterRecycled: 40, sampleDays: 9,
    contact: 'Thomas Varghese, Partner', exportMarkets: ['EU', 'US'],
    description: 'Women-led weaving cooperative turning coir, jute and banana-stem fibre into home goods and bags. Plastic-free packaging standard.',
  },
  {
    id: 'm-bengaluru-active', name: 'Deccan Performance Apparel', country: 'India', city: 'Bengaluru, Karnataka', founded: 2012, employees: 1200,
    categories: ['Fashion'], materials: ['recycled polyester', 'recycled nylon', 'TENCEL lyocell', 'organic cotton', 'elastane'],
    processes: ['circular knitting', 'sublimation printing', 'bonding', 'flatlock sewing', 'cut & sew'],
    products: 'Activewear, leggings, sports bras, running tees, yoga wear',
    certifications: [C('GRS', 'TE-GRS-77821', 'Intertek', '2027-02-28'), C('bluesign SYSTEM PARTNER', 'BS-IN-0233', 'bluesign technologies', '2027-09-30'), C('WRAP Gold', 'WRAP-IN-55120', 'WRAP', '2026-12-31'), C('OEKO-TEX Standard 100', 'OT-23.IN.12002', 'Hohenstein', '2027-01-15')],
    moq: 500, leadTimeDays: 42, priceIndex: 3, capacity: 200000, onTimeRate: 0.95, defectRate: 0.009, auditScore: 92, renewableEnergy: 70, waterRecycled: 60, sampleDays: 10,
    contact: 'Priya Menon, Business Development', exportMarkets: ['EU', 'US', 'Australia', 'Singapore'],
    description: 'Technical activewear plant using GRS-certified recycled polyester and nylon with bluesign-approved chemistry. 70% of power from a captive solar park.',
  },

  // ---------------- VIETNAM ----------------
  {
    id: 'm-saigon-greenthread', name: 'Saigon GreenThread Garments', country: 'Vietnam', city: 'Ho Chi Minh City', founded: 2010, employees: 950,
    categories: ['Fashion'], materials: ['recycled polyester', 'organic cotton', 'TENCEL lyocell', 'recycled nylon'],
    processes: ['woven cut & sew', 'outerwear', 'seam taping', 'laser cutting'],
    products: 'Outerwear, rain jackets, shirts, trousers, dresses',
    certifications: [C('GRS', 'CU-GRS-301122', 'Control Union', '2027-01-31'), C('Higg FEM verified', 'HIGG-FEM-VN-2291', 'Cascale', '2026-12-31'), C('WRAP Gold', 'WRAP-VN-11903', 'WRAP', '2027-03-31'), C('OEKO-TEX STeP', 'STEP-VN-0091', 'OEKO-TEX', '2027-05-31')],
    moq: 400, leadTimeDays: 38, priceIndex: 3, capacity: 150000, onTimeRate: 0.96, defectRate: 0.008, auditScore: 93, renewableEnergy: 55, waterRecycled: 45, sampleDays: 8,
    contact: 'Nguyen Thi Lan, Key Account Director', exportMarkets: ['EU', 'US', 'Japan', 'Korea'],
    description: 'Woven and outerwear specialist with PFC-free water-repellent finishes and recycled shells. Verified Higg FEM, strong on-time record, rooftop solar on both buildings.',
  },
  {
    id: 'm-hanoi-silk', name: 'Ha Dong Silk & Linen Atelier', country: 'Vietnam', city: 'Hanoi', founded: 1995, employees: 180,
    categories: ['Fashion', 'Home Textiles', 'Accessories'], materials: ['peace silk', 'mulberry silk', 'linen', 'lotus fibre'],
    processes: ['hand weaving', 'natural dyeing', 'cut & sew', 'embroidery'],
    products: 'Silk scarves, slip dresses, pillowcases, sleepwear, eye masks',
    certifications: [C('OEKO-TEX Standard 100', 'OT-20.VN.30011', 'TESTEX', '2027-06-30'), C('Fair Trade (WFTO)', 'WFTO-VN-077', 'World Fair Trade Organization', '2027-01-31')],
    moq: 80, leadTimeDays: 30, priceIndex: 4, capacity: 9000, onTimeRate: 0.9, defectRate: 0.015, auditScore: 85, renewableEnergy: 20, waterRecycled: 30, sampleDays: 7,
    contact: 'Tran Minh Duc, Owner', exportMarkets: ['Japan', 'France', 'Hong Kong'],
    description: 'Heritage silk village atelier producing ahimsa (peace) silk and rare lotus-fibre textiles. Very low MOQ, premium pricing, beautiful handwork.',
  },
  {
    id: 'm-binhduong-footwear', name: 'Binh Duong EcoStep Footwear', country: 'Vietnam', city: 'Binh Duong', founded: 2006, employees: 2300,
    categories: ['Footwear'], materials: ['recycled rubber', 'natural rubber', 'recycled polyester knit', 'plant-based leather', 'cork', 'algae foam'],
    processes: ['knit uppers', 'cold cementing', 'vulcanising', 'injection moulding'],
    products: 'Sneakers, running shoes, slides, canvas shoes',
    certifications: [C('GRS', 'SGS-GRS-88231', 'SGS', '2027-06-30'), C('Higg FEM verified', 'HIGG-FEM-VN-4410', 'Cascale', '2026-11-30'), C('ISO 14001', 'ISO14-VN-3301', 'TÜV SÜD', '2027-08-31'), C('FSC Chain of Custody (natural rubber)', 'FSC-C201889', 'Preferred by Nature', '2027-02-28')],
    moq: 1000, leadTimeDays: 60, priceIndex: 2, capacity: 400000, onTimeRate: 0.93, defectRate: 0.011, auditScore: 89, renewableEnergy: 45, waterRecycled: 50, sampleDays: 21,
    contact: 'Le Quang Huy, Sales Director', exportMarkets: ['EU', 'US', 'Australia'],
    description: 'Large-scale sneaker maker offering recycled-PET knit uppers, FSC natural rubber outsoles and algae-based foam midsoles. Higher MOQ but excellent unit economics.',
  },
  {
    id: 'm-danang-bamboo', name: 'Da Nang Bamboo Textiles', country: 'Vietnam', city: 'Da Nang', founded: 2015, employees: 320,
    categories: ['Fashion', 'Home Textiles'], materials: ['bamboo lyocell', 'organic cotton', 'TENCEL modal'],
    processes: ['knitting', 'cut & sew', 'garment dyeing'],
    products: 'Underwear, socks, sleepwear, towels, baby swaddles',
    certifications: [C('FSC Chain of Custody', 'FSC-C177001', 'SCS Global', '2027-03-31'), C('OEKO-TEX Standard 100', 'OT-23.VN.80210', 'Hohenstein', '2026-04-30', false)],
    moq: 300, leadTimeDays: 33, priceIndex: 2, capacity: 70000, onTimeRate: 0.89, defectRate: 0.017, auditScore: 78, renewableEnergy: 30, waterRecycled: 35, sampleDays: 7,
    contact: 'Pham Thu Ha, Merchandising Lead', exportMarkets: ['US', 'Australia', 'Korea'],
    description: 'Soft-goods knitter using closed-loop bamboo lyocell (not viscose) and TENCEL modal. OEKO-TEX certificate expired in April 2026 and renewal evidence has not yet been uploaded.',
  },

  // ---------------- BANGLADESH ----------------
  {
    id: 'm-dhaka-denim', name: 'Padma Green Denim', country: 'Bangladesh', city: 'Gazipur, Dhaka', founded: 2003, employees: 3100,
    categories: ['Fashion'], materials: ['organic cotton denim', 'recycled cotton', 'hemp', 'TENCEL lyocell'],
    processes: ['denim weaving', 'laser finishing', 'ozone washing', 'cut & sew'],
    products: 'Jeans, denim jackets, chinos, workwear',
    certifications: [C('LEED Platinum factory', 'USGBC-1000123', 'USGBC', '2030-01-01'), C('GOTS', 'CU-GOTS-201188', 'Control Union', '2027-02-28'), C('GRS', 'CU-GRS-201189', 'Control Union', '2027-02-28'), C('ZDHC MRSL Level 3', 'ZDHC-BD-3321', 'ZDHC', '2026-12-31')],
    moq: 800, leadTimeDays: 50, priceIndex: 2, capacity: 500000, onTimeRate: 0.92, defectRate: 0.01, auditScore: 90, renewableEnergy: 38, waterRecycled: 70, sampleDays: 12,
    contact: 'Farhana Akter, Head of Sustainability', exportMarkets: ['EU', 'US', 'UK', 'Japan'],
    description: 'LEED Platinum denim mill using laser and ozone finishing that cuts water per jean by ~60%. Hemp and recycled cotton blends available at scale.',
  },
  {
    id: 'm-chittagong-knit', name: 'Karnaphuli Knit Composite', country: 'Bangladesh', city: 'Chattogram', founded: 1999, employees: 4200,
    categories: ['Fashion'], materials: ['cotton', 'BCI cotton', 'recycled polyester', 'organic cotton'],
    processes: ['knitting', 'dyeing', 'printing', 'cut & sew'],
    products: 'T-shirts, hoodies, polos, kidswear',
    certifications: [C('Better Cotton member', 'BC-BD-10023', 'Better Cotton', '2026-12-31'), C('Accord / RSC safety', 'RSC-BD-4417', 'RMG Sustainability Council', '2027-10-31'), C('WRAP Gold', 'WRAP-BD-88210', 'WRAP', '2027-01-31'), C('OEKO-TEX Standard 100', 'OT-22.BD.54012', 'TESTEX', '2027-08-31')],
    moq: 2000, leadTimeDays: 45, priceIndex: 1, capacity: 900000, onTimeRate: 0.9, defectRate: 0.014, auditScore: 83, renewableEnergy: 15, waterRecycled: 55, sampleDays: 10,
    contact: 'Mahmudul Hasan, GM Marketing', exportMarkets: ['EU', 'US', 'Canada'],
    description: 'High-volume knit composite with very competitive pricing for basics. Sustainability credentials are moderate: Better Cotton membership but limited organic capacity and low renewable share.',
  },
  {
    id: 'm-narayanganj-jute', name: 'Golden Fibre Jute Works', country: 'Bangladesh', city: 'Narayanganj', founded: 1992, employees: 700,
    categories: ['Accessories', 'Home Textiles'], materials: ['jute', 'jute-cotton blend', 'natural latex backing'],
    processes: ['spinning', 'weaving', 'laminating-free finishing', 'sewing'],
    products: 'Tote bags, shopping bags, rugs, wine bags, packaging sacks',
    certifications: [C('Fair Trade (WFTO)', 'WFTO-BD-102', 'World Fair Trade Organization', '2027-03-31'), C('ISO 14001', 'ISO14-BD-1129', 'Intertek', '2026-11-30')],
    moq: 500, leadTimeDays: 35, priceIndex: 1, capacity: 150000, onTimeRate: 0.88, defectRate: 0.022, auditScore: 79, renewableEnergy: 20, waterRecycled: 40, sampleDays: 6,
    contact: 'Abdul Karim, Export Director', exportMarkets: ['EU', 'Japan', 'Australia'],
    description: 'Jute mill making plastic-free totes and rugs. Biodegradable, low-input fibre; offers unlaminated jute bags with natural-latex backing.',
  },
  {
    id: 'm-savar-upcycle', name: 'ReMake Dhaka Upcycling Studio', country: 'Bangladesh', city: 'Savar', founded: 2018, employees: 120,
    categories: ['Fashion', 'Accessories'], materials: ['pre-consumer cutting waste', 'deadstock fabric', 'recycled cotton'],
    processes: ['upcycling', 'patchwork', 'cut & sew', 'embroidery'],
    products: 'Patchwork jackets, bucket hats, scrunchies, pouches, quilts',
    certifications: [C('GRS', 'CU-GRS-401300', 'Control Union', '2027-07-31'), C('SA8000', 'SA-BD-0412', 'SAI', '2027-01-31')],
    moq: 100, leadTimeDays: 30, priceIndex: 2, capacity: 12000, onTimeRate: 0.86, defectRate: 0.028, auditScore: 81, renewableEnergy: 25, waterRecycled: 20, sampleDays: 6,
    contact: 'Sadia Rahman, Co-founder', exportMarkets: ['EU', 'Hong Kong', 'Singapore'],
    description: 'Small studio that rescues cutting-floor waste and deadstock from big factories and turns it into one-of-a-kind accessories and capsule pieces.',
  },

  // ---------------- CHINA ----------------
  {
    id: 'm-ningbo-rpet', name: 'Ningbo BlueLoop Textiles', country: 'China', city: 'Ningbo, Zhejiang', founded: 2008, employees: 1500,
    categories: ['Fashion', 'Accessories'], materials: ['recycled polyester', 'ocean-bound plastic yarn', 'recycled nylon', 'recycled polyester fleece'],
    processes: ['polymer recycling', 'yarn extrusion', 'fleece knitting', 'dope dyeing'],
    products: 'Fleece jackets, backpacks, recycled fabrics, puffer shells',
    certifications: [C('GRS', 'SGS-GRS-CN-77120', 'SGS', '2027-05-31'), C('bluesign SYSTEM PARTNER', 'BS-CN-1101', 'bluesign technologies', '2027-04-30'), C('OEKO-TEX Standard 100', 'OT-23.CN.66001', 'TESTEX', '2027-02-28'), C('Higg FEM verified', 'HIGG-FEM-CN-7791', 'Cascale', '2026-12-31')],
    moq: 600, leadTimeDays: 40, priceIndex: 2, capacity: 300000, onTimeRate: 0.97, defectRate: 0.006, auditScore: 94, renewableEnergy: 48, waterRecycled: 65, sampleDays: 7,
    contact: 'Chen Wei, International Sales', exportMarkets: ['EU', 'US', 'Japan', 'Korea', 'Australia'],
    description: 'Bottle-to-yarn recycler with in-house extrusion: traceable rPET and ocean-bound plastic yarns, dope-dyed to avoid water-intensive dyeing. Best-in-class quality metrics.',
  },
  {
    id: 'm-shaoxing-tencel', name: 'Shaoxing Cellulose Weaving Co.', country: 'China', city: 'Shaoxing, Zhejiang', founded: 2001, employees: 900,
    categories: ['Fashion', 'Home Textiles'], materials: ['TENCEL lyocell', 'cupro', 'linen', 'ramie', 'organic cotton'],
    processes: ['weaving', 'digital printing', 'enzyme finishing'],
    products: 'Woven fabrics, shirts, dresses, bedding sets, duvet covers',
    certifications: [C('FSC Chain of Custody', 'FSC-C190021', 'SGS', '2027-01-31'), C('OEKO-TEX Standard 100', 'OT-22.CN.10992', 'Hohenstein', '2027-09-30'), C('ISO 14001', 'ISO14-CN-6612', 'TÜV Rheinland', '2027-06-30')],
    moq: 500, leadTimeDays: 36, priceIndex: 3, capacity: 180000, onTimeRate: 0.95, defectRate: 0.009, auditScore: 88, renewableEnergy: 32, waterRecycled: 58, sampleDays: 6,
    contact: 'Zhang Min, Product Developer', exportMarkets: ['EU', 'US', 'Japan'],
    description: 'Mill specialising in cellulosic wovens (lyocell, cupro, ramie, linen) with digital printing that uses ~80% less water than rotary printing.',
  },
  {
    id: 'm-dongguan-veganleather', name: 'Dongguan NovaHide Materials', country: 'China', city: 'Dongguan, Guangdong', founded: 2016, employees: 380,
    categories: ['Footwear', 'Accessories'], materials: ['cactus leather', 'apple leather', 'grape leather', 'plant-based leather', 'recycled PU'],
    processes: ['coating', 'lamination', 'bag assembly', 'small leather goods'],
    products: 'Vegan leather handbags, wallets, card holders, watch straps, shoe uppers',
    certifications: [C('USDA BioPreferred (bio-based content)', 'USDA-BP-22019', 'USDA', '2027-03-31'), C('OEKO-TEX Standard 100', 'OT-23.CN.40011', 'TESTEX', '2027-01-31'), C('PETA-Approved Vegan', 'PETA-V-8812', 'PETA', '2027-12-31')],
    moq: 300, leadTimeDays: 45, priceIndex: 4, capacity: 30000, onTimeRate: 0.91, defectRate: 0.013, auditScore: 84, renewableEnergy: 22, waterRecycled: 30, sampleDays: 12,
    contact: 'Lin Jia, Founder & CEO', exportMarkets: ['EU', 'US', 'Hong Kong'],
    description: 'Next-gen materials converter producing plant-based leathers (cactus, apple, grape-waste) with 40–79% bio-based content, plus finished bags and small leather goods.',
  },
  {
    id: 'm-hangzhou-silk', name: 'West Lake Responsible Silk', country: 'China', city: 'Hangzhou, Zhejiang', founded: 1990, employees: 520,
    categories: ['Fashion', 'Accessories', 'Home Textiles'], materials: ['mulberry silk', 'GOTS organic silk', 'silk-cotton blend'],
    processes: ['reeling', 'jacquard weaving', 'digital printing', 'hand-rolled hems'],
    products: 'Silk scarves, ties, blouses, pillowcases, sleep masks',
    certifications: [C('GOTS', 'ECO-GOTS-CN-3310', 'Ecocert', '2027-04-30'), C('OEKO-TEX Standard 100', 'OT-21.CN.20301', 'Hohenstein', '2026-12-31'), C('BSCI amfori', 'AMF-CN-551120', 'amfori', '2027-10-31')],
    moq: 200, leadTimeDays: 32, priceIndex: 4, capacity: 40000, onTimeRate: 0.94, defectRate: 0.01, auditScore: 87, renewableEnergy: 26, waterRecycled: 48, sampleDays: 6,
    contact: 'Wang Fang, Export Manager', exportMarkets: ['EU', 'US', 'Hong Kong', 'Singapore'],
    description: 'One of few GOTS-certified organic silk producers. Jacquard and digital-print capability with traceable cocoons from certified sericulture farms.',
  },

  // ---------------- CAMBODIA ----------------
  {
    id: 'm-phnompenh-knit', name: 'Mekong Fair Apparel', country: 'Cambodia', city: 'Phnom Penh', founded: 2011, employees: 1100,
    categories: ['Fashion'], materials: ['organic cotton', 'recycled polyester', 'TENCEL lyocell', 'recycled cotton'],
    processes: ['knitting', 'cut & sew', 'heat transfer', 'embroidery'],
    products: 'T-shirts, activewear, kidswear, loungewear',
    certifications: [C('Fair Trade USA Factory', 'FTUSA-KH-2210', 'Fair Trade USA', '2027-02-28'), C('GOTS', 'CU-GOTS-KH-1102', 'Control Union', '2026-11-30'), C('Better Factories Cambodia', 'BFC-KH-0912', 'ILO / IFC', '2026-12-31')],
    moq: 500, leadTimeDays: 44, priceIndex: 2, capacity: 160000, onTimeRate: 0.91, defectRate: 0.013, auditScore: 88, renewableEnergy: 30, waterRecycled: 35, sampleDays: 9,
    contact: 'Sokha Chan, Commercial Manager', exportMarkets: ['EU', 'US', 'Canada'],
    description: 'Fair Trade USA certified factory with community development premiums paid to workers, ILO Better Factories monitored. EBA duty-free access to the EU for most products.',
  },
  {
    id: 'm-siemreap-krama', name: 'Angkor Weavers Social Enterprise', country: 'Cambodia', city: 'Siem Reap', founded: 2014, employees: 90,
    categories: ['Accessories', 'Home Textiles'], materials: ['handwoven cotton', 'Khmer silk', 'natural dyes', 'recycled cotton'],
    processes: ['hand loom weaving', 'natural dyeing', 'hand finishing'],
    products: 'Krama scarves, table runners, cushion covers, pouches',
    certifications: [C('Fair Trade (WFTO)', 'WFTO-KH-031', 'World Fair Trade Organization', '2027-06-30')],
    moq: 50, leadTimeDays: 40, priceIndex: 3, capacity: 4000, onTimeRate: 0.85, defectRate: 0.03, auditScore: 82, renewableEnergy: 60, waterRecycled: 25, sampleDays: 10,
    contact: 'Sreymom Keo, Programme Director', exportMarkets: ['EU', 'Australia', 'Japan'],
    description: 'Social enterprise training women from rural villages in traditional krama weaving. Solar-powered dye house. Smallest MOQs on the platform.',
  },

  // ---------------- INDONESIA ----------------
  {
    id: 'm-bandung-batik', name: 'Bandung Batik Lestari', country: 'Indonesia', city: 'Bandung, West Java', founded: 2007, employees: 260,
    categories: ['Fashion', 'Home Textiles'], materials: ['organic cotton', 'rayon from FSC wood', 'natural dyes', 'indigo'],
    processes: ['hand-drawn batik', 'stamp batik', 'natural dyeing', 'cut & sew'],
    products: 'Batik shirts, sarongs, dresses, table linen',
    certifications: [C('GOTS', 'CU-GOTS-ID-0811', 'Control Union', '2027-03-31'), C('OEKO-TEX Standard 100', 'OT-22.ID.22101', 'TESTEX', '2026-11-30')],
    moq: 150, leadTimeDays: 42, priceIndex: 3, capacity: 15000, onTimeRate: 0.89, defectRate: 0.02, auditScore: 83, renewableEnergy: 25, waterRecycled: 50, sampleDays: 10,
    contact: 'Dewi Kartika, Creative Director', exportMarkets: ['Japan', 'Netherlands', 'Australia'],
    description: 'Natural-dye batik house blending hand-drawn (tulis) and stamped (cap) batik on organic cotton. Wax is reclaimed and re-used.',
  },
  {
    id: 'm-semarang-footwear', name: 'Java Sole Collective', country: 'Indonesia', city: 'Semarang, Central Java', founded: 2013, employees: 1400,
    categories: ['Footwear'], materials: ['natural rubber', 'recycled rubber', 'organic cotton canvas', 'cork', 'vegetable-tanned leather'],
    processes: ['vulcanising', 'stitching', 'cementing', 'cork moulding'],
    products: 'Canvas sneakers, espadrilles, sandals, boots',
    certifications: [C('FSC Chain of Custody (natural rubber)', 'FSC-C210441', 'SCS Global', '2027-05-31'), C('SA8000', 'SA-ID-3301', 'SAI', '2026-12-31'), C('ISO 14001', 'ISO14-ID-9902', 'Bureau Veritas', '2027-01-31')],
    moq: 600, leadTimeDays: 55, priceIndex: 2, capacity: 120000, onTimeRate: 0.9, defectRate: 0.014, auditScore: 86, renewableEnergy: 34, waterRecycled: 40, sampleDays: 18,
    contact: 'Budi Santoso, Sales Manager', exportMarkets: ['EU', 'US', 'Japan'],
    description: 'Vulcanised footwear specialist using FSC-certified natural rubber from Sumatra smallholders and organic canvas uppers.',
  },
  {
    id: 'm-bali-rattan', name: 'Ubud Living Crafts', country: 'Indonesia', city: 'Gianyar, Bali', founded: 2005, employees: 140,
    categories: ['Accessories', 'Home Textiles'], materials: ['rattan', 'seagrass', 'water hyacinth', 'pandan', 'organic cotton'],
    processes: ['hand weaving', 'braiding', 'natural finishing'],
    products: 'Rattan bags, beach totes, baskets, placemats, lampshades',
    certifications: [C('FSC Chain of Custody', 'FSC-C166720', 'Preferred by Nature', '2026-12-31'), C('Fair Trade (WFTO)', 'WFTO-ID-219', 'World Fair Trade Organization', '2027-02-28')],
    moq: 100, leadTimeDays: 35, priceIndex: 2, capacity: 10000, onTimeRate: 0.88, defectRate: 0.025, auditScore: 81, renewableEnergy: 45, waterRecycled: 20, sampleDays: 8,
    contact: 'Made Wirawan, Owner', exportMarkets: ['EU', 'US', 'Australia', 'Hong Kong'],
    description: 'Village-based artisan network weaving rattan, seagrass and water hyacinth (an invasive plant harvested from lakes) into bags and homeware.',
  },
];

export const brands = [
  {
    id: 'b-meadow-thread', name: 'Meadow & Thread', hq: 'Hong Kong', founded: 2021, category: 'Fashion',
    tagline: 'Everyday essentials, honestly made.',
    story: 'A Hong Kong DTC label making organic cotton basics and loungewear. Publishes full factory lists and pays for third-party certification on every style.',
    values: ['Organic materials', 'Living wages', 'Full supplier disclosure'],
    transparency: 92,
    sourcingRequests: [
      { id: 'r-mt-1', title: 'Organic cotton loungewear set (hoodie + jogger)', category: 'Fashion', materials: ['organic cotton', 'french terry'], quantity: 600, targetPrice: 'US$14–18 per set', deadline: '2027-02-15', requirements: 'GOTS certified, low-impact dyes, OEKO-TEX, 3 colourways, small MOQ per colour (200).', preferredCountries: ['India', 'Cambodia'] },
      { id: 'r-mt-2', title: 'Silk sleep mask & pillowcase gift set', category: 'Accessories', materials: ['mulberry silk', 'organic silk'], quantity: 300, targetPrice: 'US$22 per set', deadline: '2027-01-20', requirements: 'Organic or peace silk preferred, OEKO-TEX, plastic-free packaging.', preferredCountries: ['China', 'Vietnam'] },
    ],
  },
  {
    id: 'b-kinetic-earth', name: 'Kinetic Earth', hq: 'Singapore', founded: 2019, category: 'Fashion',
    tagline: 'Performance gear from yesterday’s bottles.',
    story: 'Singapore activewear brand built on recycled polyester and nylon, with a take-back programme for worn leggings.',
    values: ['Recycled materials', 'Circularity', 'Carbon tracking'],
    transparency: 85,
    sourcingRequests: [
      { id: 'r-ke-1', title: 'Recycled polyester running tee & shorts', category: 'Fashion', materials: ['recycled polyester'], quantity: 3000, targetPrice: 'US$6–8 per piece', deadline: '2027-03-01', requirements: 'GRS certified rPET, bluesign chemistry preferred, moisture-wicking, sublimation print.', preferredCountries: ['India', 'China', 'Vietnam'] },
      { id: 'r-ke-2', title: 'Recycled nylon yoga leggings', category: 'Fashion', materials: ['recycled nylon', 'elastane'], quantity: 2000, targetPrice: 'US$9–12', deadline: '2027-04-10', requirements: 'GRS recycled nylon, squat-proof, OEKO-TEX, size XS–3XL.', preferredCountries: [] },
    ],
  },
  {
    id: 'b-terra-sole', name: 'Terra Sole', hq: 'Hong Kong', founded: 2022, category: 'Footwear',
    tagline: 'Sneakers that return to the earth.',
    story: 'Footwear start-up designing sneakers from natural rubber, cork and plant-based leather, aiming for 90% bio-based content by 2028.',
    values: ['Bio-based materials', 'Vegan', 'Low carbon'],
    transparency: 80,
    sourcingRequests: [
      { id: 'r-ts-1', title: 'Vegan low-top sneaker with natural rubber sole', category: 'Footwear', materials: ['plant-based leather', 'natural rubber', 'cork'], quantity: 1200, targetPrice: 'US$18–24 FOB', deadline: '2027-05-01', requirements: 'FSC natural rubber, vegan certified upper, recycled laces, sizes EU 36–46.', preferredCountries: ['Vietnam', 'Indonesia'] },
    ],
  },
  {
    id: 'b-hearth-loom', name: 'Hearth & Loom', hq: 'Sydney', founded: 2018, category: 'Home Textiles',
    tagline: 'Homewares with a story in every thread.',
    story: 'Australian homewares brand working with artisan cooperatives across Asia on bedding, throws and table linen.',
    values: ['Artisan craft', 'Fair trade', 'Natural fibres'],
    transparency: 88,
    sourcingRequests: [
      { id: 'r-hl-1', title: 'Block-printed organic cotton quilt cover', category: 'Home Textiles', materials: ['organic cotton', 'natural dyes'], quantity: 400, targetPrice: 'US$28–35', deadline: '2027-02-28', requirements: 'Hand block printed, GOTS, Fair Trade, queen and king sizes.', preferredCountries: ['India'] },
      { id: 'r-hl-2', title: 'Recycled cotton throw blankets', category: 'Home Textiles', materials: ['recycled cotton'], quantity: 800, targetPrice: 'US$12–15', deadline: '2027-01-31', requirements: 'GRS/RCS certified, undyed colour-sorted fibre, 130×170 cm.', preferredCountries: ['India'] },
    ],
  },
  {
    id: 'b-carry-good', name: 'Carry Good Co.', hq: 'Tokyo', founded: 2020, category: 'Accessories',
    tagline: 'Bags made from plants and second chances.',
    story: 'Japanese bag brand using jute, rattan and plant-based leather, replacing plastic laminates entirely.',
    values: ['Plastic-free', 'Biodegradable', 'Craft'],
    transparency: 78,
    sourcingRequests: [
      { id: 'r-cg-1', title: 'Unlaminated jute market tote', category: 'Accessories', materials: ['jute', 'organic cotton'], quantity: 5000, targetPrice: 'US$2.5–3.5', deadline: '2027-01-15', requirements: 'No PP lamination, cotton handles, Fair Trade preferred.', preferredCountries: ['Bangladesh', 'India'] },
      { id: 'r-cg-2', title: 'Cactus-leather crossbody bag', category: 'Accessories', materials: ['cactus leather', 'plant-based leather'], quantity: 500, targetPrice: 'US$20–26', deadline: '2027-03-15', requirements: 'Min 50% bio-based content with test report, PETA vegan, recycled lining.', preferredCountries: [] },
    ],
  },
  {
    id: 'b-indigo-roots', name: 'Indigo Roots', hq: 'Amsterdam', founded: 2017, category: 'Fashion',
    tagline: 'Denim that does less harm.',
    story: 'Dutch denim label producing jeans with hemp and recycled cotton blends, finished with laser and ozone instead of stone washing.',
    values: ['Water stewardship', 'Repairability', 'Recycled content'],
    transparency: 90,
    sourcingRequests: [
      { id: 'r-ir-1', title: 'Hemp-organic cotton straight-leg jeans', category: 'Fashion', materials: ['hemp', 'organic cotton denim', 'recycled cotton'], quantity: 2500, targetPrice: 'US$11–14', deadline: '2027-04-30', requirements: 'Laser/ozone finishing, ZDHC Level 3, GOTS or GRS, water < 30 L per jean.', preferredCountries: ['Bangladesh'] },
    ],
  },
  {
    id: 'b-sora-silk', name: 'Sora Silk Studio', hq: 'Seoul', founded: 2023, category: 'Accessories',
    tagline: 'Slow silk for slow mornings.',
    story: 'Korean label making silk scarves and sleepwear in small runs with natural dyes.',
    values: ['Slow fashion', 'Small batch', 'Natural dyes'],
    transparency: 74,
    sourcingRequests: [
      { id: 'r-ss-1', title: 'Naturally dyed peace silk scarves', category: 'Accessories', materials: ['peace silk', 'natural dyes'], quantity: 150, targetPrice: 'US$15–20', deadline: '2027-02-01', requirements: 'Ahimsa silk, natural dyes only, hand-rolled hem, 90×90 cm.', preferredCountries: ['Vietnam', 'China', 'India'] },
    ],
  },
  {
    id: 'b-little-sprout', name: 'Little Sprout', hq: 'Hong Kong', founded: 2020, category: 'Fashion',
    tagline: 'Gentle clothes for tiny humans.',
    story: 'Babywear brand focused on certified organic, skin-safe fabrics and gender-neutral designs.',
    values: ['Organic', 'Skin-safe', 'Gender neutral'],
    transparency: 83,
    sourcingRequests: [
      { id: 'r-ls-1', title: 'Organic cotton baby bodysuit 3-pack', category: 'Fashion', materials: ['organic cotton', 'organic cotton jersey'], quantity: 1500, targetPrice: 'US$7–9 per pack', deadline: '2027-01-31', requirements: 'GOTS + OEKO-TEX Class I (baby), nickel-free snaps, water-based prints.', preferredCountries: ['India', 'Cambodia'] },
    ],
  },
];

export const products = [
  { id: 'p-1', brandId: 'b-meadow-thread', manufacturerId: 'm-tirupur-organics', name: 'Everyday Organic Tee', category: 'Fashion', price: 32, colors: ['#ece6da', '#2f4a3a', '#1f2b44'],
    materials: [{ name: 'Organic cotton', pct: 100, origin: 'Madhya Pradesh, India' }], co2kg: 2.1, waterL: 410,
    claims: ['GOTS certified organic cotton', 'Low-impact reactive dyes', 'Made in a solar-powered factory'],
    description: 'A mid-weight 180gsm jersey tee in GOTS organic cotton, garment-dyed in a zero-liquid-discharge facility.' },
  { id: 'p-2', brandId: 'b-meadow-thread', manufacturerId: 'm-tirupur-organics', name: 'Cloud Terry Lounge Hoodie', category: 'Fashion', price: 78, colors: ['#d9cfc0', '#6f7f6a'],
    materials: [{ name: 'Organic cotton', pct: 85, origin: 'Gujarat, India' }, { name: 'Recycled cotton', pct: 15, origin: 'Tirupur, India' }], co2kg: 5.4, waterL: 980,
    claims: ['GOTS certified', 'Fair Trade Textile factory', '15% recycled cotton'],
    description: 'Brushed-back french terry hoodie with a relaxed fit. Fair Trade premiums go directly to the factory workers’ committee.' },
  { id: 'p-3', brandId: 'b-meadow-thread', manufacturerId: 'm-hangzhou-silk', name: 'Organic Silk Pillowcase', category: 'Home Textiles', price: 69, colors: ['#efe4d6', '#b7a58f'],
    materials: [{ name: 'GOTS organic mulberry silk', pct: 100, origin: 'Zhejiang, China' }], co2kg: 3.2, waterL: 620,
    claims: ['GOTS organic silk', 'OEKO-TEX Standard 100'],
    description: '22 momme organic mulberry silk pillowcase with hidden envelope closure.' },
  { id: 'p-4', brandId: 'b-kinetic-earth', manufacturerId: 'm-bengaluru-active', name: 'Loop Run Tee', category: 'Fashion', price: 45, colors: ['#1f2b44', '#c4703c'],
    materials: [{ name: 'Recycled polyester (rPET)', pct: 92, origin: 'Bengaluru, India' }, { name: 'Elastane', pct: 8, origin: 'Taiwan' }], co2kg: 1.6, waterL: 35,
    claims: ['Made from ~11 plastic bottles', 'GRS certified', 'bluesign approved chemistry'],
    description: 'Lightweight, quick-dry running tee knitted from GRS-certified recycled polyester.' },
  { id: 'p-5', brandId: 'b-kinetic-earth', manufacturerId: 'm-bengaluru-active', name: 'Flow Recycled Leggings', category: 'Fashion', price: 88, colors: ['#232323', '#2f4a3a', '#4a5f7a'],
    materials: [{ name: 'Recycled nylon', pct: 78, origin: 'Bengaluru, India' }, { name: 'Elastane', pct: 22, origin: 'Korea' }], co2kg: 3.0, waterL: 60,
    claims: ['GRS recycled nylon', 'Take-back programme', 'Solar-powered production'],
    description: 'High-rise, squat-proof leggings with a buttery feel. Return them when worn out and we recycle them.' },
  { id: 'p-6', brandId: 'b-kinetic-earth', manufacturerId: 'm-ningbo-rpet', name: 'Harbour Fleece Jacket', category: 'Fashion', price: 120, colors: ['#4a5f7a', '#d9cfc0'],
    materials: [{ name: 'Ocean-bound plastic yarn', pct: 100, origin: 'Zhejiang coast, China' }], co2kg: 6.2, waterL: 80,
    claims: ['Ocean-bound plastic', 'Dope-dyed (no water dyeing)', 'GRS certified'],
    description: 'A cosy full-zip fleece made from plastic collected within 50 km of coastlines and dope-dyed to save water.' },
  { id: 'p-7', brandId: 'b-terra-sole', manufacturerId: 'm-binhduong-footwear', name: 'Terra One Sneaker', category: 'Footwear', price: 115, colors: ['#ece6da', '#6f7f6a'],
    materials: [{ name: 'Recycled PET knit', pct: 40, origin: 'Vietnam' }, { name: 'FSC natural rubber', pct: 35, origin: 'Dong Nai, Vietnam' }, { name: 'Algae foam', pct: 15, origin: 'USA' }, { name: 'Cork footbed', pct: 10, origin: 'Portugal' }], co2kg: 7.9, waterL: 140,
    claims: ['Vegan', 'FSC natural rubber outsole', 'Recycled knit upper'],
    description: 'Everyday low-top with a breathable recycled knit upper, algae-foam midsole and FSC rubber sole.' },
  { id: 'p-8', brandId: 'b-terra-sole', manufacturerId: 'm-semarang-footwear', name: 'Java Canvas Low', category: 'Footwear', price: 89, colors: ['#efe4d6', '#1f2b44'],
    materials: [{ name: 'Organic cotton canvas', pct: 55, origin: 'Central Java, Indonesia' }, { name: 'FSC natural rubber', pct: 45, origin: 'Sumatra, Indonesia' }], co2kg: 6.1, waterL: 210,
    claims: ['FSC rubber from smallholders', 'SA8000 factory', 'Organic canvas'],
    description: 'Classic vulcanised canvas sneaker with smallholder-sourced natural rubber.' },
  { id: 'p-9', brandId: 'b-hearth-loom', manufacturerId: 'm-jaipur-blockprint', name: 'Sanganer Block-Print Quilt Cover', category: 'Home Textiles', price: 189, colors: ['#e7dfcf', '#3b5d7a', '#a65a3a'],
    materials: [{ name: 'Organic cotton voile', pct: 100, origin: 'Rajasthan, India' }], co2kg: 9.5, waterL: 2100,
    claims: ['Hand block printed', 'Natural indigo & madder dyes', 'WFTO Fair Trade'],
    description: 'Hand block printed by artisans in Sanganer using carved teak blocks and natural dyes. Each piece is unique.' },
  { id: 'p-10', brandId: 'b-hearth-loom', manufacturerId: 'm-panipat-recycle', name: 'ReWeave Recycled Throw', category: 'Home Textiles', price: 95, colors: ['#8a8f7a', '#d4c6b0'],
    materials: [{ name: 'Recycled cotton', pct: 70, origin: 'Panipat, India' }, { name: 'Recycled polyester', pct: 30, origin: 'Panipat, India' }], co2kg: 3.1, waterL: 55,
    claims: ['100% recycled fibres', 'No added dyes (colour-sorted)', 'GRS + RCS certified'],
    description: 'Woven from shredded post-consumer garments, colour-sorted so no new dye is needed.' },
  { id: 'p-11', brandId: 'b-hearth-loom', manufacturerId: 'm-siemreap-krama', name: 'Angkor Handwoven Table Runner', category: 'Home Textiles', price: 58, colors: ['#a65a3a', '#e7dfcf'],
    materials: [{ name: 'Handwoven cotton', pct: 100, origin: 'Siem Reap, Cambodia' }], co2kg: 1.2, waterL: 300,
    claims: ['Handwoven by women artisans', 'Solar-powered dye house', 'WFTO Fair Trade'],
    description: 'Traditional krama check woven on hand looms by a women’s social enterprise.' },
  { id: 'p-12', brandId: 'b-carry-good', manufacturerId: 'm-narayanganj-jute', name: 'Market Jute Tote', category: 'Accessories', price: 24, colors: ['#c8a978', '#2f4a3a'],
    materials: [{ name: 'Jute', pct: 85, origin: 'Narayanganj, Bangladesh' }, { name: 'Organic cotton handles', pct: 15, origin: 'Bangladesh' }], co2kg: 0.6, waterL: 40,
    claims: ['Plastic-free (no lamination)', 'Home compostable', 'WFTO Fair Trade'],
    description: 'Sturdy unlaminated jute tote for groceries and markets. Fully biodegradable.' },
  { id: 'p-13', brandId: 'b-carry-good', manufacturerId: 'm-dongguan-veganleather', name: 'Nopal Cactus Crossbody', category: 'Accessories', price: 135, colors: ['#2f4a3a', '#a65a3a', '#232323'],
    materials: [{ name: 'Cactus leather', pct: 70, origin: 'Mexico / finished in Dongguan' }, { name: 'Recycled polyester lining', pct: 30, origin: 'China' }], co2kg: 4.4, waterL: 160,
    claims: ['PETA-Approved Vegan', '~60% bio-based content', 'Recycled lining'],
    description: 'Compact crossbody in nopal cactus leather with an adjustable recycled webbing strap.' },
  { id: 'p-14', brandId: 'b-carry-good', manufacturerId: 'm-bali-rattan', name: 'Ubud Round Rattan Bag', category: 'Accessories', price: 72, colors: ['#c8a978'],
    materials: [{ name: 'Rattan', pct: 90, origin: 'Kalimantan, Indonesia' }, { name: 'Organic cotton lining', pct: 10, origin: 'Indonesia' }], co2kg: 0.9, waterL: 25,
    claims: ['FSC certified rattan', 'Hand-woven in Bali', 'WFTO Fair Trade'],
    description: 'Hand-woven round rattan bag with a batik-print organic cotton lining.' },
  { id: 'p-15', brandId: 'b-indigo-roots', manufacturerId: 'm-dhaka-denim', name: 'Hemp Straight Jean', category: 'Fashion', price: 129, colors: ['#2a3a5c', '#4a5f7a'],
    materials: [{ name: 'Organic cotton', pct: 60, origin: 'Turkey' }, { name: 'Hemp', pct: 25, origin: 'China' }, { name: 'Recycled cotton', pct: 15, origin: 'Bangladesh' }], co2kg: 11.2, waterL: 1400,
    claims: ['Laser & ozone finished (−60% water)', 'LEED Platinum factory', 'ZDHC Level 3 chemistry'],
    description: 'A classic straight-leg jean in a hemp-organic cotton blend. Finished without stones or bleach.' },
  { id: 'p-16', brandId: 'b-indigo-roots', manufacturerId: 'm-savar-upcycle', name: 'Patchwork Denim Bucket Hat', category: 'Accessories', price: 49, colors: ['#4a5f7a', '#2a3a5c'],
    materials: [{ name: 'Pre-consumer denim offcuts', pct: 100, origin: 'Savar, Bangladesh' }], co2kg: 0.4, waterL: 15,
    claims: ['Upcycled from cutting waste', 'One-of-a-kind', 'SA8000 studio'],
    description: 'Each hat is pieced from denim offcuts that would otherwise go to landfill.' },
  { id: 'p-17', brandId: 'b-sora-silk', manufacturerId: 'm-hanoi-silk', name: 'Peace Silk Scarf — Lotus', category: 'Accessories', price: 85, colors: ['#e9c9b5', '#b7a58f'],
    materials: [{ name: 'Peace (ahimsa) silk', pct: 100, origin: 'Hanoi, Vietnam' }], co2kg: 1.0, waterL: 210,
    claims: ['Ahimsa silk (moths emerge)', 'Natural dyes', 'Hand-rolled hem'],
    description: 'A 90×90 scarf in cruelty-free peace silk, naturally dyed with lotus leaf and sappanwood.' },
  { id: 'p-18', brandId: 'b-sora-silk', manufacturerId: 'm-hanoi-silk', name: 'Silk Sleep Mask', category: 'Accessories', price: 39, colors: ['#efe4d6', '#2f4a3a'],
    materials: [{ name: 'Mulberry silk', pct: 100, origin: 'Lam Dong, Vietnam' }], co2kg: 0.3, waterL: 40,
    claims: ['OEKO-TEX Standard 100', 'Plastic-free packaging'],
    description: 'Silk sleep mask with organic cotton filling and a soft adjustable band.' },
  { id: 'p-19', brandId: 'b-little-sprout', manufacturerId: 'm-phnompenh-knit', name: 'Sprout Organic Bodysuit 3-Pack', category: 'Fashion', price: 42, colors: ['#ece6da', '#c9d3c0', '#e9c9b5'],
    materials: [{ name: 'Organic cotton', pct: 100, origin: 'India' }], co2kg: 1.4, waterL: 300,
    claims: ['GOTS certified', 'Fair Trade USA factory', 'Nickel-free snaps'],
    description: 'Soft organic bodysuits for 0–24 months, sewn in a Fair Trade USA certified factory.' },
  { id: 'p-20', brandId: 'b-little-sprout', manufacturerId: 'm-danang-bamboo', name: 'Bamboo Baby Swaddle', category: 'Home Textiles', price: 36, colors: ['#c9d3c0', '#efe4d6'],
    materials: [{ name: 'Bamboo lyocell', pct: 70, origin: 'Da Nang, Vietnam' }, { name: 'Organic cotton', pct: 30, origin: 'India' }], co2kg: 0.9, waterL: 120,
    claims: ['FSC bamboo lyocell', 'OEKO-TEX (renewal pending)'],
    description: 'Breathable muslin swaddle in closed-loop bamboo lyocell.' },
  { id: 'p-21', brandId: 'b-hearth-loom', manufacturerId: 'm-bandung-batik', name: 'Lestari Batik Napkins (set of 4)', category: 'Home Textiles', price: 44, colors: ['#3b5d7a', '#e7dfcf'],
    materials: [{ name: 'Organic cotton', pct: 100, origin: 'Indonesia' }], co2kg: 0.8, waterL: 260,
    claims: ['Natural indigo batik', 'GOTS certified', 'Reclaimed wax'],
    description: 'Stamp-batik napkins dyed with natural indigo.' },
  { id: 'p-22', brandId: 'b-terra-sole', manufacturerId: 'm-kanpur-leather', name: 'Veg-Tan Everyday Sandal', category: 'Footwear', price: 98, colors: ['#8a5a3a'],
    materials: [{ name: 'Vegetable-tanned leather', pct: 70, origin: 'Kanpur, India' }, { name: 'Natural rubber', pct: 30, origin: 'Kerala, India' }], co2kg: 5.8, waterL: 900,
    claims: ['LWG Gold tannery', 'Chrome-free'],
    description: 'Minimal two-strap sandal in chrome-free vegetable-tanned leather.' },
];

// Build product passport trace steps from linked data.
export function traceFor(product, manufacturer, brand) {
  const firstMat = product.materials[0];
  return [
    { stage: 'Raw material', location: firstMat.origin, partner: `${firstMat.name} supplier`, verified: true },
    { stage: 'Processing', location: manufacturer.city + ', ' + manufacturer.country, partner: manufacturer.name, verified: true },
    { stage: 'Manufacturing', location: manufacturer.city + ', ' + manufacturer.country, partner: manufacturer.name, verified: manufacturer.certifications.some((c) => c.verified) },
    { stage: 'Brand & distribution', location: brand.hq, partner: brand.name, verified: true },
  ];
}

// Sample certificate texts for the "document intelligence" demo.
export const sampleDocuments = [
  {
    label: 'GOTS scope certificate',
    text: `CONTROL UNION CERTIFICATIONS
SCOPE CERTIFICATE — Global Organic Textile Standard (GOTS) Version 7.0
Certificate number: CU-GOTS-990311
This is to certify that Mekong Fair Apparel, Phnom Penh, Cambodia
has been inspected and assessed according to GOTS and found to be in accordance with it.
Products: knitted garments (T-shirts, babywear) — organic cotton 95–100%
Processing steps: knitting, dyeing, cutting, sewing, printing
Valid until: 30 November 2027
Place and date of issue: Zwolle, 02 November 2026`,
  },
  {
    label: 'OEKO-TEX renewal (fixes an expired cert)',
    text: `HOHENSTEIN INSTITUTE
OEKO-TEX® STANDARD 100 — CERTIFICATE
Certificate number: OT-26.VN.80210-R
We hereby certify that Da Nang Bamboo Textiles, Da Nang, Vietnam
is granted authorisation to use the OEKO-TEX Standard 100 label for:
knitted underwear, sleepwear and baby swaddles in bamboo lyocell / organic cotton, Product Class I (articles for babies).
Valid until: 31 October 2027
Date of issue: 28 October 2026`,
  },
  {
    label: 'Lab test report (bio-based content)',
    text: `TEST REPORT — Bio-based carbon content (ASTM D6866)
Client: Dongguan NovaHide Materials
Sample: Cactus leather, 1.2 mm, colour forest green
Result: Bio-based carbon content 61% (± 3%)
Laboratory: Beta Analytic (accredited ISO/IEC 17025)
Report no. BA-2026-118204, issued 14 October 2026
OEKO-TEX Standard 100 Class II compliant`,
  },
  {
    label: 'Social audit summary',
    text: `SMETA 4-PILLAR AUDIT SUMMARY
Site: Ganga Tannery & Leathercraft, Kanpur, India
Audit reference: SED-ZC-998812-R2
Audit date: 20 September 2026 — Auditor: SGS
Pillars: Labour Standards, Health & Safety, Environment, Business Ethics
Non-conformities: 2 minor (overtime records, fire drill frequency), 0 critical
Corrective action plan closed: yes
Next audit due: September 2027`,
  },
];
