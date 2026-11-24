#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JURORS, ask } from './jurors.js';
import { calibrate } from './calibrate.js';
import { aggregate, EXIT } from './aggregate.js';
import { buildReceipt, verifyReceipt } from './receipt.js';
import { sha256 } from './near.js';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[i + 1]); };
const log = (...a) => console.error(...a);
const usage = () => { log(`kanejury judge --claim "<text>" --image <png> [--policy cautious|majority] [--out receipt.json] [--json]
kanejury calibrate [--force]
kanejury verify <receipt.json> [--image <png>] [--online]
Exit codes: 0 pass, 1 fail, 4 inconclusive or no quorum, 2 could not run. Needs NEAR_AI_API_KEY.`); process.exit(2); };

async function main() {
  if (cmd === 'calibrate') {
    const c = await calibrate(DEFAULT_JURORS, { force: !!flag('force', false) });
    for (const [id, j] of Object.entries(c.jurors)) log(`${j.eligible ? 'ELIGIBLE  ' : 'EXCLUDED  '} ${id.padEnd(10)} ${j.model}  true->${j.onTrue ?? j.error}  false->${j.onFalse ?? ''}`);
    log(c.cached ? '(cached calibration)' : '(fresh calibration)'); return;
  }
  if (cmd === 'judge') {
    const claim = flag('claim'), imagePath = flag('image');
    if (!claim || !imagePath || claim === true || imagePath === true) usage();
    const policy = flag('policy', 'cautious'), image = fs.readFileSync(imagePath);
    const mime = /\.jpe?g$/i.test(imagePath) ? 'image/jpeg' : 'image/png';
    const cal = await calibrate(DEFAULT_JURORS, {});
    log(`calibration (${cal.cached ? 'cached' : 'fresh'}, ${cal.takenAt}): ` + Object.entries(cal.jurors).map(([k, j]) => `${k}=${j.eligible ? 'ok' : 'EXCLUDED'}`).join(' '));
    const votes = await Promise.all(DEFAULT_JURORS.map(async (j) => {
      try { return { ...(await ask(j, claim, image, mime)), eligible: !!cal.jurors[j.id]?.eligible }; }
      catch (e) { return { juror: j.id, model: j.model, verdict: 'error', quote: e.message.slice(0, 120), eligible: !!cal.jurors[j.id]?.eligible }; }
    }));
    const result = aggregate(votes.map(({ juror, verdict, eligible }) => ({ juror, verdict, eligible })), { policy });
    const receipt = buildReceipt({ claim, evidence: [{ name: path.basename(imagePath), sha256: sha256(image), mime }], policy, calibration: cal, votes, result });
    const out = flag('out', 'receipt.json'); fs.writeFileSync(out, JSON.stringify(receipt, null, 2));
    if (flag('json', false)) console.log(JSON.stringify(result));
    for (const v of votes) log(`  ${v.eligible ? ' ' : 'x'} ${v.juror.padEnd(10)} ${String(v.verdict).padEnd(13)} ${v.quote ? '"' + v.quote.slice(0, 70) + '"' : ''}`);
    log(`VERDICT ${result.verdict.toUpperCase()}  (${result.reason}; agree ${result.agree}/${result.of}${result.dissent.length ? '; dissent ' + result.dissent.map((d) => d.juror + ':' + d.verdict).join(',') : ''})`);
    log(`receipt: ${out}`); process.exit(EXIT[result.verdict] ?? 2);
  }
  if (cmd === 'verify') {
    const file = argv.find((a) => !a.startsWith('--') && a.endsWith('.json')); if (!file) usage();
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    const res = await verifyReceipt(r, { imagePath: typeof flag('image') === 'string' ? flag('image') : null, online: !!flag('online', false) });
    for (const c of res.checks) log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.what}`);
    log(res.ok ? 'RECEIPT OK' : 'RECEIPT NOT VERIFIED'); process.exit(res.ok ? 0 : 1);
  }
  usage();
}
main().catch((e) => { log('error:', e.message); process.exit(2); });
