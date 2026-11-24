// Reader for Kane CLI evidence packs (.evidence files are plain zip archives).
// It exposes only what KaneJury needs: run and test status, step list, step screenshots, failure message.
// It never returns result.yaml's account fields (email, user name, organisation id).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(ds, ds + csize);
    files.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const field = (text, key) => { const m = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(text || ''); return m ? m[1].trim().replace(/^'|'$/g, '') : null; };

export function loadPack(file) {
  const files = readZip(fs.readFileSync(file));
  const text = (n) => (files.has(n) ? files.get(n).toString('utf8') : '');
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
export function classifyFailure(pack, test = 0) {
  const t = pack.tests[test]; if (!t) return { kind: 'none', why: 'no test in pack' };
  const msgs = t.steps.filter((s) => s.status && s.status !== 'passed').flatMap((s) => [s.failure, s.summary]).filter(Boolean);
  const hit = msgs.find((m) => INFRA.test(m));
  if (t.status === 'passed') return { kind: 'none', why: 'Kane reported a pass' };
  if (hit) return { kind: 'infrastructure', why: hit.slice(0, 160) };
  if (t.status === 'broken') return { kind: 'infrastructure', why: 'Kane marked the test "broken" (could not evaluate the objective)' };
  return { kind: 'assertion', why: (msgs[0] || 'assertion failed').slice(0, 160) };
}
