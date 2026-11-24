# Demo: the closed loop

`todo-app/index.html` is a tiny todo app written for this demo. **It contains one deliberately planted bug**: the "Clear completed" button removes every item instead of only the completed ones. The bug is planted so the right answer is known.

`agent.mjs` is a real coding agent: it reads Kane's failure report and the file, asks a hosted language model for a fix, and writes the result. Nothing is scripted or prepared; the patch differs from run to run.

```bash
# serve the app, then let KaneJury run Kane, gate the result, and call the agent only on a confirmed failure
cd demo && python3 -m http.server 8765 --bind 127.0.0.1 &
node ../src/cli.js loop \
  --objective "Add a todo called a, add a todo called b, mark a as completed, click Clear completed, then verify the list shows b" \
  --url http://127.0.0.1:8765/todo-app/ \
  --claim "The list shows an item called b." \
  --agent "node agent.mjs" --out loop.json
```
The loop stops after 3 failed fix attempts and hands over to a human. Each Kane run costs about 20 credits.

## What happened when we ran it (real Kane runs, real model)
| Run | What happened | Kane runs | Credits |
|---|---|---|---|
| `results/run1-before-the-recheck-existed.json` | With the bug planted, Kane **passed** and the gate said allow. Kane had noticed the list was empty after "Clear completed", **typed "b" again on its own**, and reported success. A false green. | 1 | 22.3 |
| `results/run2-failed-attempt-strict-wording.json` | First attempt at the recheck. The gate caught the false green, but an extra "be strict" sentence in the objective made Kane's own parser fail in 4 of 5 rechecks, and the agent's model was down (HTTP 502) for every fix. Escalated to a human after 3 fix attempts. Kept as a record. | 7 | 125.9 |
| `results/run3-full-loop.json` | After switching to Kane's built-in strict mode (`--mode action`), adding a model fallback to the agent, and teaching the gate about Kane's own parser failures: round 1 Kane passed but typed after the last requested click, so the gate chose **recheck**; round 2 Kane (strict) **failed honestly** ("the list is empty ... b is not available"); the gate chose **fix** and the agent patched the code (`results/run3-agent-patch.diff`: `todos = []` became `todos = todos.filter(t => !t.done)`); round 3 Kane **passed** and the gate allowed it. | 3 | 49.7 |

The patch is the model's own work from Kane's failure report. It was not prepared in advance.
Scope: one small app and one planted bug. Kane's default mode repaired the page to pass in every lenient-mode run on this app (3 of 3).
