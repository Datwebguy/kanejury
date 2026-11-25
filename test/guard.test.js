import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { snapshotTests, compareSnapshots, tamperReasons, protectList } from '../src/guard.js';
import { decide } from '../src/gate.js';
import { hookResponse } from '../src/hook.js';

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kj-guard-'));
  fs.mkdirSync(path.join(d, '.testmuai/tests'), { recursive: true });
  fs.writeFileSync(path.join(d, '.testmuai/tests/clear_test.md'), '# clear\n- click Clear completed\n- verify the list shows b\n');
  fs.writeFileSync(path.join(d, '.testmuai/tests/add_test.md'), '# add\n- add a todo\n');
  fs.mkdirSync(path.join(d, 'e2e')); fs.writeFileSync(path.join(d, 'e2e/cart.spec.js'), 'expect(badge).toBe(1)\n');
  return d;
}

test('nothing changed: not tampered', () => {
  const d = repo(); const a = snapshotTests(d); const diff = compareSnapshots(a, snapshotTests(d));
  assert.equal(diff.tampered, false); assert.equal(Object.keys(a.files).length, 2);
});

test('a weakened Kane test is caught', () => {
  const d = repo(); const a = snapshotTests(d);
  fs.writeFileSync(path.join(d, '.testmuai/tests/clear_test.md'), '# clear\n- click Clear completed\n');
  const diff = compareSnapshots(a, snapshotTests(d));
  assert.equal(diff.tampered, true); assert.deepEqual(diff.modified, ['.testmuai/tests/clear_test.md']);
});

test('a deleted Kane test is caught', () => {
  const d = repo(); const a = snapshotTests(d);
  fs.rmSync(path.join(d, '.testmuai/tests/add_test.md'));
  const diff = compareSnapshots(a, snapshotTests(d));
  assert.deepEqual(diff.deleted, ['.testmuai/tests/add_test.md']); assert.match(tamperReasons(diff)[0], /deleted protected test files/);
});

test('a deleted test folder is caught', () => {
  const d = repo(); const a = snapshotTests(d);
  fs.rmSync(path.join(d, '.testmuai/tests'), { recursive: true });
  assert.equal(compareSnapshots(a, snapshotTests(d)).deleted.length, 2);
});

test('adding a new test is allowed', () => {
  const d = repo(); const a = snapshotTests(d);
  fs.writeFileSync(path.join(d, '.testmuai/tests/new_test.md'), '# new\n');
  const diff = compareSnapshots(a, snapshotTests(d));
  assert.equal(diff.tampered, false); assert.deepEqual(diff.added, ['.testmuai/tests/new_test.md']);
});

test('extra protected paths are covered', () => {
  const d = repo(); const p = protectList('e2e'); const a = snapshotTests(d, p);
  fs.writeFileSync(path.join(d, 'e2e/cart.spec.js'), 'expect(badge).toBeTruthy()\n');
  assert.deepEqual(compareSnapshots(a, snapshotTests(d, p)).modified, ['e2e/cart.spec.js']);
});

test('the gate never allows a pass against edited tests', () => {
  const d = decide({ kaneStatus: 'passed', failure: null, gaps: { missing: [] }, post: { steps: [] }, tamper: ['the coding agent changed protected test files: x'] });
  assert.equal(d.action, 'review'); assert.equal(d.guard, true);
});

test('the stop hook blocks and asks for the tests back, then hands over to a person', () => {
  const d = { action: 'review', guard: true, reasons: ['the coding agent deleted protected test files: a'] };
  const h = hookResponse(d, { attempt: 1 }); assert.equal(h.block, true); assert.match(h.reason, /Restore the protected test files/);
  assert.equal(hookResponse(d, { attempt: 4 }).block, false);
});

test('a symlinked folder loop does not hang the guard', () => {
  const d = repo(); fs.symlinkSync(path.join(d, '.testmuai'), path.join(d, '.testmuai/tests/loop'));
  const snap = snapshotTests(d); assert.equal(Object.keys(snap.files).length, 2);
});
