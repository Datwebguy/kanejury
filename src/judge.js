// Shared jury core used by the judge, judge-pack and loop commands.
import { DEFAULT_JURORS, ask } from './jurors.js';
import { calibrate } from './calibrate.js';
import { aggregate } from './aggregate.js';
import { buildReceipt } from './receipt.js';
import { sha256 } from './near.js';

export async function runJury({ claim, image, mime, evidenceName, policy = 'cautious', cacheFile = '.kanejury/calibration.json', jurors = DEFAULT_JURORS }) {
  const cal = await calibrate(jurors, { cacheFile });
  const votes = await Promise.all(jurors.map(async (j) => {
    try { return { ...(await ask(j, claim, image, mime)), eligible: !!cal.jurors[j.id]?.eligible }; }
    catch (e) { return { juror: j.id, model: j.model, verdict: 'error', quote: e.message.slice(0, 120), eligible: !!cal.jurors[j.id]?.eligible }; }
  }));
  const result = aggregate(votes.map(({ juror, verdict, eligible }) => ({ juror, verdict, eligible })), { policy });
  const receipt = buildReceipt({ claim, evidence: [{ name: evidenceName, sha256: sha256(image), mime }], policy, calibration: cal, votes, result });
  return { cal, votes, result, receipt };
}
