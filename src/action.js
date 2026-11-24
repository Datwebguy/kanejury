// Entry point of the GitHub Action: reads INPUT_* variables, gates the evidence pack, writes outputs and a job summary.
import fs from 'node:fs';
import path from 'node:path';
import { gatePack } from './gate-pack.js';

export function findPacks(spec) {
  if (spec.endsWith('.evidence')) return [spec];
  const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.evidence')) out.push(p); } };
  walk(spec); return out.sort();
}
export const summaryMarkdown = (rows) => ['## KaneJury', '', '| Evidence pack | Kane | Decision | Why |', '|---|---|---|---|', ...rows.map((r) => `| ${path.basename(r.pack)} | ${r.kane_status} | **${r.action}** | ${r.reasons.join('; ').replace(/\|/g, '/')} |`), ''].join('\n');

export async function run(env = process.env) {
  const packs = findPacks(env.INPUT_PACK || '.');
  if (!packs.length) { console.error('KaneJury: no .evidence file found'); return 2; }
  const failOn = String(env.INPUT_FAIL_ON || 'fix,recheck,review').split(',').map((s) => s.trim()).filter(Boolean);
  const rows = []; for (const pack of packs) rows.push({ pack, ...(await gatePack(pack, { claim: env.INPUT_CLAIM || undefined })) });
  const worst = ['fix', 'review', 'recheck', 'rerun', 'allow'].find((a) => rows.some((r) => r.action === a)) || 'allow';
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `action=${worst}\nreasons=${rows.flatMap((r) => r.reasons).join(' | ').replace(/\n/g, ' ')}\n`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summaryMarkdown(rows));
  for (const r of rows) console.log(`${path.basename(r.pack)}: ${r.action.toUpperCase()} (${r.reasons[0]})`);
  return rows.some((r) => failOn.includes(r.action)) ? 1 : 0;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) run().then((c) => process.exit(c));
