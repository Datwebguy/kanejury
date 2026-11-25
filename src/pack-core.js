// Browser- and Node-safe core of the evidence reader: parse an unzipped Kane pack and run the plain-code checks.
// Input is a Map of file name -> bytes (Uint8Array or Buffer). Never returns result.yaml's account fields.
const dec = new TextDecoder();
const field = (text, key) => { const m = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(text || ''); return m ? m[1].trim().replace(/^'|'$/g, '') : null; };

export function parsePack(files) {
  const text = (n) => (files.has(n) ? dec.decode(files.get(n)) : '');
  const run = text('run.yaml');
  const testDirs = [...new Set([...files.keys()].map((k) => /^tests\/([^/]+)\//.exec(k)?.[1]).filter(Boolean))];
  const tests = testDirs.map((dir) => {
    const stepDirs = [...new Set([...files.keys()].map((k) => new RegExp(`^tests/${dir}/steps/([^/]+)/`).exec(k)?.[1]).filter(Boolean))]
      .map((d) => ({ d, ord: parseInt(d, 10) })).sort((a, b) => a.ord - b.ord);
    const steps = stepDirs.map(({ d, ord }) => {
      let info = {}; try { info = JSON.parse(text(`tests/${dir}/steps/${d}/step.json`)); } catch {}
      const shot = files.get(`tests/${dir}/steps/${d}/screenshot.jpg`) || null;
      return { ordinal: ord, kind: info.kind, status: info.status, summary: info.summary, url: info.url, screenshot: shot, failure: field(text(`tests/${dir}/steps/${d}/failure.yaml`), 'message') };
    });
    let sum = {}; try { sum = JSON.parse(text(`tests/${dir}/v16-trajectory/0-run_summary.json`)); } catch {}
    return { name: dir, status: field(text(`tests/${dir}/result.yaml`), 'status'), objective: sum.objective || null, startUrl: sum.start_url || null, steps };
  });
  return { title: field(run, 'title'), totals: { passed: +field(run, 'passed'), failed: +field(run, 'failed'), broken: +field(run, 'broken') }, tests };
}

// The screenshot at a given step ordinal, or the last one that has a screenshot.
export function pickScreenshot(pack, test = 0, step = 'last') {
  const t = pack.tests[test]; if (!t) throw new Error('pack has no test');
  const withShot = t.steps.filter((s) => s.screenshot);
  if (!withShot.length) throw new Error('pack has no step screenshots');
  const s = step === 'last' ? withShot[withShot.length - 1] : withShot.find((x) => x.ordinal === Number(step));
  if (!s) throw new Error(`no screenshot at step ${step}`);
  return { image: s.screenshot, mime: 'image/jpeg', step: s.ordinal, total: withShot.length };
}

// Deterministic check, no model: is a Kane "failure" really infrastructure trouble rather than a verdict on the claim?
// Patterns come from messages seen in real Kane runs (a browser crash during a screenshot; credits exhausted) plus common transport errors.
const INFRA = /TargetClosedError|Target page, context or browser has been closed|Credits exhausted|insufficient credits|net::ERR_|ECONNRESET|socket hang up|Navigation timeout|browser has been closed|Screenshot failed/i;
// Kane failing to understand or evaluate the objective is not a verdict on the app either (messages seen in real runs on 2026-11-24).
const HARNESS = /mandatory (?:first|initial) (?:check|checkpoint)|condition (?:was )?unspecified|could not be (?:answered|evaluated) truthfully|child agent treated/i;
export function classifyFailure(pack, test = 0) {
  const t = pack.tests[test]; if (!t) return { kind: 'none', why: 'no test in pack' };
  const msgs = t.steps.filter((s) => s.status && s.status !== 'passed').flatMap((s) => [s.failure, s.summary]).filter(Boolean);
  const hit = msgs.find((m) => INFRA.test(m) || HARNESS.test(m));
  if (t.status === 'passed') return { kind: 'none', why: 'Kane reported a pass' };
  if (hit) return { kind: 'infrastructure', why: hit.slice(0, 160) };
  if (t.status === 'broken') return { kind: 'infrastructure', why: 'Kane marked the test "broken" (could not evaluate the objective)' };
  return { kind: 'assertion', why: (msgs[0] || 'assertion failed').slice(0, 160) };
}

// Deterministic integrity check: does every click, press or select the objective names appear in Kane's recorded steps?
// A requested action missing from the trail means Kane's story and Kane's logs disagree.
const CLICK_RE = /\b(?:click|press|tap|select|choose)(?:ing)?\s+(?:on\s+)?(?:the\s+)?([A-Za-z0-9 _.'-]{2,40}?)(?=\s+(?:button|filter|link|tab|option|checkbox)\b|\s*,|\s*;|\s*\.|\s+then\b|\s+from\b|\s+once\b|$)/gi;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function requestedActions(objective) {
  const out = []; let m; CLICK_RE.lastIndex = 0;
  const text = String(objective || '').replace(/\b(?:without|do not|don't|never)\s+(?:click|press|tap|select|choose)\w*\s+\w+/gi, ' ');
  while ((m = CLICK_RE.exec(text))) { const label = norm(m[1]).replace(/^(the|a|an)\s+/, ''); if (label && label.length > 1 && !out.includes(label)) out.push(label); }
  return out;
}
export function coverageGaps(pack, test = 0) {
  const t = pack.tests[test]; if (!t || !t.objective) return { checked: [], missing: [], note: 'no objective in pack' };
  const acted = t.steps.filter((s) => ['click', 'press_key', 'select', 'type'].includes(s.kind)).map((s) => norm(s.summary)).join(' | ');
  const wanted = requestedActions(t.objective);
  return { checked: wanted, missing: wanted.filter((w) => !acted.includes(w)) };
}

// Deterministic check: typing or key presses AFTER the last click the objective asked for.
// That is the pattern of an agent repairing the page state so its own final check passes.
export function postActionInputs(pack, test = 0) {
  const t = pack.tests[test]; if (!t || !t.objective) return { after: null, steps: [] };
  const wanted = requestedActions(t.objective); if (!wanted.length) return { after: null, steps: [] };
  const steps = t.steps; let last = -1;
  steps.forEach((s, i) => { if (['click', 'select'].includes(s.kind) && wanted.some((w) => norm(s.summary).includes(w))) last = i; });
  if (last < 0) return { after: null, steps: [] };
  return { after: wanted.join(' / '), steps: steps.slice(last + 1).filter((s) => ['type', 'press_key'].includes(s.kind)).map((s) => ({ ordinal: s.ordinal, summary: String(s.summary || '').replace(/\s+/g, ' ').slice(0, 120) })) };
}
