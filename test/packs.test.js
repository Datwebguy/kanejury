import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gatePack } from '../src/gate-pack.js';
import { readZip } from '../src/evidence.js';

// Real Kane CLI evidence packs (account fields redacted). The gate must keep giving the same decisions.
const cases = [
  ['round1', 'passed', 'recheck'],
  ['round2-strict', 'failed', 'fix'],
  ['crash', 'broken', 'rerun'],
  ['round3', 'passed', 'allow'],
];
for (const [name, kane, action] of cases) {
  test(`real pack ${name}: Kane ${kane} -> ${action}`, async () => {
    const g = await gatePack(`examples/packs/${name}.evidence`);
    assert.equal(g.kane_status, kane); assert.equal(g.action, action);
  });
}
test('sample packs carry no account details', () => {
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}/;
  for (const [name] of cases) for (const [file, bytes] of readZip(fs.readFileSync(`examples/packs/${name}.evidence`))) {
    const text = Buffer.from(bytes).toString('latin1');
    if (/result\.yaml$/.test(file)) for (const k of ['org_id', 'user_name', 'user_email']) assert.match(text, new RegExp(`^\\s*${k}: redacted$`, 'm'), `${name}: ${k}`);
    if (/execution\.json$/.test(file)) assert.doesNotMatch(text, /"(org_id|user_id)": *"?\d/, `${name}: ids in ${file}`);
    if (/\.(yaml|json|log|ndjson|md)$/.test(file)) assert.doesNotMatch(text, email, `${name}: email address in ${file}`);
    assert.equal(/tui\.log$/.test(file), false, `${name}: ${file} should be removed`);
  }
});
