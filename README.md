# Meridian Loop

A sourcing assistant and marketplace that connects sustainable clothing brands with manufacturers across Asia.

- **Brands** describe what they want made in plain words. The assistant lists the manufacturers that fit, with each requirement checked, then the brand saves the ones it likes and asks them all for a quote at once. Replies come back side by side: price, minimum order, lead time, sample cost and terms.
- **Manufacturers** describe what they make and get the brands asking for it. They answer quote requests on the site or on WhatsApp, in English, Hindi, Vietnamese or Bengali.

Meridian Loop grew out of [Sustainable India](https://srishtipal86.wixsite.com/sustainableindia) (2019), which set out to be "the bridge between the manufacturers and the designers".

All data is dummy data: 53 manufacturers in 13 Asian countries and 28 brands, with seeded quote requests in every state. Certification schemes are real; numbers and dates are not.

## Run it

Needs Node.js 20.6 or newer.

```bash
npm install
```

```bash
npm run demo
```

Then open http://localhost:8787 (the landing page) or http://localhost:8787/app.html (the app). `npm test` runs 30 checks; `npm run eval` scores the search against 50 briefs.

## What is in it

| Part | What it does |
| --- | --- |
| Assistant | Chat that keeps the brief across turns, asks for what is missing, compares manufacturers, explains terms, and offers next steps. Claude runs it when `ANTHROPIC_API_KEY` is set; a built-in assistant otherwise. |
| Search | Words, phrases, spelling-tolerant matching and meaning groups ("breathable summer shirting" finds linen, ramie, TENCEL and bamboo makers). Reads country, certificate, run size, lead time, price ("under $3"), capacity ("100,000 a month"), "checked certificates" and "product passport" from the request. |
| Quote requests | A brand sends one brief to up to eight manufacturers; each gets a note and an email. Replies are compared side by side with the best price, minimum and lead time marked; the brand chooses one and the others are told. "Simulate replies" lets dummy makers answer from their profiles, declining when the run is too small or a certificate is missing or expired. |
| Accounts | Demo sign-in as any company or as the Meridian Loop team. Brands edit their open requests; manufacturers edit prices, samples, capacity, per-colour minimums, terms and languages, and upload certificate scans, photographs and tech packs (PDF or image, 1.5 MB). |
| Certificates | Each shows its register status: checked, as given, expired or not found. The team (or the maker) runs a register check from the profile. Expired and unfound certificates fail a brand's requirement in search. |
| Traceability | Fibre, yarn, fabric, dyeing and sewing, each documented, self-declared or unknown. "Passport-ready" means every stage is documented and a fibre certificate is confirmed and in date. |
| Alerts | Saved searches; a new manufacturer that fits one sends the brand a note, and a new brand request sends the manufacturers that fit it a note. Every note is also written to the email outbox (the team can read it). |
| WhatsApp | `POST /api/whatsapp/inbound` is the address a provider (Twilio, Meta Cloud API) would call. Manufacturers see requests, quote (`QUOTE 1004 6.80 500 32`), decline, update their profile, or join (`JOIN name | city, country | products | materials | minimum`). Replies come in the maker's first language. The app has a simulator at `#/whatsapp`. |
| Metrics | `#/metrics`: the funnel from question to chosen quote, minutes to a shortlist and hours to a reply, for a seeded demo pilot and live on this server. |
| Eval | `data/eval-briefs.js`: 50 briefs with the companies an expert would pick. Currently 90% first, 98% in the top three. |

## Demo in five minutes

1. On the landing page, press **Ask the assistant**. Pick **I'm a brand**, tap *GOTS loungewear, small runs, India*, then *Only in India*.
2. Press **Save** on two manufacturers and **Alert me to new matches** in the brief panel (it asks you to sign in: choose **Meadow & Thread**).
3. Press **Request quotes** in the shortlist, send it, then **Simulate replies**. Compare the quotes and **Choose** one.
4. Open **Inbox** to see the replies, then sign in as **Kaveri Organic Knits**, open **Quotes** and reply to Little Sprout's request. Switch the language to Hindi under the account page first to show the form translated.
5. Open **WhatsApp channel** in the footer, write as Jaipur Zari (Hindi) and send *मदद*, then as Kaveri send `QUOTE 1004 6.80 500 32`.
6. Open **Jaipur Zari & Embroidery Studio** in the directory: its GOTS certificate is "not found in the register". Ask the assistant for *organic tees within 20 days*: Tirupur QuickStitch is fast but its GOTS has expired.
7. Show **Pilot metrics**.

**Reset demo** in the footer puts the seeded data back.

## Storage and hosting

The state (joined companies, edits, quote requests, quotes, notifications, outbox, saved searches, documents, events) is one JSON document:

- **`DATABASE_URL` set** (Neon, Supabase or any Postgres): one row in `meridian_state`, shared by every server instance, so data survives restarts and deploys. The table is created on first use.
- **Otherwise** a file: `data/state.json` locally, `/tmp` on Vercel (lost when the instance is recycled).

Environment variables: `ANTHROPIC_API_KEY` (Claude runs the assistant), `DATABASE_URL` (Postgres), `MERIDIAN_SECRET` (signs session cookies; set a long random value in production), `DEMO_MODE=0` (turns off **Reset demo**).

- **Vercel:** `vercel.json` sends every `/api` request to `api/index.js`, which runs the same Express app; the built pages are served from `dist`. Add the variables under Settings, Environment Variables.
- **Render:** `render.yaml` sets up a web service; add the same variables in its Environment settings.

## Resilience

Inputs are size-capped and cleaned, chat and writes are rate limited per visitor, Claude calls time out after 45 seconds and fall back to the built-in assistant, streams send keep-alives, the page retries while a sleeping server wakes, saves are atomic and grouped, a damaged state file is set aside, and every screen has loading, empty and error states. `GET /api/health` reports uptime and counts.

## Code

`server/index.js` (routes), `server/market.js` (accounts, quotes, alerts, certificates, documents, metrics), `server/whatsapp.js`, `server/auth.js` (demo sessions), `server/store.js` and `server/persist.js` (state), `server/assistant.js`, `server/engine.js` and `server/rag.js` (assistant and search), `data/` (dummy data, enrichment, scenarios, eval briefs), `client/index.html` (landing page, taste-skill kit in `client/public/kit`), `client/src/` (the app).
