// Pure helpers shared by the CLI, the MCP server and the browser verifier. No Node-only imports.
export function parseVerdict(text) {
  const m = /\{[\s\S]*?\}/.exec(text || '');
  if (!m) return { verdict: 'error', quote: '' };
  try {
    const o = JSON.parse(m[0]);
    const v = String(o.verdict || '').trim().toLowerCase();
    return { verdict: ['pass', 'fail', 'inconclusive'].includes(v) ? v : 'error', quote: String(o.quote || '').slice(0, 300) };
  } catch { return { verdict: 'error', quote: '' }; }
}
