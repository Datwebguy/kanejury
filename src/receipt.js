import fs from 'node:fs';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { aggregate } from './aggregate.js';
import { buildContent, parseVerdict } from './jurors.js';
import { requestBytes, sha256, attestation, MAX_TOKENS } from './near.js';

export const LIMITS = [
  'Jurors read the evidence image they were given. They cannot see what Kane did not capture.',
  'Kane itself ran on TestMu AI servers, so this receipt covers the judging step only.',
  'The Intel TDX and NVIDIA quotes are fetched but not verified by this tool. Use NEAR AI\'s open verifier for that.',
];

export function buildReceipt({ claim, evidence, policy, calibration, votes, result }) {
  return { kanejury: '0.0.1', createdAt: new Date().toISOString(), claim, evidence, policy, maxTokens: MAX_TOKENS, calibration, votes, result, limits: LIMITS };
}

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

// Offline checks, plus optional rebuild of the request from the evidence file and optional live attestation lookup.
export async function verifyReceipt(r, { imagePath, online = false } = {}) {
  const checks = [];
  const add = (ok, what) => checks.push({ ok, what });
  const image = imagePath ? fs.readFileSync(imagePath) : null;
  if (image) add(r.evidence.some((e) => e.sha256 === sha256(image)), `evidence file hash is listed in the receipt`);
  for (const v of r.votes) {
    const tag = `[${v.juror}]`;
    if (!v.signature) { add(false, `${tag} has a signature`); continue; }
    const t = v.signature.text;
    add(t.startsWith(v.model + ':'), `${tag} signed text names model ${v.model}`);
    add(t.includes(v.requestSha256) && t.includes(v.responseSha256), `${tag} signed text contains the request and response hashes`);
    try { add(recoverSigner(t, v.signature.signature).toLowerCase() === v.signature.signingAddress.toLowerCase(), `${tag} signature recovers to signing address ${v.signature.signingAddress}`); }
    catch (e) { add(false, `${tag} signature recovery failed: ${e.message}`); }
    if (v.responseBody) {
      const body = Buffer.from(v.responseBody, 'base64');
      add(sha256(body) === v.responseSha256, `${tag} embedded response matches the signed response hash`);
      let parsed = 'unreadable'; try { parsed = parseVerdict(JSON.parse(body.toString()).choices?.[0]?.message?.content).verdict; } catch {}
      add(parsed === v.verdict, `${tag} recorded verdict "${v.verdict}" is what the signed response actually says ("${parsed}")`);
    } else add(false, `${tag} receipt embeds the signed response`);
    if (image) add(sha256(requestBytes(v.model, buildContent(r.claim, image, (r.evidence.find((e) => e.sha256 === sha256(image)) || {}).mime || 'image/png'), r.maxTokens)) === v.requestSha256, `${tag} request rebuilt from claim + evidence matches the signed request hash`);
    if (online) {
      try {
        const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
        const a = await attestation(v.model, nonce);
        const m = (a.model_attestations || []).find((x) => x.signing_address?.toLowerCase() === v.signature.signingAddress.toLowerCase());
        add(!!m, `${tag} signing address appears in a live attestation report`);
        add(!!m && m.request_nonce === nonce && !!m.intel_quote && !!m.nvidia_payload, `${tag} attestation echoes my nonce and carries Intel + NVIDIA evidence (not cryptographically verified here)`);
      } catch (e) { add(false, `${tag} attestation lookup failed: ${e.message}`); }
    }
  }
  const elig = Object.fromEntries(r.votes.map((v) => [v.juror, v.eligible]));
  const again = aggregate(r.votes.map((v) => ({ juror: v.juror, verdict: v.verdict, eligible: elig[v.juror] })), { policy: r.policy });
  add(again.verdict === r.result.verdict, `verdict recomputes from the recorded votes (${again.verdict})`);
  return { ok: checks.every((c) => c.ok), checks };
}
