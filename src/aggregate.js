// Pure decision logic. No network. Everything here is covered by hand-computed tests.
// votes: [{ juror, verdict: 'pass'|'fail'|'inconclusive'|'error', eligible: boolean }]
// policy 'majority': a strict majority of eligible jurors decides.
// policy 'cautious' (default): like majority, but a pass is downgraded to inconclusive if any eligible juror says fail.
export function aggregate(votes, { policy = 'cautious', minEligible = 2 } = {}) {
  const eligible = votes.filter((v) => v.eligible && ['pass', 'fail', 'inconclusive'].includes(v.verdict));
  const excluded = votes.filter((v) => !eligible.includes(v)).map((v) => ({ juror: v.juror, why: !v.eligible ? 'failed calibration' : `no usable answer (${v.verdict})` }));
  if (eligible.length < minEligible) return { verdict: 'no_quorum', reason: `only ${eligible.length} calibrated juror(s) answered, need ${minEligible}`, agree: 0, of: eligible.length, dissent: [], excluded, contested: false };
  const tally = { pass: 0, fail: 0, inconclusive: 0 };
  for (const v of eligible) tally[v.verdict]++;
  const need = Math.floor(eligible.length / 2) + 1;
  let verdict = Object.keys(tally).find((k) => tally[k] >= need) || 'inconclusive';
  let reason = verdict === 'inconclusive' && tally.inconclusive < need ? 'jurors split with no majority' : `${tally[verdict]} of ${eligible.length} jurors`;
  if (policy === 'cautious' && verdict === 'pass' && tally.fail > 0) { verdict = 'inconclusive'; reason = 'majority passed but a juror failed it (cautious policy)'; }
  const dissent = eligible.filter((v) => v.verdict !== verdict).map((v) => ({ juror: v.juror, verdict: v.verdict }));
  return { verdict, reason, agree: eligible.length - dissent.length, of: eligible.length, dissent, excluded, contested: dissent.length > 0, tally };
}
export const EXIT = { pass: 0, fail: 1, error: 2, inconclusive: 4, no_quorum: 4 };
