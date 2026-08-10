/**
 * SalesRadiant — static server + lead endpoint.
 *
 * Zero dependencies; Node 18+ only (uses the built-in fetch).
 * Railway detects this via package.json and runs `npm start`.
 *
 * Routes
 *   GET  /            index.html
 *   GET  /healthz     liveness probe
 *   POST /submit      lead form
 *
 * WHERE LEADS GO
 *   Every accepted lead is written to stdout, which on Railway means the
 *   deploy logs — searchable, but rotated and NOT a durable store.
 *   Set LEAD_WEBHOOK_URL for anything you actually rely on. It accepts any
 *   endpoint taking a JSON POST: a Zapier/Make catch hook, a Slack incoming
 *   webhook, your CRM. Without it, a lead lives only in the logs.
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT    = process.env.PORT || 3000;
const ROOT    = __dirname;
const WEBHOOK = (process.env.LEAD_WEBHOOK_URL || '').trim();

const MAX_BODY   = 16 * 1024;   // a 4-field form is ~1kB; anything larger is noise
/* Every POST counts, including ones rejected for bad input — that's the
   point, since abuse looks like a stream of malformed posts. Set high
   enough that a real person retrying a few times never notices. */
const RATE_MAX   = 12;          // posts per window, per IP
const RATE_WIN   = 10 * 60_000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------- rate limit

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > RATE_WIN) {
    hits.set(ip, { start: now, n: 1 });
    return false;
  }
  rec.n += 1;
  return rec.n > RATE_MAX;
}

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const cutoff = Date.now() - RATE_WIN;
  for (const [ip, rec] of hits) if (rec.start < cutoff) hits.delete(ip);
}, RATE_WIN).unref();

// ---------------------------------------------------------------- helpers

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(body);
};

const json = (res, code, obj) => send(res, code, JSON.stringify(obj), TYPES['.json']);

/* Strip control characters (they corrupt log lines and JSON consumers),
   collapse whitespace runs, then cap the length. Done by codepoint rather
   than a regex literal so no raw control bytes end up in this source. */
const clean = (v, max) => {
  let out = '';
  for (const ch of String(v == null ? '' : v)) {
    const c = ch.codePointAt(0);
    out += (c < 32 || c === 127) ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fail = (code, msg) => Object.assign(new Error(msg), { code });

/* Reads the body with a size cap. Over the cap we stop buffering but keep
   draining, so the client still receives a real 413 — destroying the socket
   mid-upload gives them a connection reset with no explanation instead.
   A client streaming far past the cap is treated as abusive and cut off. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const HARD = MAX_BODY * 64;
    let size = 0, over = false;
    const chunks = [];

    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) {
        over = true;
        chunks.length = 0;
        if (size > HARD) req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => over
      ? reject(fail('TOO_LARGE', 'body too large'))
      : resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('aborted', () => reject(fail('ABORTED', 'client went away')));
    req.on('error', err => reject(Object.assign(err, { code: err.code || 'STREAM' })));
  });
}

// ---------------------------------------------------------------- lead route

async function handleSubmit(req, res, ip) {
  if (rateLimited(ip)) return json(res, 429, { error: 'Too many submissions. Try again shortly.' });

  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    if (err.code === 'ABORTED' || res.writableEnded) return;  // nobody left to answer
    return json(res, err.code === 'TOO_LARGE' ? 413 : 400,
      { error: err.code === 'TOO_LARGE' ? 'That was too long — keep it under a few paragraphs.' : 'Could not read that.' });
  }

  let data;
  try { data = JSON.parse(raw || '{}'); }
  catch { return json(res, 400, { error: 'Expected JSON.' }); }

  /* Honeypot: a hidden field no human sees. Respond 200 so the bot moves on,
     but record nothing. */
  if (clean(data.website, 200)) {
    console.log(JSON.stringify({ evt: 'lead.bot', at: new Date().toISOString(), ip }));
    return json(res, 200, { ok: true });
  }

  const lead = {
    name:    clean(data.name, 120),
    email:   clean(data.email, 200),
    company: clean(data.company, 160),
    icp:     clean(data.icp, 1200),
  };

  const missing = Object.entries(lead).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length)      return json(res, 422, { error: 'Missing: ' + missing.join(', ') });
  if (!EMAIL.test(lead.email)) return json(res, 422, { error: 'That email address looks wrong.' });

  const record = {
    evt: 'lead',
    at: new Date().toISOString(),
    ...lead,
    ua: clean(req.headers['user-agent'], 200),
    ip,
  };

  // stdout first, so the lead survives even if the webhook is down.
  console.log(JSON.stringify(record));

  if (WEBHOOK) {
    try {
      const ctl = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
      const r = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
        signal: ctl,
      });
      if (!r.ok) console.error('lead.webhook non-2xx', r.status);
    } catch (err) {
      // Already logged above, so don't fail the visitor's submit over this.
      console.error('lead.webhook failed:', err.message);
    }
  }

  return json(res, 200, { ok: true });
}

// ---------------------------------------------------------------- static

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);

  // Never serve outside the app directory, or the server's own source.
  if (!file.startsWith(path.resolve(ROOT) + path.sep) && file !== path.resolve(ROOT, 'index.html')) {
    return send(res, 403, 'Forbidden');
  }
  if (/^(server\.js|package(-lock)?\.json|build-preview\.js|\.git)/i.test(rel)) {
    return send(res, 404, 'Not found');
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------- server

const server = http.createServer((req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket.remoteAddress || 'unknown';

  let pathname;
  try { pathname = new URL(req.url, 'http://x').pathname; }
  catch { return send(res, 400, 'Bad request'); }

  if (pathname === '/healthz') return json(res, 200, { ok: true });

  if (pathname === '/submit') {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, 'Method not allowed'); }
    return handleSubmit(req, res, ip).catch(err => {
      console.error('submit error:', err);
      json(res, 500, { error: 'Something broke on our end.' });
    });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  return serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SalesRadiant listening on ${PORT}`);
  console.log(WEBHOOK
    ? 'Leads: stdout + LEAD_WEBHOOK_URL'
    : 'Leads: stdout only — set LEAD_WEBHOOK_URL for durable delivery');
});

// Railway sends SIGTERM on redeploy; finish in-flight requests first.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
