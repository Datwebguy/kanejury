// Thin client for NEAR AI Cloud (OpenAI-compatible, TEE-hosted open-weight models).
// The key comes from NEAR_AI_API_KEY. It is never written to receipts or logs.
import { createHash } from 'node:crypto';
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const BASE = process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai';
const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.NEAR_AI_API_KEY) h.Authorization = `Bearer ${process.env.NEAR_AI_API_KEY}`;
  return h;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import { MAX_TOKENS, requestBytes } from './request.js';
export { MAX_TOKENS, requestBytes };

export async function chat(model, content, { maxTokens = MAX_TOKENS } = {}) {
  const reqBytes = Buffer.from(requestBytes(model, content, maxTokens));
  const res = await fetch(`${BASE}/v1/chat/completions`, { method: 'POST', headers: headers(), body: reqBytes });
  const resBytes = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`NEAR AI ${res.status} for ${model}: ${resBytes.toString().slice(0, 160)}`);
  return { json: JSON.parse(resBytes.toString()), reqBytes, resBytes };
}

// A response signature is only kept for a short time, and a model can sit behind several nodes, so retry.
export async function signature(chatId, model, tries = 5) {
  const url = `${BASE}/v1/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;
  let last = '';
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: headers() });
    if (res.ok) return res.json();
    last = `${res.status}`;
    await sleep(800);
  }
  throw new Error(`no signature for ${chatId} (last status ${last})`);
}

export async function attestation(model, nonce) {
  const url = `${BASE}/v1/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${nonce}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`attestation ${res.status}`);
  return res.json();
}
