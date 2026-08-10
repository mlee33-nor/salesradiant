/**
 * End-to-end against the real server.js — spawned as Railway would run it,
 * then driven by a real browser through the actual form.
 */
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const http = require('http');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP    = 'C:/Users/mleet/desktop/myles/salesradiant';
const PORT   = 8842;
const HOOK   = 8843;
const sleep  = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); ok ? pass++ : fail++; };

let probe = 0;
const post = (path, body, ip) => fetch(`http://127.0.0.1:${PORT}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip || `10.0.0.${++probe}` },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

(async () => {
  // Fake downstream webhook so we can prove forwarding works.
  const received = [];
  const hook = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c);
    req.on('end', () => { received.push(b); res.writeHead(200); res.end('ok'); });
  });
  await new Promise(r => hook.listen(HOOK, '127.0.0.1', r));

  const srv = spawn(process.execPath, ['server.js'], {
    cwd: APP,
    env: { ...process.env, PORT: String(PORT), LEAD_WEBHOOK_URL: `http://127.0.0.1:${HOOK}/hook` },
  });
  const logs = [];
  srv.stdout.on('data', d => logs.push(d.toString()));
  srv.stderr.on('data', d => logs.push('ERR ' + d.toString()));
  await sleep(900);

  // ---------- server surface ----------
  check('health check responds', (await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok);
  check('serves index.html at /', (await (await fetch(`http://127.0.0.1:${PORT}/`)).text()).includes('Cold lead gen'));
  check('serves vendor assets', (await fetch(`http://127.0.0.1:${PORT}/vendor/gsap.min.js`)).ok);
  check('hides server source', (await fetch(`http://127.0.0.1:${PORT}/server.js`)).status === 404);
  check('hides package.json', (await fetch(`http://127.0.0.1:${PORT}/package.json`)).status === 404);
  check('blocks path traversal',
    [403, 404].includes((await fetch(`http://127.0.0.1:${PORT}/../../../Windows/win.ini`)).status));
  check('GET /submit rejected', (await fetch(`http://127.0.0.1:${PORT}/submit`)).status === 405);

  // ---------- validation ----------
  check('missing fields rejected', (await post('/submit', { name: 'x' })).status === 422);
  check('bad email rejected',
    (await post('/submit', { name: 'A', email: 'nope', company: 'C', icp: 'i' })).status === 422);
  check('malformed JSON rejected', (await post('/submit', '{oops')).status === 400);
  check('oversized body rejected',
    (await post('/submit', { name: 'A', email: 'a@b.co', company: 'C', icp: 'x'.repeat(40000) })).status === 413);

  // ---------- honeypot ----------
  const before = received.length;
  const hp = await post('/submit', { name: 'Bot', email: 'b@b.co', company: 'B', icp: 'i', website: 'http://spam' });
  await sleep(250);
  check('honeypot answers 200 but records nothing', hp.status === 200 && received.length === before);

  // ---------- real submit through the browser ----------
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.getElementById('contact').scrollIntoView());
  await sleep(400);

  await page.type('#f-name', 'Dana Whitfield');
  await page.type('#f-email', 'dana@northwind.com');
  await page.type('#f-company', 'Northwind Logistics');
  await page.type('#f-icp', 'VPs of Ops at 200-2,000 person carriers');
  await page.click('.form__submit');
  await sleep(900);

  check('browser submit reaches success state',
    await page.evaluate(() => document.getElementById('lead').classList.contains('is-done')));

  const fwd = received.map(r => { try { return JSON.parse(r); } catch { return {}; } })
                      .find(r => r.email === 'dana@northwind.com');
  check('lead forwarded to webhook', !!fwd, fwd ? JSON.stringify({ ...fwd, ip: '…', ua: '…' }) : 'nothing');
  check('lead written to stdout', logs.join('').includes('dana@northwind.com'));
  check('honeypot value not stored on the lead', fwd && fwd.website === undefined);
  check('no page errors', pageErrors.length === 0, pageErrors.join('; '));

  // ---------- rate limit ----------
  let last = 0;
  for (let i = 0; i < 15; i++) {
    last = (await post('/submit', { name: 'A', email: `a${i}@b.co`, company: 'C', icp: 'i' }, '10.9.9.9')).status;
  }
  check('rate limit kicks in after repeated posts', last === 429, `last status ${last}`);

  await browser.close();
  srv.kill();
  hook.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
