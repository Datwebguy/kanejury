import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readZip, loadPack, pickScreenshot } from '../src/evidence.js';

import { makeZip } from './helpers/zip.js';
const pack = makeZip([
  ['run.yaml', Buffer.from("title: Verify the counter\ntotals:\n  tests: 1\n  passed: 0\n  failed: 1\n  broken: 0\n")],
  ['tests/t1/result.yaml', Buffer.from("status: failed\nexternal_id:\n  user_email: person@example.com\n"), true],
  ['tests/t1/steps/1-0-1/step.json', Buffer.from('{"kind":"navigate","status":"passed","summary":"go","url":"https://x"}')],
  ['tests/t1/steps/1-0-1/screenshot.jpg', Buffer.from('JPEG-ONE')],
  ['tests/t1/steps/2-0-2/step.json', Buffer.from('{"kind":"assert","status":"failed","summary":"no"}')],
  ['tests/t1/steps/2-0-2/screenshot.jpg', Buffer.from('JPEG-TWO'), true],
  ['tests/t1/steps/2-0-2/failure.yaml', Buffer.from("error:\n  message: 'counter was 1'\n")],
]);
const file = path.join(os.tmpdir(), 'kanejury-test.evidence'); fs.writeFileSync(file, pack);

test('reads stored and deflated zip entries', () => { const z = readZip(pack); assert.equal(z.get('tests/t1/steps/2-0-2/screenshot.jpg').toString(), 'JPEG-TWO'); assert.equal(z.size, 7); });
test('loads run title, totals, test status and steps in order', () => { const p = loadPack(file); assert.equal(p.title, 'Verify the counter'); assert.deepEqual(p.totals, { passed: 0, failed: 1, broken: 0 }); assert.equal(p.tests[0].status, 'failed'); assert.deepEqual(p.tests[0].steps.map((s) => s.ordinal), [1, 2]); assert.equal(p.tests[0].steps[1].failure, 'counter was 1'); });
test('picks the last screenshot, or a numbered one', () => { const p = loadPack(file); assert.equal(pickScreenshot(p).image.toString(), 'JPEG-TWO'); assert.equal(pickScreenshot(p, 0, 1).image.toString(), 'JPEG-ONE'); assert.throws(() => pickScreenshot(p, 0, 9)); });
test('the loaded pack never exposes account fields from result.yaml', () => { assert.ok(!JSON.stringify(loadPack(file), (k, v) => (Buffer.isBuffer(v) || v?.type === 'Buffer' ? undefined : v)).includes('person@example.com')); });
