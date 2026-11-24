import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyOffline, recoverSigner } from '../src/verify-core.js';
// examples/receipt-fail.json is a real receipt: three attested models judged examples/evidence-fail.png.
const receipt = () => JSON.parse(fs.readFileSync(new URL('../examples/receipt-fail.json', import.meta.url), 'utf8'));
const image = new Uint8Array(fs.readFileSync(new URL('../examples/evidence-fail.png', import.meta.url)));

test('the shipped receipt verifies, including the request rebuilt from the evidence file', async () => { const r = await verifyOffline(receipt(), { imageBytes: image }); assert.ok(r.ok, JSON.stringify(r.checks.filter((c) => !c.ok))); assert.ok(r.checks.length >= 20); });
test('a receipt verifies without the evidence file too', async () => assert.ok((await verifyOffline(receipt())).ok));
test('flipping every vote and the result together is caught by the signed responses', async () => {
  const r = receipt(); for (const v of r.votes) v.verdict = 'pass'; r.result.verdict = 'pass';
  const out = await verifyOffline(r); assert.equal(out.ok, false); assert.ok(out.checks.some((c) => !c.ok && /what the signed response says/.test(c.what)));
});
test('altering the signed text breaks the hash and the signature', async () => {
  const r = receipt(); r.votes[0].signature.text = r.votes[0].signature.text.replace(r.votes[0].responseSha256.slice(0, 6), '000000');
  const out = await verifyOffline(r); assert.equal(out.ok, false);
});
test('a different evidence file is rejected', async () => { const out = await verifyOffline(receipt(), { imageBytes: new Uint8Array([1, 2, 3]) }); assert.equal(out.ok, false); });
test('recovering a signer needs a 65-byte signature', () => assert.throws(() => recoverSigner('x', '0x1234'), /65 bytes/));
