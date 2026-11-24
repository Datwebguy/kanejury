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
