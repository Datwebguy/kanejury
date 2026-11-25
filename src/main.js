// True when this module is the program being run, also when it is started through an npm bin symlink.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
export function isMain(moduleUrl) {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(moduleUrl)); } catch { return false; }
}
