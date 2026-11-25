// KaneJury in the browser: read a Kane evidence pack and run the same plain-code checks and gate as the CLI.
// Nothing is uploaded; the pack is read with the browser's own zip inflater.
import { parsePack, classifyFailure, coverageGaps, postActionInputs } from './pack-core.js';
import { decide } from './gate.js';
import { compareSnapshots, tamperReasons } from './guard-core.js';

async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function readZip(arrayBuffer) {
  const b = new Uint8Array(arrayBuffer), v = new DataView(arrayBuffer);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a Kane evidence pack (not a zip file).');
  const count = v.getUint16(eocd + 10, true); let p = v.getUint32(eocd + 16, true);
  const files = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The zip directory is damaged.');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    const ds = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
    const raw = b.slice(ds, ds + csize);
    if (!name.endsWith('/')) files.set(name, method === 0 ? raw : await inflateRaw(raw));
    p += 46 + nlen + elen + clen;
  }
  return files;
}

export async function inspectPack(arrayBuffer) {
  const pack = parsePack(await readZip(arrayBuffer));
  const t = pack.tests[0];
  if (!t) throw new Error('No test found in this pack.');
  const failure = classifyFailure(pack), gaps = coverageGaps(pack), post = postActionInputs(pack);
  const decision = decide({ kaneStatus: t.status, failure, gaps, post });
  return { pack, test: t, failure, gaps, post, decision };
}

export async function sha256Text(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export { compareSnapshots, tamperReasons, decide };
