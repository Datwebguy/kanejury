// Runs Kane, decides with the gate, and hands only confirmed failures to a coding agent.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPack, classifyFailure, coverageGaps, postActionInputs, pickScreenshot } from './evidence.js';
import { decide } from './gate.js';
import { runJury } from './judge.js';
import { snapshotTests, compareSnapshots, tamperReasons, protectList } from './guard.js';

export function runKane({ kane = process.env.KANE_CLI || 'kane-cli', objective, url, timeoutSec = 170, maxSteps = 25, cwd = process.cwd(), mode }) {
  return new Promise((resolve) => {
    const p = spawn(kane, ['run', objective, '--url', url, '--agent', '--headless', '--timeout', String(timeoutSec), '--max-steps', String(maxSteps), ...(mode ? ['--mode', mode] : [])], { cwd, env: { ...process.env, KANE_CLI_USER_AGENT: 'kanejury' } });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', () => {});
    p.on('error', (e) => resolve({ error: e.message }));
    p.on('close', (code) => {
      let end = null; for (const l of out.split('\n')) { try { const o = JSON.parse(l); if (o.type === 'run_end') end = o; } catch {} }
      if (!end) return resolve({ error: `no run_end from Kane (exit ${code})` });
      const sd = String(end.session_dir || '').replace(/^~/, os.homedir());
      let pack = null; try { const dir = path.join(sd, 'evidence'); pack = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.evidence'))); } catch {}
      resolve({ end, packPath: pack, exit: code });
    });
  });
}

const runAgent = (cmd, briefPath, cwd) => new Promise((resolve) => {
  const p = spawn('sh', ['-c', cmd], { cwd, env: { ...process.env, KANEJURY_BRIEF: briefPath }, stdio: ['ignore', 'pipe', 'pipe'] });
  let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', (c) => resolve({ code: c, output: o.slice(-1500) }));
});

// Kane's own strict switch: 'action' hard-stops instead of falling through (the default 'testing' mode is lenient).
export const STRICT_MODE = 'action';

export async function loop({ objective, url, agent, claim, maxFixes = 3, maxReruns = 2, cwd = process.cwd(), log = () => {}, kane, protect = protectList() }) {
  const rounds = []; let fixes = 0, reruns = 0, n = 0, strict = false, tamper = null;
  const baseline = snapshotTests(cwd, protect);
  for (;;) {
    n++; const kr = await runKane({ kane, objective, url, cwd, mode: strict ? STRICT_MODE : undefined });
    if (kr.error) { rounds.push({ round: n, error: kr.error }); return { outcome: 'error', rounds }; }
    const pack = kr.packPath ? loadPack(kr.packPath) : null;
    const failure = pack ? classifyFailure(pack) : { kind: 'infrastructure', why: 'no evidence pack written' };
    const gaps = pack ? coverageGaps(pack) : null, post = pack ? postActionInputs(pack) : null;
    let jury = null;
    if (claim && pack && failure.kind !== 'infrastructure') { try { const pick = pickScreenshot(pack); const j = await runJury({ claim, image: pick.image, mime: pick.mime, evidenceName: `step${pick.step}.jpg` }); jury = j.result; } catch {} }
    const d = decide({ kaneStatus: kr.end.status, failure, gaps, jury, post, strict, tamper });
    const row = { round: n, kane: kr.end.status, credits: Math.round((kr.end.credits_consumed || 0) * 10) / 10, seconds: Math.round(kr.end.duration || 0), decision: d.action, strict, reasons: d.reasons, jury: jury?.verdict ?? null, kaneSummary: String(kr.end.summary || '').replace(/\s+/g, ' ').slice(0, 300) };
    rounds.push(row); log(`round ${n}: Kane ${row.kane} -> gate says ${d.action.toUpperCase()} (${d.reasons[0]})`);
    if (d.action === 'allow') return { outcome: 'allowed', rounds };
    if (d.action === 'review') return { outcome: 'escalated_to_human', reason: d.reasons.join('; '), rounds };
    if (d.action === 'recheck') { strict = true; row.note = 'running again in Kane strict mode (--mode action)'; continue; }
    if (d.action === 'rerun') { if (++reruns > maxReruns) return { outcome: 'escalated_to_human', reason: 'Kane kept hitting infrastructure trouble', rounds }; continue; }
    if (++fixes > maxFixes) return { outcome: 'escalated_to_human', reason: `still failing after ${maxFixes} fix attempts`, rounds };
    const briefPath = path.join(cwd, `.kanejury-brief-${n}.json`);
    fs.writeFileSync(briefPath, JSON.stringify({ objective, url, kane_said: row.kaneSummary, reason: kr.end.reason, decision: d, attempt: fixes }, null, 2));
    const a = await runAgent(agent, briefPath, cwd); row.agent = { code: a.code, tail: a.output.slice(-300) }; log(`  agent ran (exit ${a.code})`);
    const diff = compareSnapshots(baseline, snapshotTests(cwd, protect));
    if (diff.tampered) { tamper = tamperReasons(diff); row.guard = diff; log(`  test guard: ${tamper[0]}`); }
  }
}
