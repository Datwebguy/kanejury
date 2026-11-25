// Receipt verification that runs unchanged in Node and in a browser.
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { aggregate } from './aggregate.js';
import { parseVerdict } from './verdict.js';
import { buildContent, requestBytes, fromBase64 } from './request.js';

export async function sha256Hex(bytes) { return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))); }

// EIP-191 personal_sign recovery: the signed text must recover to the juror's attested signing address.
export function recoverSigner(text, signatureHex) {
  const sig = hexToBytes(signatureHex.replace(/^0x/, ''));
  if (sig.length !== 65) throw new Error('signature is not 65 bytes');
  const v = sig[64] >= 27 ? sig[64] - 27 : sig[64];
  const body = utf8ToBytes(text);
  const hash = keccak_256(concatBytes(utf8ToBytes(`\x19Ethereum Signed Message:\n${body.length}`), body));
  const pub = new secp256k1.Signature(BigInt('0x' + bytesToHex(sig.slice(0, 32))), BigInt('0x' + bytesToHex(sig.slice(32, 64)))).addRecoveryBit(v).recoverPublicKey(hash).toRawBytes(false);
  return '0x' + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
}

// Checks one signed model answer (a vote or a calibration answer). Returns the verdict re-read from the signed response.
async function checkSigned(a, tag, add, { claim, imageBytes, mime, maxTokens, what = 'the evidence' }) {
  if (!a.signature) { add(false, `${tag} carries a signature`); return null; }
  const t = a.signature.text;
  add(t.startsWith(a.model + ':'), `${tag} signed text names the model ${a.model}`);
  add(t.includes(a.requestSha256) && t.includes(a.responseSha256), `${tag} signed text contains the request hash and the response hash`);
  try { add(recoverSigner(t, a.signature.signature).toLowerCase() === a.signature.signingAddress.toLowerCase(), `${tag} signature recovers to the attested signing address ${a.signature.signingAddress}`); }
  catch (e) { add(false, `${tag} signature could not be recovered: ${e.message}`); }
  let parsed = null;
  if (a.responseBody) {
    const body = fromBase64(a.responseBody);
    add((await sha256Hex(body)) === a.responseSha256, `${tag} the embedded response matches the signed response hash`);
    parsed = 'unreadable'; try { parsed = parseVerdict(JSON.parse(new TextDecoder().decode(body)).choices?.[0]?.message?.content).verdict; } catch {}
    add(parsed === a.verdict, `${tag} the recorded verdict "${a.verdict}" is what the signed response says ("${parsed}")`);
  } else add(false, `${tag} the receipt embeds the signed response`);
  if (imageBytes) add((await sha256Hex(requestBytes(a.model, buildContent(claim, imageBytes, mime), maxTokens))) === a.requestSha256, `${tag} the request rebuilt from the claim and ${what} matches the signed request hash`);
  return parsed;
}

// Returns a list of { ok, what }. Pass imageBytes to also rebuild each request from the claim and the evidence file,
// and fixtures { true, false } (the calibration images) to rebuild each calibration request too.
export async function verifyOffline(r, { imageBytes, fixtures } = {}) {
  const checks = []; const add = (ok, what) => checks.push({ ok: !!ok, what });
  const imgHash = imageBytes ? await sha256Hex(imageBytes) : null;
  if (imgHash) add(r.evidence.some((e) => e.sha256 === imgHash), 'the evidence file is the one listed in the receipt');
  const mime = (r.evidence.find((e) => e.sha256 === imgHash) || {}).mime || 'image/png';
  const cal = r.calibration || {};
  if (fixtures) for (const k of ['true', 'false']) add((await sha256Hex(fixtures[k])) === cal.fixtures?.[k], `the known-${k} calibration image is the one listed in the receipt`);
  const signedTexts = [], eligible = {};
  for (const v of r.votes) {
    const tag = `[${v.juror}]`;
    await checkSigned(v, tag, add, { claim: r.claim, imageBytes, mime, maxTokens: r.maxTokens });
    if (v.signature) signedTexts.push(v.signature.text);
    // Eligibility is not taken from the receipt's flag: it is re-derived from the juror's own signed calibration answers.
    const c = cal.jurors?.[v.juror];
    if (!c?.answers?.true || !c?.answers?.false) { add(false, `${tag} eligibility is backed by signed calibration answers`); eligible[v.juror] = false; continue; }
    const got = {};
    for (const k of ['true', 'false']) {
      const a = c.answers[k];
      add(a.model === v.model, `${tag} calibration on the known-${k} image was answered by the same model`);
      got[k] = await checkSigned(a, `${tag} [calibration, known-${k}]`, add, { claim: cal.claim, imageBytes: fixtures?.[k], mime: 'image/png', maxTokens: r.maxTokens, what: `the known-${k} image` });
      if (a.signature) signedTexts.push(a.signature.text);
    }
    eligible[v.juror] = got.true === 'pass' && got.false === 'fail';
    add(eligible[v.juror] === !!v.eligible, `${tag} eligibility (${eligible[v.juror] ? 'eligible' : 'excluded'}) follows from its signed calibration answers`);
  }
  const ids = r.votes.map((v) => v.juror);
  add(new Set(ids).size === ids.length && new Set(signedTexts).size === signedTexts.length, 'every vote and calibration answer is a different signed response');
  const again = aggregate(r.votes.map((v) => ({ juror: v.juror, verdict: v.verdict, eligible: eligible[v.juror] })), { policy: r.policy });
  add(again.verdict === r.result.verdict, `the final verdict recomputes from the votes (${again.verdict})`);
  return { ok: checks.every((c) => c.ok), checks };
}
