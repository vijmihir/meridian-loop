# Meridian Loop

A sourcing assistant that connects sustainable clothing brands with manufacturers across Asia.

You talk to it in plain words, in either direction:

- **Brands** say what they want made ("organic cotton T-shirts, about 500 units"). The assistant searches every manufacturer, lists the ones that fit with each requirement checked, and asks about whatever is missing: quantity, certification, country.
- **Manufacturers** say what they make ("organic cotton babywear"). The assistant finds brands whose open requests match.

It keeps your brief across the conversation ("only GOTS", "only in India"), answers follow-ups about the companies it showed ("tell me more about the first one", "how do I contact them?", "compare the top 3"), explains terms like GOTS or MOQ, and cites the profile lines it used. The directory and a listing form sit alongside it.

Meridian Loop grew out of [Sustainable India](https://srishtipal86.wixsite.com/sustainableindia) (2019), which set out to be "the bridge between the manufacturers and the designers".

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

## How the assistant works

The assistant is retrieval-augmented: it only says what the search returns.

- **With an API key** (`ANTHROPIC_API_KEY` in `.env`, or in your host's environment), Claude runs each turn. It calls tools over the search index (`search_manufacturers`, `search_brands`, `get_company`, `compare_manufacturers`) and ends each reply with suggested replies. Its text streams to the page as it writes.
- **Without a key**, a built-in assistant runs the same conversation: it reads the request, keeps the brief between turns, asks a question when the brief is too thin, and builds its suggested replies from the results. If a Claude request fails before it starts replying, the built-in assistant answers instead, so the demo never breaks.

Both stream the same events to the page: text, a list of matches, a company card, a comparison table and suggested replies.

## How the search works

1. **Index.** Each profile is split into short passages (about, materials and terms, certifications, each open request).
2. **Read the request.** Countries, certifications, minimum order and lead time are picked out of the plain-English request.
3. **Retrieve.** Keyword search over words and phrases, plus spelling-tolerant matching and textile synonyms (rPET means recycled polyester, "waste cotton" means recycled cotton).
4. **Rank.** Companies are ranked by how well their passages match, and whether they meet each stated requirement.
5. **Answer.** The reply names the best fits and cites the numbered passages.

Code: `server/assistant.js` (the assistant, with Claude and built-in modes), `server/rag.js` (retrieval), `server/engine.js` (ranking), `server/store.js` (companies), `data/seed.js` (demo data), `client/src/Chat.jsx` (the conversation), `client/src/` (the rest of the site). `POST /api/chat` streams a turn; `POST /api/search` is the plain search underneath.

## Demo in two minutes

1. Open the site and pick **I'm a brand**. Tap *Organic cotton T-shirts, about 500 units*. Point out the match sheet: each manufacturer with its minimum order, lead time and a ✓ against each requirement, and the numbered sources under it.
2. Tap **Only GOTS certified**, then type *only in India*. The brief narrows and keeps everything said before.
3. Tap **Tell me more about Kaveri Organic Knits**, then type *how do I contact them?*, then *compare the top 3*.
4. Ask *what is GOTS?*, then something off topic, to show it stays on sourcing.
5. Click **New conversation**, pick **I'm a manufacturer** and type *we make organic cotton babywear*. Brands looking for it come back.
6. Optional: under **List your company**, add a manufacturer (say, a linen workshop in Hue), then ask the assistant for *linen shirts in Vietnam*.

Click **Reset demo** in the footer of the Directory or Join page to remove companies added during a demo.

## Hosting

`render.yaml` sets up a free web service on [Render](https://render.com). Pushing to GitHub redeploys it. On the free plan the site sleeps after 15 minutes idle (the first visit then takes about 50 seconds), and companies added through the site reset on each restart. To have Claude run the assistant online, add `ANTHROPIC_API_KEY` under the service's Environment settings on Render.

The earlier, larger version of this demo is kept in git as the tag `v1-full-platform`.
