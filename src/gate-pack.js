// One place that turns an evidence pack into a gate decision, used by the CLI, the MCP server and the GitHub Action.
import { loadPack, pickScreenshot, classifyFailure, coverageGaps, postActionInputs } from './evidence.js';
import { decide } from './gate.js';
import { runJury } from './judge.js';

export async function gatePack(packFile, { claim, strict = false, cacheFile } = {}) {
  const pack = loadPack(packFile); const t = pack.tests[0];
  const failure = classifyFailure(pack), gaps = coverageGaps(pack), post = postActionInputs(pack); let jury = null;
  if (claim && failure.kind !== 'infrastructure') { const p = pickScreenshot(pack); jury = (await runJury({ claim, image: p.image, mime: p.mime, evidenceName: `step${p.step}.jpg`, ...(cacheFile ? { cacheFile } : {}) })).result; }
  const d = decide({ kaneStatus: t?.status, failure, gaps, jury, post, strict });
  return { ...d, kane_status: t?.status, title: pack.title, jury: jury ? { verdict: jury.verdict, agree: `${jury.agree}/${jury.of}`, dissent: jury.dissent } : null };
}
export const EXIT = { allow: 0, fix: 1, rerun: 4, recheck: 5, review: 5 };
