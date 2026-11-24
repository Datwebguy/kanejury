// Per-day calibration: each juror must answer one known-true and one known-false fixture correctly
// before its vote counts. The fixtures are labelled test images (fixtures/README.md), not Kane output.
import fs from 'node:fs';
import path from 'node:path';
import { ask } from './jurors.js';
import { sha256 } from './near.js';
const here = path.dirname(new URL(import.meta.url).pathname);
export const CAL_CLAIM = 'Price shown at checkout matches the advertised Pro price.';
export const FIXTURES = { true: path.join(here, '../fixtures/canary-true.png'), false: path.join(here, '../fixtures/canary-false.png') };

export async function calibrate(jurors, { cacheFile = '.kanejury/calibration.json', ttlHours = 6, force = false } = {}) {
  if (!force && fs.existsSync(cacheFile)) {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const sameJurors = JSON.stringify(Object.keys(c.jurors).sort()) === JSON.stringify(jurors.map((j) => j.id).sort());
    if (sameJurors && Date.now() - Date.parse(c.takenAt) < ttlHours * 3600e3) return { ...c, cached: true };
  }
  const imgTrue = fs.readFileSync(FIXTURES.true), imgFalse = fs.readFileSync(FIXTURES.false);
  const out = { takenAt: new Date().toISOString(), claim: CAL_CLAIM, fixtures: { true: sha256(imgTrue), false: sha256(imgFalse) }, jurors: {} };
  await Promise.all(jurors.map(async (j) => {
    try {
      const [t, f] = await Promise.all([ask(j, CAL_CLAIM, imgTrue), ask(j, CAL_CLAIM, imgFalse)]);
      out.jurors[j.id] = { model: j.model, eligible: t.verdict === 'pass' && f.verdict === 'fail', onTrue: t.verdict, onFalse: f.verdict };
    } catch (e) { out.jurors[j.id] = { model: j.model, eligible: false, error: e.message }; }
  }));
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(out, null, 2));
  return { ...out, cached: false };
}
