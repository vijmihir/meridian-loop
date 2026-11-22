# Meridian Loop

A two-way search that connects sustainable clothing brands with manufacturers across Asia.

- **Brands** describe what they want made ("GOTS organic cotton loungewear, small MOQ, India or Cambodia") and get the manufacturers that fit, with the reasons.
- **Manufacturers** describe what they make ("waste cotton yarn and fabric") and get the brands looking for it.

Every answer cites the profile lines it used. Companies can list themselves and become searchable at once. Meridian Loop grew out of [Sustainable India](https://srishtipal86.wixsite.com/sustainableindia) (2019), which set out to be "the bridge between the manufacturers and the designers".

The demo holds 17 manufacturers and 8 brands, all fictional. Certification schemes are real; their numbers and dates are not.

## Run it

Needs Node.js 20.6 or newer.

```bash
npm install
```

```bash
npm run demo
```

Then open http://localhost:8787. Run the checks with `npm test`.

## How the search works

1. **Index.** Each profile is split into short passages (about, materials and terms, certifications, each open request).
2. **Read the request.** Countries, certifications, minimum order and lead time are picked out of the plain-English request.
3. **Retrieve.** Keyword search over words and phrases, plus spelling-tolerant matching and textile synonyms (rPET means recycled polyester, "waste cotton" means recycled cotton).
4. **Rank.** Companies are ranked by how well their passages match, and whether they meet each stated requirement.
5. **Answer.** A short answer names the best fits and cites the numbered passages. With `ANTHROPIC_API_KEY` set, Claude writes the answer from the same passages; without it, the built-in writer does.

Code: `server/rag.js` (retrieval), `server/engine.js` (ranking and answers), `server/llm.js` (optional Claude), `server/store.js` (companies), `data/seed.js` (demo data), `client/src/` (the site).

## Demo in two minutes

1. On the home page, keep **I'm a brand** and click *GOTS organic cotton loungewear, small MOQ, India or Cambodia*. Point out "Read as", the cited answer, and the ✓ checks on each match.
2. Open **Kaveri Organic Knits**: what they make, minimums, certifications, and *Get in touch*.
3. Switch to **I'm a manufacturer** and search *Peace silk scarves in Vietnam*. Sora Silk Studio comes up with its open request.
4. Go to **List your company**, add a manufacturer (say, a linen workshop in Hue), then search *linen shirts in Vietnam* as a brand. The new company is found straight away.

Click **Reset demo** in the footer to remove companies added during a demo.

## Hosting

`render.yaml` sets up a free web service on [Render](https://render.com). Pushing to GitHub redeploys it. On the free plan the site sleeps after 15 minutes idle (the first visit then takes about 50 seconds), and companies added through the site reset on each restart.

The earlier, larger version of this demo is kept in git as the tag `v1-full-platform`.
