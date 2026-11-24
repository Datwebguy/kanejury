import { chat, signature, sha256 } from './near.js';
import { buildContent } from './request.js';
import { parseVerdict } from './verdict.js';
// Default jurors: vision-capable models that NEAR AI hosts itself in its own TEEs (checked 2026-11-24).
export const DEFAULT_JURORS = [
  { id: 'qwen3-vl', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
  { id: 'glm-flash', model: 'z-ai/glm-5.3-flash' },
  { id: 'qwen3.8', model: 'Qwen/Qwen3.8-27B' },
];
export { PROMPT, buildContent } from './request.js';
export { parseVerdict } from './verdict.js';

// Ask one juror. Returns the verdict plus what is needed to check the signed receipt later.
export async function ask(juror, claim, image, mime = 'image/png') {
  const content = buildContent(claim, image, mime);
  const { json, reqBytes, resBytes } = await chat(juror.model, content);
  const parsed = parseVerdict(json.choices?.[0]?.message?.content);
  const out = { juror: juror.id, model: juror.model, ...parsed, chatId: json.id, usage: json.usage || {}, requestSha256: sha256(reqBytes), responseSha256: sha256(resBytes), responseBody: resBytes.toString('base64') };
  try { const s = await signature(json.id, juror.model); out.signature = { text: s.text, signature: s.signature, signingAddress: s.signing_address, kind: s.signature_kind }; }
  catch (e) { out.signatureError = e.message; }
  return out;
}
