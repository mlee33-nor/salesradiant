# SalesRadiant

Marketing site for SalesRadiant — fractional sales and cold outbound for mid-market
and early-stage B2B companies.

One self-contained file. No build step, no package.json, no external requests.
`index.html` carries its own CSS, JS, and favicon. **39kB total.**

## Run it

Open `index.html` in a browser.

## Deploy it

- **GitHub Pages** — Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
- **Netlify / Vercel / Cloudflare Pages** — drag the folder in, or point at this repo. No build command; output directory is the repo root.

## Before you send traffic to it

Each of these is marked with a `SWAP:` comment in `index.html`.

| What | Where | Currently |
|---|---|---|
| Form endpoint | `<form id="lead" data-endpoint="">` | Empty — see "The lead form" below |
| Contact email | `data-fallback` + the footer link | `mylesdrewbiz@gmail.com` — swap for a business address |

Also worth a pass:

- **The numbers.** `400+ / 3 / 2 / 0` live in `data-count` attributes on the
  `.figure__n` spans. The counter animation reads the attribute, so changing the
  number is enough — no second place to update.
- **Client names.** Set in type, not logos. Get written permission before using
  anyone's actual mark; most vendor agreements restrict it.

## The lead form

Four fields — name, work email, company, who you sell to. Validates on blur, and
once a field is marked bad it re-checks on every keystroke so the error clears the
moment it's fixed rather than on the next blur.

**It works right now with nothing configured:** with `data-endpoint` empty, a valid
submit composes a mail draft with the fields filled in. Nothing gets lost while
you're deciding on a handler.

To collect submissions properly, set `data-endpoint` to a form service and the
script POSTs JSON to it instead — no other change needed:

```html
<form id="lead" data-endpoint="https://formspree.io/f/YOUR_ID" ...>
```

Works as-is with Formspree, Web3Forms, Basin, or any endpoint accepting a JSON POST.
Failed sends restore the button and surface a message pointing at the email address.

## On dependencies

The obvious stack for this kind of page is Lenis + GSAP/ScrollTrigger + CountUp +
a marquee. Everything those would do here is implemented natively, in about 200
lines, for 0kB of dependencies:

| Effect | Instead of | Implementation |
|---|---|---|
| Eased scrolling | Lenis | Lerped wheel handler, ~40 lines |
| Scroll reveals | GSAP + ScrollTrigger | `IntersectionObserver`, ~20 lines |
| Stat counters | CountUp.js | `requestAnimationFrame` + easeOutQuart, ~15 lines |
| Headline reveal | SplitType | CSS `clip-path` keyframes, staggered |

Deliberately left out, and why:

- **Cobe globe** — signals "customers worldwide." Three named US clients; it would
  be a claim the business can't back.
- **Logo marquee** — marquees loop because there are more logos than fit. Looping
  three advertises that there are three. It's a big-type row instead.
- **canvas-confetti** — wrong register for a page whose voice is "I won't book a
  junk meeting to hit a number."
- **Atropos card tilt** — the design has no cards.
- **React Hook Form + Zod** — no React here, and 4 fields don't need a schema layer.

Everything animated is gated on `prefers-reduced-motion`, and eased scrolling
additionally requires a fine pointer — touch keeps native momentum, which beats
anything scripted. Reveals sit behind a `.has-js` class, so the page is fully
readable if the script never runs.

## Design notes

- **Color** — stark white/near-black with one electric blue (`#1B3CF5`, lifted to
  `#7C93FF` in dark). The accent appears about four times on the whole page, so it
  always means "look here."
- **Type** — the entire design. Hero and closing lines are *fit-to-width*: measured
  at a probe size, then scaled so each line spans its container exactly. No
  monospace anywhere; `tabular-nums` handles the figures.
- **Chrome** — almost none. No cards, no boxes, no shadows. Sections are separated
  by space and hairlines.
- **Themes** — light, dark, and the unstamped system default all resolve from one
  token set. Every color is declared on bare `:root` and only *redefined* in the
  dark blocks, so nothing can exist in one theme and vanish in the other. Inverted
  sections flip with the theme, so the stark-contrast device works both ways.
