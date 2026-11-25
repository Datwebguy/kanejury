// Test guard: the coding agent must not reach a green run by editing or deleting the tests.
// Take a fingerprint of the protected files before the agent works; compare after. Pure Node, no network.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export { compareSnapshots, tamperReasons } from './guard-core.js';

// Kane CLI keeps saved tests here (kane-cli run --name <flow> writes .testmuai/tests/<flow>_test.md).
export const DEFAULT_PROTECT = ['.testmuai/tests'];
const SKIP = new Set(['node_modules', '.git']);

export function protectList(extra = process.env.KANEJURY_PROTECT) {
  const more = Array.isArray(extra) ? extra : String(extra || '').split(',');
  return [...new Set([...DEFAULT_PROTECT, ...more.map((s) => s.trim()).filter(Boolean)])];
}

function walk(abs, rel, out) {
  let st; try { st = fs.statSync(abs); } catch { return; }
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(abs).sort()) if (!SKIP.has(name)) walk(path.join(abs, name), path.posix.join(rel, name), out);
  } else if (st.isFile()) out[rel] = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

// Returns { protect, files: { 'relative/path': sha256 } } for every file under the protected paths.
export function snapshotTests(root = process.cwd(), protect = protectList()) {
  const files = {};
  for (const p of protect) walk(path.resolve(root, p), p.split(path.sep).join('/').replace(/\/$/, ''), files);
  return { protect, files };
}

export function saveSnapshot(file, snap) { fs.writeFileSync(file, JSON.stringify(snap, null, 2)); }
export function loadSnapshot(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
