import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrail, trailVerdict, TRAIL_PROMPT } from '../src/trail.js';
test('parses a verdict and the unrequested actions', () => { const r = parseTrail('{"verdict":"improvised","unrequested":["clicked Toggle Todo"]}'); assert.equal(r.verdict, 'improvised'); assert.deepEqual(r.unrequested, ['clicked Toggle Todo']); });
test('unreadable output is an error, not a verdict', () => { assert.equal(parseTrail('no json here').verdict, 'error'); assert.equal(parseTrail('{"verdict":"maybe"}').verdict, 'error'); });
test('flags only when a strict majority of eligible jurors say improvised', () => {
  const v = (verdict, eligible = true) => ({ verdict, eligible });
  assert.equal(trailVerdict([v('improvised'), v('improvised'), v('faithful')]).flagged, true);
  assert.equal(trailVerdict([v('improvised'), v('faithful'), v('unclear')]).flagged, false);
  assert.equal(trailVerdict([v('improvised'), v('improvised'), v('faithful', false)]).flagged, true);
  assert.equal(trailVerdict([v('improvised'), v('faithful', false), v('faithful', false)]).verdict, 'no_quorum');
});
test('the prompt carries the start URL so opening it is not flagged', () => { assert.ok(TRAIL_PROMPT('o', [], 'https://x.test/').includes('https://x.test/')); assert.ok(!TRAIL_PROMPT('o', []).includes('START URL')); });
test('the prompt carries the objective and every step in order', () => { const p = TRAIL_PROMPT('add x then clear', [{ kind: 'type', summary: 'type x' }, { kind: 'click', summary: 'toggle' }]); assert.ok(p.includes('add x then clear') && p.indexOf('1. [type]') < p.indexOf('2. [click]')); });
