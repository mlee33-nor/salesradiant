# SalesRadiant

Marketing site for SalesRadiant — fractional sales and cold lead gen for mid-market
and early-stage B2B companies.

A static page plus a tiny zero-dependency Node server that captures leads.
Deploys to Railway as-is.

## Run it locally

```
npm start          # http://localhost:3000
```

No install step — `dependencies` is empty on purpose.

## Deploy to Railway

1. New Project → Deploy from GitHub repo → pick this repo.
2. Nothing to configure. `railway.json` sets the builder, start command, and a
   `/healthz` check; Nixpacks detects Node from `package.json` and runs `npm start`.
3. Settings → Networking → **Generate Domain**.
4. Set `LEAD_WEBHOOK_URL` (see below) before you send traffic.

The server binds `0.0.0.0` on Railway's `$PORT` and handles `SIGTERM` so
redeploys drain cleanly.

### Where leads actually go

**Read this before launching.** Every accepted lead is written to stdout — on
Railway that's the deploy logs, which are searchable but rotate and are **not a
durable store.** Treat logs as a backstop, not a CRM.

Set one variable and leads get delivered somewhere real:

```
LEAD_WEBHOOK_URL = https://hooks.zapier.com/hooks/catch/…
```

Any endpoint accepting a JSON POST works — a Zapier or Make catch hook, a Slack
incoming webhook, your CRM's inbound URL. The payload:

```json
{ "evt": "lead", "at": "…", "name": "…", "email": "…",
  "company": "…", "icp": "…", "ua": "…", "ip": "…" }
```

If the webhook is down the visitor still gets a success response, because the lead
was already logged — a delivery problem on your side shouldn't look like a broken
form on theirs.

### Other hosts

Any static host also works if you drop the lead endpoint: serve `index.html` and
`vendor/`, and set `data-endpoint=""` on the form so it falls back to composing a
mail draft. `node build-preview.js` writes a single self-contained HTML file with
every library inlined, for hosts that take one upload.

## The lead form

Four fields: name, work email, company, who you sell to. Validates on blur; once a
field is flagged it re-checks on every keystroke, so the error clears when it's
fixed rather than on the next blur. On success it POSTs JSON to `/submit` and fires
confetti.

If the POST fails it does **not** fake success — the button comes back and the
message points at the email address. If `data-endpoint` is emptied entirely, a valid
submit composes a mail draft instead, so a lead is never silently dropped.

**Anti-spam** is a honeypot field (`website`) positioned off-screen and skipped in
tab order. The server accepts those posts and discards them, so bots think they
succeeded. No CAPTCHA for real visitors to solve. There's also a per-IP rate limit
of 12 posts per 10 minutes, counting rejected posts too — abuse looks like a stream
of malformed submissions.

## Tests

```
npm i -D puppeteer-core          # not a runtime dependency; nothing ships with it
node test/server.test.js
```

18 assertions against the real server, driven by a real browser: health check,
static serving, `server.js` and `package.json` not exposed, path traversal blocked,
`GET /submit` rejected, missing fields / bad email / malformed JSON / oversized body
all rejected with the right status, honeypot accepted-but-discarded, a full browser
submit reaching the success state, the lead forwarded to a webhook and written to
stdout, and the rate limit engaging.

The browser tests need Chrome; the path is set at the top of the file.

## Content notes

- `400+ / 12+ / 0` live in `data-count` attributes — CountUp reads them, so each
  number has one place to edit.
- The marquee track is listed **twice** so the `-50%` loop is seamless. Anything
  added or removed must go into both halves or the loop jumps.
- One `SWAP:` marker remains, on the pricing FAQ — it describes a flat-retainer
  model with no numbers.

## Libraries

Vendored into `vendor/` rather than loaded from a CDN — one less thing to fail, and
it works on a host with no outbound internet.

| File | Does |
|---|---|
| `lenis.min.js` | Eased scrolling, desktop pointers only |
| `gsap.min.js` + `ScrollTrigger.min.js` | Section reveals |
| `countUp.umd.js` | The three figures ticking up |
| `confetti.browser.min.js` | Fires once on form success |

**Nothing is hidden by CSS.** Entrance states are set by GSAP at runtime, so if a
script fails to load the page still reads top to bottom. An earlier build hid
content in CSS and revealed it with JS — when the script didn't run, every section
below the hero rendered blank. Don't reintroduce that pattern.

Motion is gated on `prefers-reduced-motion`; eased scrolling additionally requires a
fine pointer, since touch momentum beats anything scripted.

## Design notes

- **Color** — stark white/near-black with one electric blue (`#1B3CF5`, lifted to
  `#7C93FF` in dark). The accent appears about four times, so it always means
  "look here."
- **Type** — the whole design. Hero and closing lines are *fit-to-width*: measured
  at a probe size, then scaled so each line spans its container exactly. **Scale is
  controlled by the container's `max-width`, never by a font-size cap** — capping
  makes every line the same size and leaves the right edge ragged, which kills the
  effect.
- **Rows** are three columns (number, heading, body) and **section heads** are two
  (headline beside supporting copy), so content fills the width instead of stacking
  in the left third.
- **Themes** — light, dark, and the unstamped system default resolve from one token
  set. Every color is declared on bare `:root` and only *redefined* in the dark
  blocks. Inverted sections flip with the theme.
