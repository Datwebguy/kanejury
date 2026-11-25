// Reader for Kane CLI evidence packs (.evidence files are plain zip archives).
// It exposes only what KaneJury needs: run and test status, step list, step screenshots, failure message.
// It never returns result.yaml's account fields (email, user name, organisation id).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parsePack } from './pack-core.js';
export { parsePack, pickScreenshot, classifyFailure, requestedActions, coverageGaps, postActionInputs } from './pack-core.js';

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

export function loadPack(file) { return parsePack(readZip(fs.readFileSync(file))); }
