// A real coding agent for the demo: it reads Kane's failure brief and the app file, asks a hosted LLM for a fix, and writes it.
// Not scripted: the patch comes from the model each time. Needs the NEAR AI credential (NEAR_AI_API_KEY) or a proxy that injects it.
import fs from 'node:fs';
const brief = JSON.parse(fs.readFileSync(process.env.KANEJURY_BRIEF, 'utf8'));
const file = process.env.APP_FILE || 'todo-app/index.html';
const source = fs.readFileSync(file, 'utf8');
// Tries models in order because a hosted model can be briefly unavailable (one returned HTTP 502 during testing).
const models = process.env.AGENT_MODEL ? [process.env.AGENT_MODEL] : ['Qwen/Qwen3.6-35B-A3B-FP8', 'z-ai/glm-5.3-flash', 'deepseek/deepseek-v4.1-flash'];
const prompt = `You are a coding agent. A browser test run by Kane CLI failed on a small web app.\n\nWhat Kane was asked to do: ${brief.objective}\nWhat Kane reported: ${brief.kane_said}\n\nHere is the app file (${file}):\n\n${source}\n\nFix the app so the test passes. Make the smallest change that fixes the behaviour. Do not change visible text or the page structure. Reply with the COMPLETE corrected file in one \`\`\`html code block and nothing else.`;
const headers = { 'Content-Type': 'application/json', ...(process.env.NEAR_AI_API_KEY ? { Authorization: `Bearer ${process.env.NEAR_AI_API_KEY}` } : {}) };
let text = '', model = '';
for (const m of models) {
  const res = await fetch('https://cloud-api.near.ai/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: m, max_tokens: 8000, temperature: 0, messages: [{ role: 'user', content: prompt }] }) });
  if (!res.ok) { console.error(`agent: ${m} failed with HTTP ${res.status}`); continue; }
  text = (await res.json()).choices?.[0]?.message?.content || ''; model = m; if (/```html/.test(text)) break;
}
if (!model) { console.error('agent: every model failed'); process.exit(2); }
const m = /```html\s*([\s\S]*?)```/.exec(text);
if (!m || !m[1].includes('<html')) { console.error('agent: no complete html file in the reply'); process.exit(3); }
fs.writeFileSync(file, m[1].trim() + '\n');
console.log(`agent: wrote a patch from ${model} (${m[1].length} chars)`);
