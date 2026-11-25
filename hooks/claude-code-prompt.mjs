#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: fingerprint the protected Kane tests before the agent starts working.
// The Stop hook (claude-code-stop.mjs) compares against this, so a pass against edited or deleted tests is not accepted.
// Protected paths: .testmuai/tests plus anything in KANEJURY_PROTECT (comma separated).
import fs from 'node:fs';
import { snapshotTests, saveSnapshot, protectList } from '../src/guard.js';

if (!process.env.KANEJURY_OBJECTIVE) process.exit(0); // not configured: never get in the way
const file = '.kanejury-baseline.json';
// Keep the first fingerprint of a task; it is cleared when KaneJury allows the result.
if (!fs.existsSync(file)) saveSnapshot(file, snapshotTests(process.cwd(), protectList()));
