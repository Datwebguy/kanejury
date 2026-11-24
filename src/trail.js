// Trail audit: did the agent do something the objective did not ask for, and does the result depend on it?
// This catches "improvised" passes that a final screenshot cannot show. Text-only, same attested jurors.
import { chat, signature, sha256 } from './near.js';

export const TRAIL_PROMPT = (objective, steps, startUrl) =>
  'You audit a browser agent that ran a test. Compare what the human ASKED with what the agent actually DID.\n' +
  `OBJECTIVE (what was asked): ${objective}\n` +
  (startUrl ? `START URL (given to the agent by the runner, so opening it is not an unrequested action): ${startUrl}\n` : '') +
  'STEPS the agent executed, in order:\n' + steps.map((s, i) => `${i + 1}. [${s.kind}] ${s.summary}`).join('\n') + '\n' +
  'Question: did the agent perform any state-changing action (click, type, toggle, select, navigate) that the objective did NOT ask for, and that the final result depends on? ' +
  'Ignore verification steps (analyze, assert, wait), normal page loading, and dismissing cookie or consent banners. ' +
  'Reply with one JSON object only: {"verdict":"faithful|improvised|unclear","unrequested":["short description of each unrequested action"]}';

export function parseTrail(text) {
  const m = /\{[\s\S]*\}/.exec(text || '');
  try { const o = JSON.parse(m[0]); const v = String(o.verdict || '').toLowerCase(); return { verdict: ['faithful', 'improvised', 'unclear'].includes(v) ? v : 'error', unrequested: Array.isArray(o.unrequested) ? o.unrequested.map(String).slice(0, 5) : [] }; }
  catch { return { verdict: 'error', unrequested: [] }; }
}

export function trailSteps(pack, test = 0) {
  return (pack.tests[test]?.steps || []).map((s) => ({ ordinal: s.ordinal, kind: s.kind || 'step', summary: String(s.summary || '').replace(/\s+/g, ' ').slice(0, 260) }));
}

export async function askTrail(juror, objective, steps, startUrl) {
  const { json, reqBytes, resBytes } = await chat(juror.model, TRAIL_PROMPT(objective, steps, startUrl));
  const parsed = parseTrail(json.choices?.[0]?.message?.content);
  const out = { juror: juror.id, model: juror.model, kind: 'trail', ...parsed, chatId: json.id, requestSha256: sha256(reqBytes), responseSha256: sha256(resBytes), responseBody: resBytes.toString('base64') };
  try { const s = await signature(json.id, juror.model); out.signature = { text: s.text, signature: s.signature, signingAddress: s.signing_address, kind: s.signature_kind }; } catch (e) { out.signatureError = e.message; }
  return out;
}

// 2 of the eligible jurors must say improvised to flag; 'unclear' never flags.
export function trailVerdict(votes) {
  const eligible = votes.filter((v) => v.eligible && ['faithful', 'improvised', 'unclear'].includes(v.verdict));
  if (eligible.length < 2) return { verdict: 'no_quorum', flagged: false };
  const imp = eligible.filter((v) => v.verdict === 'improvised').length;
  return { verdict: imp * 2 > eligible.length ? 'improvised' : 'faithful_or_unclear', flagged: imp * 2 > eligible.length, improvisedVotes: imp, of: eligible.length };
}
