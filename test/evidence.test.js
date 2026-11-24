import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readZip, loadPack, pickScreenshot } from '../src/evidence.js';

// Builds a tiny zip by hand (stored and deflated entries) so the reader is tested without any Kane output.
function crc32(b) { let c, crc = 0xffffffff; for (const x of b) { c = (crc ^ x) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function makeZip(entries) {
  const locals = [], centrals = []; let off = 0;
  for (const [name, data, deflate] of entries) {
    const nb = Buffer.from(name), body = deflate ? zlib.deflateRawSync(data) : data, method = deflate ? 8 : 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(crc32(data), 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, body); centrals.push(ch, nb); off += 30 + nb.length + body.length;
  }
  const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
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
