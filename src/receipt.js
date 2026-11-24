import fs from 'node:fs';
import { attestation } from './near.js';
import { MAX_TOKENS } from './request.js';
import { verifyOffline, recoverSigner } from './verify-core.js';
export { recoverSigner };

export const LIMITS = [
  'Jurors read the evidence image they were given. They cannot see what Kane did not capture.',
  'Kane itself ran on TestMu AI servers, so this receipt covers the judging step only.',
  'The Intel TDX and NVIDIA quotes are fetched but not verified by this tool. Use NEAR AI\'s open verifier for that.',
];

export function buildReceipt({ claim, evidence, policy, calibration, votes, result }) {
  return { kanejury: '0.0.1', createdAt: new Date().toISOString(), claim, evidence, policy, maxTokens: MAX_TOKENS, calibration, votes, result, limits: LIMITS };
}

// Offline checks (shared with the browser verifier) plus an optional live attestation lookup.
export async function verifyReceipt(r, { imagePath, online = false } = {}) {
  const res = await verifyOffline(r, { imageBytes: imagePath ? new Uint8Array(fs.readFileSync(imagePath)) : undefined });
  const checks = res.checks; const add = (ok, what) => checks.push({ ok: !!ok, what });
  if (online) for (const v of r.votes) {
    if (!v.signature) continue; const tag = `[${v.juror}]`;
    try {
      const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const a = await attestation(v.model, nonce);
      const m = (a.model_attestations || []).find((x) => x.signing_address?.toLowerCase() === v.signature.signingAddress.toLowerCase());
      add(m, `${tag} the signing address appears in a live attestation report`);
      add(m && m.request_nonce === nonce && m.intel_quote && m.nvidia_payload, `${tag} the attestation echoes a fresh nonce and carries Intel and NVIDIA evidence (verify the quotes with NEAR AI's open verifier)`);
    } catch (e) { add(false, `${tag} live attestation lookup failed: ${e.message}`); }
  }
  return { ok: checks.every((c) => c.ok), checks };
}
