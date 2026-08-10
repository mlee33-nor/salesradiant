# SalesRadiant

Marketing site for SalesRadiant — fractional sales and cold outbound for mid-market
and early-stage B2B companies.

Single self-contained file. No build step, no dependencies, no external requests.
`index.html` carries its own CSS, JS, and favicon.

## Run it

Open `index.html` in a browser. That's it.

## Deploy it

Any static host works, since there's nothing to build:

- **GitHub Pages** — Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
- **Netlify / Vercel / Cloudflare Pages** — drag the folder in, or point at this repo. Leave the build command empty and set the output directory to the repo root.

## Before you send traffic to it

Everything below is marked with a `SWAP:` comment in `index.html`.

| What | Where | Currently |
|---|---|---|
| Booking link | `#contact` primary button | `mailto:` — point it at Calendly / Cal.com / HubSpot |
| Contact email | `.contact__cell` + both CTA buttons | `mylesdrewbiz@gmail.com` — swap for a business address |
| Phone number | `.contact__cell` | "Available on request" — add a number or delete the cell |

Also worth a pass:

- **The tally.** The hero graphic draws 407 marks, one per meeting booked. The real
  number lives in `index.html` as `TOTAL_GROUPS` / `PARTIAL_LAST` near the bottom of
  the script — 82 groups of five, the last one holding 2. Update both when the
  count moves, and keep the `400+` stat tile in sync.
- **Client names.** ChurnZero, Barrett Financial, and AMI Strategies are set in
  plain type, not logos. If you want to use their marks, get written permission
  first — most vendor agreements restrict logo use.
- **Stats band.** Four tiles: meetings, industries, channels, headcount. Numbers are
  hardcoded in the `.stats` block.

## Design notes

- **Color** — cool slate neutrals with a single deep amber accent (`#C77A0A` light,
  `#F0A62B` dark). Amber-on-slate is an instrument-panel pairing; it's the only
  saturated color on the page, so it always means "look here."
- **Type** — system grotesque for display, set tight and heavy. A monospace stack
  carries every label, stat, and data row — the "dial sheet" texture. No webfonts,
  so nothing can silently fall back or block on a CDN.
- **Layout** — a field-log spine: a narrow monospace margin column with the section
  index and label, beside a wide content column. Collapses to a single column
  under 60rem.
- **Themes** — light, dark, and the unstamped system default all resolve from the
  same token set. Every color is defined on bare `:root` first and only
  *redefined* inside the dark blocks, so no component can end up with a color that
  exists in one theme and not the other.
- **Motion** — one orchestrated moment: the tally draws in over 1.3s when it first
  scrolls into view. Everything else is hover states. Honors
  `prefers-reduced-motion`.
