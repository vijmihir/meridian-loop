# Meridian Loop — demo build

AI-powered sustainable sourcing & commerce platform for Asia. One platform, three experiences:

| Experience | Who | What they can do |
|---|---|---|
| **For brands** (B2B) | Sustainable & emerging brands | Ask the AI sourcing assistant, rank manufacturers on 7 dimensions with adjustable weights, compare side by side, shortlist with team notes, send RFQs, post sourcing requests |
| **For manufacturers** (B2B) | Asian factories & artisan groups | See their trust score and profile completeness, search live brand demand, upload certificates (document intelligence), answer RFQs, send proposals, edit their profile |
| **Shop** (B2C) | Conscious consumers | Search products in plain words, see verified vs. supplier-reported claims, materials, footprint and a digital product passport for every item |

All data is fictional demo data: 23 manufacturers across India, Vietnam, China, Bangladesh, Cambodia and Indonesia, 8 brands, 12 open sourcing requests and 22 products. The certification standards (GOTS, GRS, OEKO-TEX, Fair Trade, bluesign, etc.) are real schemes, but every certificate number is made up.

---

## Run it

Needs Node.js 20.6 or newer.

```bash
npm install
```

```bash
npm run demo
```

Then open **http://localhost:8787**.

### Turn on Claude (optional)

Without an API key, the assistant uses the built-in answer engine. It runs offline and is reliable for a live demo. To have Claude write the answers from the same retrieved sources:

```bash
cp .env.example .env
```

Put your key in `.env` (`ANTHROPIC_API_KEY=sk-ant-...`) and restart. The pill in the top-right corner switches to **Claude connected**. If a Claude call fails, the app falls back to the built-in engine for that answer and shows a short note.

### Other commands

- `npm run dev`: hot-reload development (API on :8787, UI on :5173)
- `npm test`: engine self-tests (retrieval, scoring, document extraction)
- **Reset demo data** (footer button): clears shortlists, RFQs, uploaded documents and posted requests

---

## How the AI works (RAG pipeline)

```
Question ──► 1. Understand ──► 2. Retrieve ──► 3. Evaluate ──► 4. Verify ──► 5. Answer
            constraints       hybrid search    7-dimension     certificate    grounded,
            (country, MOQ,    over 147         quant score     expiry &       with [n]
            certs, price…)    passages                         evidence       citations
```

1. **Understand** (`server/rag.js → parseConstraints`): pulls countries, product category, certifications, MOQ, lead time, price, "vegan" and cost sensitivity out of plain English.
2. **Retrieve** (`server/rag.js → Index`): BM25 over words and two-word phrases, plus character-trigram similarity so typos still match. Domain synonyms expand the query (e.g. "rPET" → recycled polyester, GRS). The knowledge base covers supplier overviews, capabilities, certificates, impact data, uploaded documents, brand stories, sourcing requests, product passports and a standards glossary.
3. **Evaluate** (`server/scoring.js`): scores each manufacturer 0–100 on cost, sustainability, reliability, quality, lead time, compliance and risk. The user's weights combine these into one score. Match = 55% relevance + 45% quant score − 12 per unmet requirement.
4. **Verify**: flags expired, expiring and unverified certificates, plus weak delivery or defect records.
5. **Answer** (`server/engine.js`): the top passages and the ranking go to Claude (`server/llm.js`, model `claude-opus-5-5`), which writes a cited answer. Without a key, the built-in composer writes the answer from the same data. Server-side refusal fallback (`fallbacks: "default"`) is on, so a declined request is retried on Anthropic's recommended fallback model.

Every profile edit, uploaded certificate and posted request is re-indexed immediately. The **How it works** page has a live retriever inspector that shows BM25, fuzzy and combined scores for any query.

---

## 5-minute demo script

1. **Landing page (30s).** Read the headline, then scroll the three tinted bands: manufacturers prove it, brands find a match, shoppers see the proof. Each band shows the real screen.
1b. **Sign in (10s).** Click **Sign in**, then pick *Meadow & Thread* under Demo accounts. One click, no password.
2. **For brands → Ask the assistant (90s).** Signed in as *Meadow & Thread*. Click the suggestion *"GOTS organic cotton loungewear, small MOQ, India or Cambodia"*.
   - The badges show how the brief was read: Fashion · India or Cambodia · GOTS · MOQ ≤ 300.
   - The answer cites sources [1], [2]; hover a citation to see the passage. Open "passages this answer used" to show the RAG evidence.
   - Click the *Kaveri Organic Knits* card to open the profile: radar chart, certificates with expiry, risk flag.
3. **Rank manufacturers (60s).** Search *"vegan leather bags"*, then switch the weights from **Balanced** to **Cost first**. The ranking changes. Tick 2–3 *Compare* boxes and click **Compare side by side**. “best” marks the strongest value in each row.
4. **Manufacturer portal (60s).** Open the account menu, sign out, and sign in as **Da Nang Bamboo Textiles** (it has an expired OEKO-TEX certificate). Its private portal opens.
   - Open **Certificates** and drag `client/public/samples/oeko-tex-renewal.pdf` onto the drop zone (or click the *OEKO-TEX renewal* sample). The PDF is read and its standard, certificate number, issuer, company and expiry appear with a confidence for each.
   - Click **Attach**. The message shows the trust score rising, and the expired-certificate flag is gone.
   - Open **Brand demand** to see brand requests ranked by fit, with ✓/✕ checks, and send a proposal.
4b. **Issuer check (20s).** In *Rank manufacturers*, open **Karnaphuli Knit Composite**. Its OEKO-TEX certificate is marked *Withdrawn by issuer*, with a *Look it up* link to OEKO-TEX's own Label Check.
4c. **Email alerts (20s).** Send a quote request from Kaveri's profile, then open **Email alerts**: the email to Anitha at Kaveri is there, along with the certificate-check digests. Karnaphuli's digest leads with its withdrawn certificate.
5. **Shop (45s).** Search *"vegan sneakers under $120"*. The AI answer and the grid both drop the leather sandal. Open *Nopal Cactus Crossbody*: claims marked verified or supplier-reported, materials, footprint, and the digital product passport timeline.
6. **How it works (15s).** Run the retriever to show query expansion and the per-passage scores.

Tip: click **Reset demo data** in the footer before presenting.

---

## PDF certificates

Manufacturers upload certificates, audit summaries or lab reports as PDF (or .txt), up to 10 MB.

- **Without an API key** the PDF's text layer is read locally (`server/pdf.js`, pdf.js with script evaluation turned off) and the fields are pulled out by `server/docintel.js`. Scanned PDFs have no text layer, so the app says so and asks for Claude or pasted text.
- **With an API key** Claude reads the original PDF, including scans, and returns the fields as structured JSON (`readCertificatePdf` in `server/llm.js`). If that call fails, the app falls back to the local reading and says so.
- Attached originals are kept in `data/uploads/` (random file names, never user-chosen paths) and open from the profile with **Open PDF**. **Reset demo data** deletes them.
- Sample PDFs live in `client/public/samples/`. Rebuild them with `node scripts/make-sample-pdfs.mjs`.

## Issuer checks

Every certificate number is looked up in the register of the body that issued it (`server/issuers.js`). The result shows on supplier profiles, uploads and product claims:

- **Confirmed with issuer**: the number, holder and expiry all match the register.
- **Differs from issuer**: the register shows a different holder or expiry date.
- **Withdrawn by issuer**: counted as expired, and flagged to brands.
- **Not in issuer register**: unknown number, wrong number format, or not yet published.
- **No public register**: standards like ISO 14001 or Higg FEM, which need a check with the issuing body.

The real registers (GOTS, Textile Exchange, OEKO-TEX, FSC and others) publish search pages rather than open APIs, and the demo's certificates are fictional. So this demo checks against a **stand-in register** built from the seed data, with two deliberate problems: Karnaphuli Knit's OEKO-TEX certificate is withdrawn, and Ganga Tannery's LWG expiry disagrees with the issuer. Every check links to the issuer's real public lookup page. For the pilot, replace `lookup()` in `server/issuers.js` with partner feeds or APIs.

## Accounts and roles

Four kinds of account: **brand**, **manufacturer**, **shopper** and the **Meridian Loop team**.

| Who | Can |
|---|---|
| Anyone, signed out | Ask the assistant, rank manufacturers, open profiles, shop, read How it works |
| Brand | Everything above, plus a shortlist, quote requests and replies, and posting sourcing requests, all as its own brand |
| Manufacturer | Its own private portal: overview, brand demand, certificate uploads, inbox and profile |
| Team | Acts for any brand or manufacturer (handy in a demo) and runs the certificate check |

The server enforces these rules, not just the screens. A brand can't send quotes as another brand, a manufacturer can't edit another profile or upload someone else's certificate, and each account sees only the emails sent to it (`npm test` checks these).

- **Demo accounts:** every seeded brand and manufacturer has an account, plus a shopper and the team. The sign-in page lists them for one-click sign-in. They share one password, set as `DEMO_PASSWORD` in `data/seed.js`.
- **Sign-up** creates a real account. A new manufacturer gets a fresh profile that brands can find at once, starting with a modest trust score that rises as certificates are uploaded.
- **Security:** passwords are hashed with scrypt; sessions are signed, HttpOnly, SameSite cookies; writes must be JSON (which blocks cross-site form posts); repeated failed sign-ins are slowed down.
- **Before real users:** set `DEMO_MODE=0` to hide one-click sign-in and the reset button, and set `SESSION_SECRET`.

## Email alerts

Meridian Loop writes an email when:

- a brand sends a **quote request** (to the manufacturer)
- a manufacturer sends a **proposal** (to the brand)
- either side **replies** (to the other)
- the **certificate check** finds certificates expiring within 60 or 30 days, expired, withdrawn by the issuer, or differing from the issuer's register (one digest per manufacturer; each problem is emailed once per stage)

The check runs when the server starts, every six hours, and from the **Run the certificate check** button. Every email appears on the **Email alerts** page (`#/emails`), previewed exactly as the recipient sees it, and manufacturers see theirs on their overview.

**Nothing is sent by default.** Recipients use demo addresses on the reserved `.example` domain. To send for real, set `SMTP_URL` in `.env` (see `.env.example`). For a live pitch, also set `DEMO_INBOX` to your own address: every alert then lands in that one inbox, labelled with who it was meant for.

## Design system

The interface was rebuilt with the Hallmark design skill (theme: Dose). Warm paper with a fibre grain, one green for every signal, Schibsted Grotesk headings over Instrument Sans, and DM Mono for figures and certificate numbers. Certificates appear as swing tags with a green stamp when valid and a grey one when expired.

- `client/src/tokens.css` and `base.css`: the tokens and base rules (generated, do not hand-edit)
- `client/src/styles.css`: the app screens and shared components
- `client/src/site.css`: the landing page
- `client/public/screens/`: real screenshots of the app used on the landing page. Retake them after UI changes.

## Project layout

```
server/
  index.js      Express API + serves the built app
  engine.js     knowledge base, matching, demand, discovery, chat orchestration
  rag.js        tokenizer, synonyms, BM25 + trigram hybrid index, constraint parser
  scoring.js    7-dimension quantitative model, certificate status, risk flags
  docintel.js   certificate / audit / lab report extraction
  llm.js        optional Claude answer generation (streaming)
  store.js      seed data + demo changes saved to data/state.json
  selftest.js   npm test
data/seed.js    fictional manufacturers, brands, products, sample documents
client/src/     React app (Landing, Brand, Manufacturer, Shop, HowItWorks, Chat)
```

## Next steps for the pilot

- Replace the in-process retriever with vector embeddings in a managed store as the corpus grows.
- Read PDF certificates directly (Claude document input) and verify certificate numbers against issuer databases.
- Add real accounts and auth, persistence in Postgres, and file storage.
- Feed RFQ outcomes and on-time delivery history back into the reliability score (the "data intelligence loop").
