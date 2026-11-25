#!/usr/bin/env node
// Claude Code Stop hook: before the agent can finish, run Kane against your app and let KaneJury decide if "done" is true.
// Configure with environment variables (see docs/claude-code.md): KANEJURY_OBJECTIVE, KANEJURY_URL, optional KANEJURY_CLAIM.
import fs from 'node:fs';
import { runKane } from '../src/loop.js';
import { gatePack } from '../src/gate-pack.js';
import { hookResponse } from '../src/hook.js';
import { diffFromBaseline, tamperReasons, loadSnapshot, hookBaselinePath, MISSING_BASELINE } from '../src/guard.js';

const objective = process.env.KANEJURY_OBJECTIVE, url = process.env.KANEJURY_URL;
if (!objective || !url) process.exit(0); // not configured: never get in the way
const stateFile = '.kanejury-hook-state.json';
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { attempt: 0, strict: false };
state.attempt += 1;
const kr = await runKane({ objective, url, mode: state.strict ? 'action' : undefined });
if (kr.error || !kr.packPath) { console.error(`KaneJury: ${kr.error || 'no evidence pack'}`); process.exit(0); }
const baselineFile = hookBaselinePath();
let tamper = null;
// Fail closed: the prompt hook always writes this before the agent works, so a missing fingerprint means it was removed.
if (!fs.existsSync(baselineFile)) tamper = MISSING_BASELINE;
else { const diff = diffFromBaseline(loadSnapshot(baselineFile)); if (diff.tampered) tamper = tamperReasons(diff); }
const d = await gatePack(kr.packPath, { claim: process.env.KANEJURY_CLAIM, strict: state.strict, tamper });
state.strict = d.action === 'recheck';
const h = hookResponse(d, { attempt: state.attempt });
if (!h.block) { fs.rmSync(stateFile, { force: true }); if (d.action === 'allow') fs.rmSync(baselineFile, { force: true }); if (h.note) console.error(`KaneJury: ${h.note}`); process.exit(0); }
fs.writeFileSync(stateFile, JSON.stringify(state));
console.log(JSON.stringify({ decision: 'block', reason: h.reason }));
