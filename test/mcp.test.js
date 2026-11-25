import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { makeZip } from './helpers/zip.js';
import { handle, TOOLS, callTool } from '../src/mcp.js';

const file = path.join(os.tmpdir(), 'kanejury-mcp-test.evidence');
fs.writeFileSync(file, makeZip([
  ['run.yaml', Buffer.from('title: Verify the counter\ntotals:\n  passed: 0\n  failed: 1\n  broken: 0\n')],
  ['tests/t1/result.yaml', Buffer.from('status: failed\n')],
  ['tests/t1/v16-trajectory/0-run_summary.json', Buffer.from(JSON.stringify({ objective: 'Add x, click Clear completed, then verify the list is empty', start_url: 'https://x.test/' }))],
  ['tests/t1/steps/1-0-1/step.json', Buffer.from('{"kind":"click","status":"passed","summary":"Clicking Clear completed"}')],
  ['tests/t1/steps/2-0-2/step.json', Buffer.from('{"kind":"assert","status":"failed","summary":"assert: the list is empty"}')],
  ['tests/t1/steps/2-0-2/failure.yaml', Buffer.from("error:\n  message: 'the list still shows x'\n")],
]));
const call = async (name, args) => JSON.parse((await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).result.content[0].text);

test('initialize returns the server identity and tool capability', async () => { const r = (await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })).result; assert.equal(r.serverInfo.name, 'kanejury'); assert.ok(r.capabilities.tools); assert.equal(r.protocolVersion, '2025-03-26'); });
test('tools/list exposes the six tools with schemas', async () => { const r = (await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools; assert.deepEqual(r.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort()); assert.equal(r.length, 6); for (const t of r) assert.equal(t.inputSchema.type, 'object'); });
test('inspect_pack summarises a pack without calling any model', async () => { const o = await call('kanejury_inspect_pack', { pack: file }); assert.equal(o.kane_status, 'failed'); assert.equal(o.failure.kind, 'assertion'); assert.equal(o.steps.length, 2); });
test('gate sends a confirmed assertion failure to the agent', async () => { const o = await call('kanejury_gate', { pack: file }); assert.equal(o.action, 'fix'); });
test('notifications get no reply and unknown methods get an error', async () => { assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null); assert.equal((await handle({ jsonrpc: '2.0', id: 9, method: 'nope' })).error.code, -32601); });
test('a bad path is reported as a tool error, not a crash', async () => { const r = (await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'kanejury_gate', arguments: { pack: '/no/such.evidence' } } })).result; assert.equal(r.isError, true); });
test('the server speaks newline-delimited JSON-RPC over stdio', async () => {
  const p = spawn(process.execPath, [new URL('../src/mcp.js', import.meta.url).pathname]); let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  await new Promise((r) => setTimeout(r, 700)); p.kill();
  const lines = out.trim().split('\n').map((l) => JSON.parse(l)); assert.equal(lines.length, 2); assert.equal(lines[1].result.tools.length, 6);
});

test('guard tools: snapshot, then a weakened test comes back as review', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kj-mcp-guard-')); fs.mkdirSync(path.join(d, '.testmuai/tests'), { recursive: true });
  fs.writeFileSync(path.join(d, '.testmuai/tests/t_test.md'), '- verify the list shows b\n');
  const snap = JSON.parse((await callTool('kanejury_guard_snapshot', { root: d })).content[0].text); assert.equal(snap.files, 1);
  assert.equal(JSON.parse((await callTool('kanejury_guard_check', { root: d })).content[0].text).action, 'allow');
  fs.writeFileSync(path.join(d, '.testmuai/tests/t_test.md'), '- open the page\n');
  const c = JSON.parse((await callTool('kanejury_guard_check', { root: d })).content[0].text); assert.equal(c.action, 'review'); assert.deepEqual(c.modified, ['.testmuai/tests/t_test.md']);
});
