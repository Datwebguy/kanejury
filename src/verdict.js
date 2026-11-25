// Pure helpers shared by the CLI, the MCP server and the browser verifier. No Node-only imports.
export function parseVerdict(text) {
  // Try every {...} candidate in order (shortest first) and keep the first one with a known verdict,
  // so a brace inside the quote or an example object before the answer does not spoil the vote.
  const s = String(text || '');
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    for (let j = s.indexOf('}', i); j >= 0; j = s.indexOf('}', j + 1)) {
      let o; try { o = JSON.parse(s.slice(i, j + 1)); } catch { continue; }
      const v = String(o?.verdict || '').trim().toLowerCase();
      if (['pass', 'fail', 'inconclusive'].includes(v)) return { verdict: v, quote: String(o.quote || '').slice(0, 300) };
      break;
    }
  }
  return { verdict: 'error', quote: '' };
}
