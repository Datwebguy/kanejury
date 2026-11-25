// Builds the static site in docs/: bundles the receipt verifier for browsers and generates docs/assets/data.js from the real result files.
import fs from 'node:fs';
import { build } from 'esbuild';

await build({ entryPoints: ['src/verify-core.js'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: 'docs/assets/verify.js' });
await build({ entryPoints: ['src/browser.js'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: 'docs/assets/kanejury.js' });

const parseCsv = (text) => { const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows; };
const [head, ...body] = parseCsv(fs.readFileSync('bench/results.csv', 'utf8'));
const runs = body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
const loop = JSON.parse(fs.readFileSync('demo/results/run3-full-loop.json', 'utf8'));
const patch = fs.readFileSync('demo/results/run3-agent-patch.diff', 'utf8');
fs.writeFileSync('docs/assets/data.js', `export const RUNS = ${JSON.stringify(runs)};\nexport const LOOP = ${JSON.stringify(loop)};\nexport const PATCH = ${JSON.stringify(patch)};\n`);
fs.copyFileSync('examples/receipt-fail.json', 'docs/assets/receipt-fail.json');
fs.copyFileSync('examples/evidence-fail.png', 'docs/assets/evidence-fail.png');
fs.mkdirSync('docs/assets/packs', { recursive: true });
for (const f of fs.readdirSync('examples/packs')) if (f.endsWith('.evidence')) fs.copyFileSync(`examples/packs/${f}`, `docs/assets/packs/${f}`);
fs.writeFileSync('docs/.nojekyll', '');
console.log(`site assets built: ${runs.length} runs, ${loop.rounds.length} loop rounds`);
