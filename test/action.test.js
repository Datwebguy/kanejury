import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeZip } from './helpers/zip.js';
import { findPacks, summaryMarkdown, run } from '../src/action.js';
import { hookResponse } from '../src/hook.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kj-action-'));
const mk = (name, status, step) => fs.writeFileSync(path.join(dir, name), makeZip([
  ['run.yaml', Buffer.from('title: t\n')], ['tests/t1/result.yaml', Buffer.from(`status: ${status}\n`)],
  ['tests/t1/steps/1-0-1/step.json', Buffer.from(JSON.stringify(step))], ['tests/t1/steps/1-0-1/failure.yaml', Buffer.from(`error:\n  message: '${step.summary}'\n`)],
]));
mk('good.evidence', 'passed', { kind: 'assert', status: 'passed', summary: 'ok' });
mk('crash.evidence', 'failed', { kind: 'agent_info', status: 'failed', summary: 'Screenshot failed: TargetClosedError: Target page, context or browser has been closed' });
const env = (extra) => ({ INPUT_PACK: dir, GITHUB_OUTPUT: path.join(dir, 'out.txt'), GITHUB_STEP_SUMMARY: path.join(dir, 'sum.md'), ...extra });

test('finds packs in a folder or by direct path', () => { const all = findPacks(dir); assert.equal(all.length, 2); assert.deepEqual(findPacks(all[0]), [all[0]]); assert.deepEqual(findPacks('x/y.evidence'), []); });
test('a path with no packs means the action could not run (exit 2)', async () => { assert.equal(await run({ INPUT_PACK: path.join(dir, 'missing') }), 2); });
test('writes outputs and a job summary, and reports the most serious decision', async () => {
  fs.writeFileSync(path.join(dir, 'out.txt'), ''); const code = await run(env({ INPUT_FAIL_ON: 'fix' }));
  assert.equal(code, 0); const out = fs.readFileSync(path.join(dir, 'out.txt'), 'utf8'); assert.match(out, /^action=rerun/m); assert.match(fs.readFileSync(path.join(dir, 'sum.md'), 'utf8'), /\*\*rerun\*\*/);
});
test('fails the step when a decision is in fail-on', async () => assert.equal(await run(env({ INPUT_FAIL_ON: 'rerun' })), 1));
test('a folder with no evidence is an error', async () => assert.equal(await run({ INPUT_PACK: fs.mkdtempSync(path.join(os.tmpdir(), 'kj-empty-')) }), 2));
test('the summary escapes table separators', () => assert.ok(!summaryMarkdown([{ pack: 'a.evidence', kane_status: 'failed', action: 'fix', reasons: ['a | b'] }]).includes('a | b')));

test('hook: allow never blocks, rerun never blocks, fix and recheck block', () => {
  assert.equal(hookResponse({ action: 'allow', reasons: [] }).block, false);
  assert.equal(hookResponse({ action: 'rerun', reasons: ['x'] }).block, false);
  assert.equal(hookResponse({ action: 'fix', reasons: ['counter was 1'] }).block, true);
  assert.match(hookResponse({ action: 'recheck', reasons: ['typed after the last click'] }).reason, /strict mode/);
});
test('hook: stops blocking after the maximum number of attempts', () => assert.equal(hookResponse({ action: 'fix', reasons: ['x'] }, { attempt: 4, maxAttempts: 3 }).block, false));
