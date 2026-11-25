// Decides what a Kane result means for a coding agent. Pure function, no network.
//   allow  : safe to proceed
//   fix    : a confirmed failure; send it to the coding agent
//   rerun  : infrastructure trouble, not a verdict; run Kane again, do NOT involve the agent
//   recheck: Kane passed but its own trail looks like it repaired the page to pass; run it again in Kane's strict mode
//   review : the result is doubtful and a recheck did not settle it; a human should look
export function decide({ kaneStatus, failure, gaps, jury, post, strict = false, tamper = null }) {
  // The test guard comes first: a result against edited or deleted tests is never allowed through.
  if (tamper && tamper.length) return { action: 'review', reasons: tamper, guard: true };
  if (!kaneStatus) return { action: 'review', reasons: ['the evidence pack has no test result; a person should look'] };
  const reasons = [];
  const juryFail = jury && jury.verdict === 'fail', juryPass = jury && jury.verdict === 'pass';
  if (kaneStatus === 'passed') {
    if (gaps && gaps.missing.length) reasons.push(`Kane's trail is missing a requested action: ${gaps.missing.join(', ')}`);
    if (post && post.steps.length) reasons.push(`Kane typed or pressed keys after the last requested action (${post.after}): ${post.steps.map((s) => `step ${s.ordinal}`).join(', ')}. It may have repaired the page to pass.`);
    if (juryFail) reasons.push('Kane passed but the jury says the evidence shows a failure');
    if (!reasons.length) return { action: 'allow', reasons: ['Kane passed and nothing in the evidence disagrees'] };
    const integrity = (gaps && gaps.missing.length) || (post && post.steps.length);
    return { action: integrity && !strict ? 'recheck' : 'review', reasons };
  }
  if (failure && failure.kind === 'infrastructure') return { action: 'rerun', reasons: [`not a verdict on the claim: ${failure.why}`] };
  if (juryPass) return { action: 'review', reasons: ['Kane failed the claim but the jury says the evidence shows it holding (possible false failure)'] };
  return { action: 'fix', reasons: [failure ? `confirmed failure: ${failure.why}` : 'Kane failed the claim'] };
}
