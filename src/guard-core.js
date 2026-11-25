// Browser- and Node-safe part of the test guard: compare two fingerprints.
// Modified or deleted protected files are tampering. New files are reported but allowed: adding a test is fine.
export function compareSnapshots(before, after) {
  const modified = [], deleted = [], added = [];
  for (const [f, h] of Object.entries(before.files)) {
    if (!(f in after.files)) deleted.push(f); else if (after.files[f] !== h) modified.push(f);
  }
  for (const f of Object.keys(after.files)) if (!(f in before.files)) added.push(f);
  return { modified, deleted, added, tampered: modified.length + deleted.length > 0 };
}

export function tamperReasons(diff) {
  const r = [];
  if (diff.modified.length) r.push(`the coding agent changed protected test files: ${diff.modified.join(', ')}`);
  if (diff.deleted.length) r.push(`the coding agent deleted protected test files: ${diff.deleted.join(', ')}`);
  if (r.length) r.push('a pass against edited tests is not accepted; restore the tests or have a person approve the change');
  return r;
}

