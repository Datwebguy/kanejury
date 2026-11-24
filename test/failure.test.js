import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure } from '../src/evidence.js';
// The messages below were copied from real Kane CLI 0.10.8 runs on 2026-11-24.
const pack = (status, steps) => ({ tests: [{ status, steps: steps.map((s, i) => ({ ordinal: i + 1, ...s })) }] });
test('a browser crash during a screenshot is infrastructure', () => { const r = classifyFailure(pack('failed', [{ status: 'failed', summary: 'agent_info: Screenshot failed: TargetClosedError: screenshot: Target page, context or browser has been closed' }])); assert.equal(r.kind, 'infrastructure'); });
test('exhausted credits are infrastructure', () => { assert.equal(classifyFailure(pack('broken', [{ status: 'failed', failure: 'Credits exhausted: {"error":"insufficient credits"}' }])).kind, 'infrastructure'); });
test('a failed assertion is an assertion', () => { assert.equal(classifyFailure(pack('failed', [{ status: 'failed', summary: 'assert: the counter says 5 items left' }])).kind, 'assertion'); });
test('a passed test has no failure', () => { assert.equal(classifyFailure(pack('passed', [{ status: 'passed', summary: 'assert: ok' }])).kind, 'none'); });
test('a broken test with an unknown cause is still not a verdict', () => { assert.equal(classifyFailure(pack('broken', [{ status: 'failed', summary: 'something odd' }])).kind, 'infrastructure'); });
test('Kane failing to understand its own objective is not a verdict on the app', () => {
  for (const m of ['The mandatory initial checkpoint failed because its condition was unspecified.', 'The mandatory initial checkpoint could not be evaluated truthfully, so the run stopped', 'The child agent treated its sub-objective as an instruction to report failure']) assert.equal(classifyFailure(pack('failed', [{ status: 'failed', failure: m }])).kind, 'infrastructure', m);
});
test('the honest failure we wanted is still an assertion', () => { assert.equal(classifyFailure(pack('failed', [{ status: 'failed', summary: 'assert: the list shows b', failure: 'After clearing completed todos, the list is empty and b is absent' }])).kind, 'assertion'); });
