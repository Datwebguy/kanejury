import { chat, signature, sha256 } from './near.js';
// Default jurors: vision-capable models that NEAR AI hosts itself in its own TEEs (checked 2026-11-24).
export const DEFAULT_JURORS = [
  { id: 'qwen3-vl', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
  { id: 'glm-flash', model: 'z-ai/glm-5.3-flash' },
  { id: 'qwen3.8', model: 'Qwen/Qwen3.8-27B' },
];
export const PROMPT = (claim) =>
  'You are a QA judge. The image is evidence captured by a browser test. Judge ONLY what is visible. ' +
  `Claim under test: '${claim}' If the evidence does not contain enough to decide either way (for example it is covered, cut off or still loading), answer inconclusive. ` +
  'Reply with one JSON object only, no other text: {"verdict":"pass|fail|inconclusive","quote":"exact text you read"}';

export function parseVerdict(text) {
  const m = /\{[\s\S]*?\}/.exec(text || '');
  if (!m) return { verdict: 'error', quote: '' };
  try {
    const o = JSON.parse(m[0]);
    const v = String(o.verdict || '').trim().toLowerCase();
    return { verdict: ['pass', 'fail', 'inconclusive'].includes(v) ? v : 'error', quote: String(o.quote || '').slice(0, 300) };
  } catch { return { verdict: 'error', quote: '' }; }
}

// Ask one juror. Returns the verdict plus what is needed to check the signed receipt later.
export const buildContent = (claim, image, mime = 'image/png') =>
  [{ type: 'text', text: PROMPT(claim) }, { type: 'image_url', image_url: { url: `data:${mime};base64,${image.toString('base64')}` } }];

export async function ask(juror, claim, image, mime = 'image/png') {
  const content = buildContent(claim, image, mime);
  const { json, reqBytes, resBytes } = await chat(juror.model, content);
  const parsed = parseVerdict(json.choices?.[0]?.message?.content);
  const out = { juror: juror.id, model: juror.model, ...parsed, chatId: json.id, usage: json.usage || {}, requestSha256: sha256(reqBytes), responseSha256: sha256(resBytes), responseBody: resBytes.toString('base64') };
  try { const s = await signature(json.id, juror.model); out.signature = { text: s.text, signature: s.signature, signingAddress: s.signing_address, kind: s.signature_kind }; }
  catch (e) { out.signatureError = e.message; }
  return out;
}
