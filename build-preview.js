/**
 * Builds a single-file copy of the site with vendor/*.js inlined.
 *
 * The live site loads the libraries as separate files, which caches better.
 * Some preview hosts block every external and relative request, so this
 * produces one self-contained HTML file that renders anywhere.
 *
 *   node build-preview.js [outfile]
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const out = process.argv[2] || path.join(ROOT, 'salesradiant.standalone.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const missing = [];
html = html.replace(/<script src="(vendor\/[^"]+)"><\/script>/g, (m, src) => {
  const f = path.join(ROOT, src);
  if (!fs.existsSync(f)) { missing.push(src); return m; }
  const js = fs.readFileSync(f, 'utf8');
  // A library containing "</script>" in a string would close the tag early.
  return `<script>/* ${path.basename(src)} */\n${js.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;
});

if (missing.length) {
  console.error('Missing vendor files, not inlined:', missing.join(', '));
  process.exit(1);
}

if (/<script src="/.test(html)) {
  console.error('An external script survived inlining — check the regex.');
  process.exit(1);
}

fs.writeFileSync(out, html);
console.log(`${path.basename(out)}  ${(html.length / 1024).toFixed(0)}kB  (no external requests)`);
