#!/usr/bin/env node
// KaneJury as an MCP server (stdio, JSON-RPC 2.0, one message per line). No dependencies.
import fs from 'node:fs';
import readline from 'node:readline';
import { loadPack, pickScreenshot, classifyFailure, coverageGaps, postActionInputs } from './evidence.js';
import { gatePack } from './gate-pack.js';
import { runJury } from './judge.js';
import { verifyReceipt } from './receipt.js';
import { snapshotTests, compareSnapshots, tamperReasons, protectList, saveSnapshot, loadSnapshot } from './guard.js';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const str = (d) => ({ type: 'string', description: d });
export const TOOLS = [
  { name: 'kanejury_inspect_pack', description: 'Read a Kane CLI evidence pack (.evidence) and summarise it: Kane\'s status, each step, whether a failure is infrastructure or a real assertion, requested clicks missing from the steps, and typing after the last requested click. No model is called.', inputSchema: { type: 'object', properties: { pack: str('Path to the .evidence file') }, required: ['pack'] } },
  { name: 'kanejury_gate', description: 'Turn a Kane result into one action: allow, fix (send to the coding agent), rerun (infrastructure trouble, leave the agent out), recheck (Kane passed but its steps look like it repaired the page), or review. Pass a claim to add the visual jury.', inputSchema: { type: 'object', properties: { pack: str('Path to the .evidence file'), claim: str('Optional: the claim to judge visually, for example "The cart badge shows 1."') }, required: ['pack'] } },
  { name: 'kanejury_judge_pack', description: 'Ask three attested models whether a claim holds on a step screenshot from a Kane evidence pack. Returns pass, fail or inconclusive, who disagreed, and writes a signed receipt.', inputSchema: { type: 'object', properties: { pack: str('Path to the .evidence file'), claim: str('The claim to judge'), step: str('Step number, or "last" (default)'), policy: { type: 'string', enum: ['cautious', 'majority'] }, receipt_path: str('Where to write the receipt (default receipt.json)') }, required: ['pack', 'claim'] } },
  { name: 'kanejury_verify_receipt', description: 'Check a KaneJury receipt: signed hashes, signatures recovered to the attested signing addresses, every verdict re-derived from the signed response. Pass the evidence image to also rebuild each request from the claim.', inputSchema: { type: 'object', properties: { receipt: str('Path to the receipt JSON'), image: str('Optional: path to the evidence image') }, required: ['receipt'] } },
  { name: 'kanejury_guard_snapshot', description: 'Fingerprint the protected test files (Kane tests in .testmuai/tests plus any extra paths) before a coding agent starts working, so a later check can tell if a test was edited or deleted.', inputSchema: { type: 'object', properties: { root: str('Project folder (default: current folder)'), protect: str('Optional extra paths to protect, comma separated, for example "e2e,tests"'), baseline: str('Where to save the fingerprint (default .kanejury-baseline.json)') } } },
  { name: 'kanejury_guard_check', description: 'Compare the protected test files with the saved fingerprint. If the agent edited or deleted a test, the result is "review": a pass against edited tests must not be accepted. New test files are allowed.', inputSchema: { type: 'object', properties: { root: str('Project folder (default: current folder)'), baseline: str('Fingerprint file (default .kanejury-baseline.json)') } } },
];

const ok = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] });
const bad = (m) => ({ isError: true, content: [{ type: 'text', text: String(m) }] });

export async function callTool(name, a = {}) {
  if (!TOOLS.some((t) => t.name === name)) return bad(`unknown tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(', ')}`);
  try {
    if (name === 'kanejury_verify_receipt') {
      const r = JSON.parse(fs.readFileSync(a.receipt, 'utf8'));
      const v = await verifyReceipt(r, { imagePath: a.image });
      return ok({ ok: v.ok, checks: v.checks.length, failed: v.checks.filter((c) => !c.ok).map((c) => c.what) });
    }
    if (name === 'kanejury_guard_snapshot' || name === 'kanejury_guard_check') {
      const root = a.root || process.cwd(), file = a.baseline || `${root}/.kanejury-baseline.json`;
      if (name === 'kanejury_guard_snapshot') { const snap = snapshotTests(root, protectList(a.protect)); saveSnapshot(file, snap); return ok({ baseline: file, protect: snap.protect, files: Object.keys(snap.files).length }); }
      const base = loadSnapshot(file); const diff = compareSnapshots(base, snapshotTests(root, base.protect || protectList()));
      return ok({ action: diff.tampered ? 'review' : 'allow', reasons: diff.tampered ? tamperReasons(diff) : ['protected tests unchanged'], ...diff });
    }
    const pack = loadPack(a.pack); const t = pack.tests[0];
    const failure = classifyFailure(pack), gaps = coverageGaps(pack), post = postActionInputs(pack);
    if (name === 'kanejury_inspect_pack') return ok({ title: pack.title, kane_status: t?.status, totals: pack.totals, failure, requested_clicks_missing: gaps.missing, typing_after_last_requested_click: post.steps, steps: (t?.steps || []).map((s) => ({ ordinal: s.ordinal, kind: s.kind, status: s.status, summary: s.summary, screenshot: !!s.screenshot })) });
    if (name === 'kanejury_gate') return ok(await gatePack(a.pack, { claim: a.claim }));
    if (name === 'kanejury_judge_pack') {
      if (failure.kind === 'infrastructure') return ok({ verdict: 'no_evidence', reason: failure.why });
      const p = pickScreenshot(pack, 0, a.step || 'last');
      const j = await runJury({ claim: a.claim, image: p.image, mime: p.mime, evidenceName: `step${p.step}.jpg`, policy: a.policy || 'cautious' });
      const out = a.receipt_path || 'receipt.json'; fs.writeFileSync(out, JSON.stringify(j.receipt, null, 2));
      return ok({ verdict: j.result.verdict, reason: j.result.reason, agree: `${j.result.agree}/${j.result.of}`, dissent: j.result.dissent, excluded: j.result.excluded, receipt: out });
    }
    return bad(`unknown tool ${name}`);
  } catch (e) { return bad(e.code === 'ENOENT' ? `file not found: ${e.path}` : e.message); }
}

export async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  if (method === 'initialize') return reply({ protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'kanejury', version: VERSION } });
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: TOOLS });
  if (method === 'tools/call') return reply(await callTool(params?.name, params?.arguments));
  if (id === undefined) return null; // notifications need no reply
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n'); return; }
    const out = await handle(msg); if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
}
