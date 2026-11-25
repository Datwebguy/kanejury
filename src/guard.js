// Test guard: the coding agent must not reach a green run by editing or deleting the tests.
// Take a fingerprint of the protected files before the agent works; compare after. Pure Node, no network.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { compareSnapshots } from './guard-core.js';
export { compareSnapshots, tamperReasons } from './guard-core.js';

// Kane CLI keeps saved tests here (kane-cli run --name <flow> writes .testmuai/tests/<flow>_test.md).
export const DEFAULT_PROTECT = ['.testmuai/tests'];
const SKIP = new Set(['node_modules', '.git']);

export function protectList(extra = process.env.KANEJURY_PROTECT) {
  const more = Array.isArray(extra) ? extra : String(extra || '').split(',');
  return [...new Set([...DEFAULT_PROTECT, ...more.map((s) => s.trim()).filter(Boolean)])];
}

function walk(abs, rel, out, root = false) {
  let st; try { st = fs.lstatSync(abs); } catch { return; }
  if (st.isSymbolicLink()) { try { st = fs.statSync(abs); } catch { return; } if (st.isDirectory() && !root) return; } // never follow linked folders below a protected path (no loops)
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(abs).sort()) if (!SKIP.has(name)) walk(path.join(abs, name), path.posix.join(rel, name), out);
  } else if (st.isFile()) out[rel] = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

// Returns { protect, files: { 'relative/path': sha256 } } for every file under the protected paths.
export function snapshotTests(root = process.cwd(), protect = protectList()) {
  const files = {};
  for (const p of protect) walk(path.resolve(root, p), p.split(path.sep).join('/').replace(/\/$/, ''), files, true);
  return { protect, files };
}

export function saveSnapshot(file, snap) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, JSON.stringify(snap, null, 2)); }
export function loadSnapshot(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
// Compare a saved fingerprint with the protected tests as they are now (same paths as when it was taken).
export function diffFromBaseline(base, root = process.cwd()) { return compareSnapshots(base, snapshotTests(root, base.protect || protectList())); }

// Where the Claude Code hooks keep a task's fingerprint: outside the project, so the agent cannot delete it with the tests.
export function hookBaselinePath(root = process.cwd()) {
  let real = root; try { real = fs.realpathSync(root); } catch {}
  const dir = path.join(process.env.KANEJURY_STATE_DIR || path.join(os.homedir(), '.kanejury'), 'baselines');
  return path.join(dir, createHash('sha256').update(real).digest('hex').slice(0, 16) + '.json');
}
export const MISSING_BASELINE = ['the test fingerprint taken when this task started is missing: it was deleted, or the prompt hook (hooks/claude-code-prompt.mjs) is not set up', 'without it KaneJury cannot show the tests are unchanged, so a pass is not accepted'];
