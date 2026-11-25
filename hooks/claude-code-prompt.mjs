#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: fingerprint the protected Kane tests before the agent starts working.
// The Stop hook (claude-code-stop.mjs) compares against this, so a pass against edited or deleted tests is not accepted.
// Protected paths: .testmuai/tests plus anything in KANEJURY_PROTECT (comma separated).
import fs from 'node:fs';
import { snapshotTests, saveSnapshot, protectList, hookBaselinePath } from '../src/guard.js';

if (!process.env.KANEJURY_OBJECTIVE) process.exit(0); // not configured: never get in the way
// Kept outside the project (~/.kanejury/baselines) so the agent cannot delete it along with a test.
// Keep the first fingerprint of a task; it is cleared when KaneJury allows the result.
const file = hookBaselinePath();
if (!fs.existsSync(file)) saveSnapshot(file, snapshotTests(process.cwd(), protectList()));
