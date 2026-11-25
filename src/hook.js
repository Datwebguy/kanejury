// Maps a gate decision to what a Claude Code Stop hook should tell the agent. Pure, so it is easy to test.
export function hookResponse(decision, { attempt = 1, maxAttempts = 3 } = {}) {
  if (decision.action === 'allow') return { block: false };
  const held = { block: false, note: `KaneJury held this result for a person: ${decision.reasons.join(' ')}` };
  if (decision.guard) {
    if (attempt > maxAttempts) return held;
    return { block: true, reason: `KaneJury's test guard will not accept this result. Restore the protected test files to their original content and fix the application instead, then stop again.\n${decision.reasons.join('\n')}` };
  }
  if (decision.action === 'review') return held;
  if (decision.action === 'rerun') return { block: false, note: `Kane hit infrastructure trouble, not a verdict: ${decision.reasons[0]}` };
  if (attempt > maxAttempts) return { block: false, note: `KaneJury stopped after ${maxAttempts} attempts; a person should look. ${decision.reasons.join(' ')}` };
  const what = decision.action === 'fix' ? 'Kane confirmed a failure. Fix the application so this passes, then stop again.' : 'Kane passed, but its own steps suggest it repaired the page to pass. Do not change the application for this; stop again and KaneJury will re-run Kane in strict mode.';
  return { block: true, reason: `${what}\n${decision.reasons.join('\n')}` };
}
