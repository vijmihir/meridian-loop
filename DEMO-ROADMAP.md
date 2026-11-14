# What to add to complete the Meridian Loop demo

Ordered by how much each item improves a live pitch. "Effort" is a rough guess for one developer.

## Before you present (highest impact)

| # | Add | Why it matters | Effort |
|---|---|---|---|
| 1 | **Turn on Claude** (`ANTHROPIC_API_KEY` in `.env`) and rehearse the five demo questions | Answers become fluent and handle follow-up questions the built-in engine can't | 1 hour |
| 2 | **Put it on a public URL** (Render, Railway or Fly.io) | Judges and partners can open it on their own phones after the pitch | Half a day |
| 3 | **Real photographs**: product shots and one factory or artisan photo from a pilot partner | Replaces the library stand-in and the fabric swatch cards; the page feels real | Depends on partners |
| 4 | **A 60-second walkthrough video** of the three-step loop | A safety net if the wifi fails, and something to send after the meeting | Half a day |
| 5 | **Sustainable India's five designer labels** (No Nasties, Doodlage, Maati, Upasana, Naari) as real brand profiles, *with their permission* | Turns fictional demo data into the team's own network | 1 to 2 days, plus outreach |

## Make the core loop complete

| # | Add | Why it matters | Effort |
|---|---|---|---|
| 6 | ~~**PDF certificate upload**~~ **Done:** drag-and-drop PDFs, read locally or by Claude, originals kept on the profile | Factories have PDFs, not text | Done |
| 7 | ~~**Issuer checks**~~ **Done for the demo:** every certificate checked against a stand-in register, with links to each issuer’s real lookup. **Still to do:** replace the stand-in with real issuer data (partner feeds, data-sharing agreements, or APIs where offered) | Moves "read from the document" to "confirmed with the issuer", which is the real moat | Demo done; real feeds depend on partners |
| 8 | ~~**Sign-in with roles**~~ **Done:** brand, manufacturer, shopper and team accounts, sign-up with new profiles, role checks on every server route, one-click demo sign-in | Needed for anything beyond a demo | Done |
| 9 | ~~**Email notifications**~~ **Done:** quote requests, proposals, replies and a daily certificate check, previewed in the app and sent for real once SMTP is set | Closes the loop without people having to log in | Done |
| 10 | **Checkout in the shop** (cart and Stripe in test mode); "Add to bag" is a stub today | Shows the B2C revenue line working end to end | 2 days |
| 11 | **A QR code on each product passport**, scannable from a swing tag | Makes the Digital Product Passport story physical; great on stage | Half a day |

## Bring Sustainable India fully in

| # | Add | Why it matters | Effort |
|---|---|---|---|
| 12 | **Point the Sustainable India domain at the Meridian Loop shop**, with a "now part of Meridian Loop" note | One brand story instead of two sites | Half a day |
| 13 | **Move its blog posts into a Journal section** ("Green brands have a head start…", the designers' dos and don'ts) | Reuses content you already have; good for search | Half a day |
| 14 | **Carry over its shop categories** (tops, pants, skirts, shorts, dresses) and the fabric makers it listed (biodegradable fabric, organic fabric, waste cotton) as real profiles | Continuity for existing visitors | 1 day |
| 15 | **Merge its mailing list** into one sign-up | Keeps the audience it already built | 1 hour |

## Strengthen the business case on screen

| # | Add | Why it matters | Effort |
|---|---|---|---|
| 16 | **Pricing page** (what brands and manufacturers pay) | Investors will ask; there are no prices on the site today | Half a day, once decided |
| 17 | **Pilot results**: real numbers only, such as sourcing time saved or quotes sent, once you have them | Proof beats claims; nothing invented | After the pilot |
| 18 | **Partner quotes and logos**, with permission | Social proof from the HKSTP pilot | After the pilot |
| 19 | **Brand dashboard**: spend, suppliers and footprint across all orders | Shows the "data intelligence loop" from the deck | 2 to 3 days |
| 20 | **Carbon method note** explaining how the CO₂e and water figures are estimated | Stops the first hard question from a sustainability expert | Half a day |

## Production readiness (after the pitch)

| # | Add | Why it matters | Effort |
|---|---|---|---|
| 21 | **A real database** (Postgres) instead of the JSON file | Data survives restarts and many users | 1 to 2 days |
| 22 | **Vector search** (embeddings) alongside the keyword search | Scales past a few thousand documents | 1 to 2 days |
| 23 | **Admin review queue** for uploaded documents | A person approves before a certificate counts | 1 day |
| 24 | **Languages**: Hindi, Vietnamese, Bahasa Indonesia, Chinese for the manufacturer portal | Makers are more comfortable in their own language | 2 to 3 days with Claude |
| 25 | **Privacy policy and terms**, plus an accessibility and speed check | Required before real users | 1 day |
