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

// Returns a list of { ok, what }. Pass imageBytes to also rebuild each request from the claim and the evidence file.
export async function verifyOffline(r, { imageBytes } = {}) {
  const checks = []; const add = (ok, what) => checks.push({ ok: !!ok, what });
  const imgHash = imageBytes ? await sha256Hex(imageBytes) : null;
  if (imgHash) add(r.evidence.some((e) => e.sha256 === imgHash), 'the evidence file is the one listed in the receipt');
  for (const v of r.votes) {
    const tag = `[${v.juror}]`;
    if (!v.signature) { add(false, `${tag} carries a signature`); continue; }
    const t = v.signature.text;
    add(t.startsWith(v.model + ':'), `${tag} signed text names the model ${v.model}`);
    add(t.includes(v.requestSha256) && t.includes(v.responseSha256), `${tag} signed text contains the request hash and the response hash`);
    try { add(recoverSigner(t, v.signature.signature).toLowerCase() === v.signature.signingAddress.toLowerCase(), `${tag} signature recovers to the attested signing address ${v.signature.signingAddress}`); }
    catch (e) { add(false, `${tag} signature could not be recovered: ${e.message}`); }
    if (v.responseBody) {
      const body = fromBase64(v.responseBody);
      add((await sha256Hex(body)) === v.responseSha256, `${tag} the embedded response matches the signed response hash`);
      let parsed = 'unreadable'; try { parsed = parseVerdict(JSON.parse(new TextDecoder().decode(body)).choices?.[0]?.message?.content).verdict; } catch {}
      add(parsed === v.verdict, `${tag} the recorded verdict "${v.verdict}" is what the signed response says ("${parsed}")`);
    } else add(false, `${tag} the receipt embeds the signed response`);
    if (imageBytes) {
      const mime = (r.evidence.find((e) => e.sha256 === imgHash) || {}).mime || 'image/png';
      add((await sha256Hex(requestBytes(v.model, buildContent(r.claim, imageBytes, mime), r.maxTokens))) === v.requestSha256, `${tag} the request rebuilt from the claim and the evidence matches the signed request hash`);
    }
  }
  const elig = Object.fromEntries(r.votes.map((v) => [v.juror, v.eligible]));
  const again = aggregate(r.votes.map((v) => ({ juror: v.juror, verdict: v.verdict, eligible: elig[v.juror] })), { policy: r.policy });
  add(again.verdict === r.result.verdict, `the final verdict recomputes from the votes (${again.verdict})`);
  return { ok: checks.every((c) => c.ok), checks };
}
