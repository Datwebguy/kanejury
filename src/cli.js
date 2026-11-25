#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JURORS, ask } from './jurors.js';
import { calibrate } from './calibrate.js';
import { aggregate, EXIT } from './aggregate.js';
import { buildReceipt, verifyReceipt } from './receipt.js';
import { sha256 } from './near.js';
import { loadPack, pickScreenshot, classifyFailure, coverageGaps } from './evidence.js';
import { snapshotTests, compareSnapshots, tamperReasons, protectList, saveSnapshot, loadSnapshot } from './guard.js';
import { gatePack, EXIT as GATE_EXIT } from './gate-pack.js';
import { loop } from './loop.js';
import { runJury } from './judge.js';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[i + 1]); };
const log = (...a) => console.error(...a);
const usage = (why) => { log(`${why ? why + '\n\n' : ''}KaneJury: know when to trust a Kane CLI result.

No key needed:
  kanejury gate <run.evidence>                 decide: allow (0) | fix (1) | rerun (4) | recheck or review (5)
  kanejury guard snapshot [--protect <paths>]  fingerprint the tests before a coding agent works
  kanejury guard check                         0 if unchanged, 5 if a protected test was edited or deleted
  kanejury verify <receipt.json> [--image <png>] [--online]   0 verified, 1 not verified
  kanejury loop --objective "<what Kane does>" --url <start url> --agent "<command>"   (needs kane-cli)

With NEAR_AI_API_KEY (vision jury and signed receipts):
  kanejury gate <run.evidence> --claim "<text>"
  kanejury judge-pack <run.evidence> --claim "<text>" [--step last|<n>] [--out receipt.json]
  kanejury judge --claim "<text>" --image <png> [--out receipt.json]
  kanejury calibrate [--force]
  judge exit codes: 0 pass, 1 fail, 4 inconclusive or no quorum

Any command: 2 means it could not run.`); process.exit(2); };

async function main() {
  if (cmd === 'calibrate') {
    const c = await calibrate(DEFAULT_JURORS, { force: !!flag('force', false) });
    for (const [id, j] of Object.entries(c.jurors)) log(`${j.eligible ? 'ELIGIBLE  ' : 'EXCLUDED  '} ${id.padEnd(10)} ${j.model}  true->${j.onTrue ?? j.error}  false->${j.onFalse ?? ''}`);
    log(c.cached ? '(cached calibration)' : '(fresh calibration)'); return;
  }
  if (cmd === 'judge' || cmd === 'judge-pack') {
    const claim = flag('claim');
    let imagePath, image, mime, evName;
    if (cmd === 'judge-pack') {
      const packFile = argv.find((a) => a.endsWith('.evidence')); if (!packFile) usage('judge-pack needs a .evidence file.'); if (!claim || claim === true) usage('judge-pack needs --claim "<what should be true on screen>".');
      const pack = loadPack(packFile);
      const cf = classifyFailure(pack);
      if (cf.kind === 'infrastructure') { log(`KANE FAILURE IS INFRASTRUCTURE, NOT A VERDICT ON THE CLAIM: ${cf.why}\nNo model was called. Re-run Kane; do not send this to the coding agent.`); if (flag('json', false)) console.log(JSON.stringify({ verdict: 'no_evidence', reason: cf.why })); process.exit(4); }
      let pick; try { pick = pickScreenshot(pack, 0, flag('step', 'last')); } catch (e) { log(`NO USABLE EVIDENCE: ${e.message}`); process.exit(4); }
      image = pick.image; mime = pick.mime; imagePath = `${path.basename(packFile)}#step${pick.step}.jpg`; evName = imagePath;
      log(`pack: "${pack.title}" kane status=${pack.tests[0]?.status}; judging step ${pick.step} of ${pick.total} screenshots`);
    } else {
      imagePath = flag('image'); if (!claim || !imagePath || claim === true || imagePath === true) usage();
      image = fs.readFileSync(imagePath); mime = /\.jpe?g$/i.test(imagePath) ? 'image/jpeg' : 'image/png'; evName = path.basename(imagePath);
    }
    const policy = flag('policy', 'cautious');
    const cal = await calibrate(DEFAULT_JURORS, {});
    log(`calibration (${cal.cached ? 'cached' : 'fresh'}, ${cal.takenAt}): ` + Object.entries(cal.jurors).map(([k, j]) => `${k}=${j.eligible ? 'ok' : 'EXCLUDED'}`).join(' '));
    const votes = await Promise.all(DEFAULT_JURORS.map(async (j) => {
      try { return { ...(await ask(j, claim, image, mime)), eligible: !!cal.jurors[j.id]?.eligible }; }
      catch (e) { return { juror: j.id, model: j.model, verdict: 'error', quote: e.message.slice(0, 120), eligible: !!cal.jurors[j.id]?.eligible }; }
    }));
    const result = aggregate(votes.map(({ juror, verdict, eligible }) => ({ juror, verdict, eligible })), { policy });
    const receipt = buildReceipt({ claim, evidence: [{ name: evName, sha256: sha256(image), mime }], policy, calibration: cal, votes, result });
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
  if (cmd === 'gate') {
    const packFile = argv.find((a) => a.endsWith('.evidence')); if (!packFile) usage('gate needs a .evidence file, for example: kanejury gate examples/packs/round1.evidence');
    const claim = flag('claim');
    const g = await gatePack(packFile, { claim: typeof claim === 'string' ? claim : undefined, cacheFile: '.kanejury/calibration.json' });
    if (flag('json', false)) console.log(JSON.stringify(g));
    log(`KANE ${String(g.kane_status).toUpperCase()} -> ${g.action.toUpperCase()}\n  ${g.reasons.join('\n  ')}`);
    process.exit(GATE_EXIT[g.action]);
  }
  if (cmd === 'guard') {
    const sub = argv[0], file = typeof flag('baseline') === 'string' ? flag('baseline') : '.kanejury-baseline.json';
    const protect = protectList(typeof flag('protect') === 'string' ? flag('protect') : process.env.KANEJURY_PROTECT);
    if (sub === 'snapshot') { const snap = snapshotTests(process.cwd(), protect); saveSnapshot(file, snap); log(`fingerprinted ${Object.keys(snap.files).length} test file(s) under ${protect.join(', ')} -> ${file}`); process.exit(0); }
    if (sub === 'check') {
      if (!fs.existsSync(file)) { log(`no baseline at ${file}; run: kanejury guard snapshot`); process.exit(2); }
      const base = loadSnapshot(file); const diff = compareSnapshots(base, snapshotTests(process.cwd(), base.protect || protect));
      if (flag('json', false)) console.log(JSON.stringify(diff));
      if (!diff.tampered) { log(`TESTS UNCHANGED${diff.added.length ? ` (${diff.added.length} new test file(s) added)` : ''}`); process.exit(0); }
      log(`TESTS CHANGED -> REVIEW\n  ${tamperReasons(diff).join('\n  ')}`); process.exit(GATE_EXIT.review);
    }
    usage();
  }
  if (cmd === 'loop') {
    const objective = flag('objective'), url = flag('url'), agent = flag('agent');
    if ([objective, url, agent].some((x) => !x || x === true)) usage();
    const claim = flag('claim');
    const res = await loop({ objective, url, agent, claim: typeof claim === 'string' ? claim : null, maxFixes: Number(flag('max-fixes', 3)), maxReruns: Number(flag('max-reruns', 2)), log });
    fs.writeFileSync(flag('out', 'loop.json'), JSON.stringify(res, null, 2));
    const credits = res.rounds.reduce((s, r) => s + (r.credits || 0), 0);
    log(`OUTCOME ${res.outcome.toUpperCase()}${res.reason ? ' (' + res.reason + ')' : ''} after ${res.rounds.length} Kane run(s), ${Math.round(credits * 10) / 10} credits. log: ${flag('out', 'loop.json')}`);
    process.exit(res.outcome === 'allowed' ? 0 : res.outcome === 'error' ? 2 : 5);
  }
  usage();
}
main().catch((e) => { log('error:', e.code === 'ENOENT' ? `file not found: ${e.path}` : e.message); process.exit(2); });
