# SalesRadiant

Marketing site for SalesRadiant — fractional sales and cold lead gen for mid-market
and early-stage B2B companies.

Plain HTML. No build step, no framework, no CDN at runtime. `index.html` plus five
vendored libraries in `vendor/`.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
```

## Deploy it

Static files, so any host works. Point the web root at this folder.

- **Railway** — a static site service, or any image that serves this directory. No build command; no start command beyond a static server.
- **Rails** — drop `index.html` and `vendor/` into `public/` and it serves at `/index.html` with no routing changes.
- **GitHub Pages** — Settings → Pages → branch `main`, folder `/ (root)`.
- **Netlify / Vercel / Cloudflare Pages** — drag the folder in. Build command empty, output directory the repo root.

`vendor/` must ship with `index.html` — the script tags are relative paths.

### Single-file build

`node build-preview.js` writes `salesradiant.standalone.html` with every library
inlined — one file, zero requests, for hosts that only take a single upload.

## Before you send traffic to it

Marked with `SWAP:` comments in `index.html`.

| What | Where | Currently |
|---|---|---|
| Form endpoint | `<form id="lead" data-endpoint="">` | Empty — falls back to a mail draft |
| Contact email | `data-fallback` + footer link | `mylesdrewbiz@gmail.com` |
| Industries 04–12 | `.inds` grid | **Unverified — see below** |
| Pricing answer | last FAQ item | Describes a retainer model, no numbers |

**The industries grid needs your eyes.** Only the first three tie to a named client
(B2B SaaS → ChurnZero, mortgage → Barrett Financial, telecom expense → AMI
Strategies). I filled 04–12 with plausible B2B verticals so the layout was real,
but I have no evidence you've sold into them. A buyer will ask about their own
vertical on the first call, so replace anything you haven't actually worked.

The `400+ / 12+ / 0` figures live in `data-count` attributes — CountUp reads them,
so each number has exactly one place to edit.

## The lead form

Four fields: name, work email, company, who you sell to. Validates on blur; once a
field is flagged it re-checks on every keystroke, so the error clears when it's
fixed rather than on the next blur.

**Works with nothing configured** — a valid submit composes a mail draft with the
fields filled in, so no lead is lost before you pick a handler.

To collect properly, set the endpoint:

```html
<form id="lead" data-endpoint="https://formspree.io/f/YOUR_ID" ...>
```

It then POSTs JSON. Works with Formspree, Web3Forms, Basin, or anything accepting a
JSON POST. A failed send restores the button and points at the email address rather
than silently pretending to have worked.

Verified by `pp/form.js` in the scratchpad (12 assertions): empty submit blocked
with one error per field, no POST while invalid, malformed email rejected, error
clears live while typing, valid submit POSTs all four fields and reaches the success
state, confetti fires, and a 500 restores the button instead of faking success.

## Libraries

Vendored into `vendor/` rather than loaded from a CDN — one less thing to fail, and
it works on a host with no outbound internet.

| File | Does |
|---|---|
| `lenis.min.js` | Eased scrolling. Desktop pointers only |
| `gsap.min.js` + `ScrollTrigger.min.js` | Section reveals |
| `countUp.umd.js` | The three figures ticking up |
| `confetti.browser.min.js` | Fires once on form success |

**Nothing is hidden by CSS.** Entrance states are set by GSAP at runtime, so if a
script fails to load the page still reads top to bottom. An earlier build hid
content in CSS and revealed it with JS — when the script didn't run, every section
below the hero rendered blank. Don't reintroduce that pattern.

Motion is gated on `prefers-reduced-motion`; eased scrolling additionally requires
a fine pointer, since touch momentum beats anything scripted.

## Design notes

- **Color** — stark white/near-black with one electric blue (`#1B3CF5`, lifted to
  `#7C93FF` in dark). The accent appears about four times, so it always means
  "look here."
- **Type** — the whole design. Hero and closing lines are *fit-to-width*: measured
  at a probe size, then scaled so each line spans its container exactly. **Scale is
  controlled by the container's `max-width`, never by a font-size cap** — capping
  makes every line the same size and leaves the right edge ragged, which kills the
  effect.
- **Section heads** are two-column (headline beside supporting copy) rather than a
  narrow stacked column. Fills the width and costs far less height.
- **Themes** — light, dark, and the unstamped system default resolve from one token
  set. Every color is declared on bare `:root` and only *redefined* in the dark
  blocks. Inverted sections flip with the theme.
- **Marquee** — the track is listed twice so the `-50%` loop is seamless. Anything
  added or removed must go into both halves or the loop will jump.
