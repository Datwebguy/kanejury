// The exact request each juror receives, built the same way everywhere so a receipt can rebuild it and compare hashes.
export const MAX_TOKENS = 1500;
export const PROMPT = (claim) =>
  'You are a QA judge. The image is evidence captured by a browser test. Judge ONLY what is visible. ' +
  `Claim under test: '${claim}' If the evidence does not contain enough to decide either way (for example it is covered, cut off or still loading), answer inconclusive. ` +
  'Reply with one JSON object only, no other text: {"verdict":"pass|fail|inconclusive","quote":"exact text you read"}';

export function toBase64(bytes) {
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromBase64 = (b64) => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

export const buildContent = (claim, image, mime = 'image/png') =>
  [{ type: 'text', text: PROMPT(claim) }, { type: 'image_url', image_url: { url: `data:${mime};base64,${toBase64(image)}` } }];

export const requestBytes = (model, content, maxTokens = MAX_TOKENS) =>
  new TextEncoder().encode(JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages: [{ role: 'user', content }] }));
