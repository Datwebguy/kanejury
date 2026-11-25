<p align="center"><img src="docs/assets/logo.svg" width="72" height="72" alt=""></p>

# KaneJury

**Know when to trust a Kane verdict.**

KaneJury reads the evidence behind a [Kane CLI](https://www.testmuai.com/kane-cli/) run and tells your pipeline what to do next: **ship it, fix it, run it again, or look closer.** Every decision can come with a signed receipt that anyone can verify, in a terminal or in a browser tab.

[Proof page and live receipt verifier](https://kanejury.vercel.app) · [Evaluation](docs/evaluation.md) · [Integrations](docs/integrations.md) · [Receipts](docs/receipts.md)

KaneJury is an independent open-source project built on Kane CLI and NEAR AI Cloud. It is not an official TestMu AI product.

---

## The problem

A browser agent returns one word, "passed" or "failed", and automation acts on it. Three things make that word less trustworthy than it looks:

| What happened | Why it matters |
|---|---|
| **Repaired to pass.** The page was broken, so the agent typed the missing item again and reported success. | The bug ships. The step list shows the repair; the summary does not. |
| **A crash labelled as a failure.** The browser died mid-run, and the run is reported as "failed". | A coding agent is sent to fix a bug that does not exist. |
| **Steps that do not match the story.** The summary claims a click that is absent from the recorded steps. | The verdict rests on something that never happened. |
| **Tests edited to pass.** The coding agent cannot make the feature work, so it weakens or deletes the test instead. | The run turns green and nothing was fixed. |

KaneJury opens the sealed evidence pack that Kane writes for every run and checks these things with plain, deterministic code. A vision jury of three attested models gives a second look at what was on screen.

## See it work

The `demo/` folder holds a small todo app with one planted bug: **Clear completed removes every item**. KaneJury runs Kane, gates the result, and calls a real coding model only when a failure is confirmed. This is the recorded run (`demo/results/run3-full-loop.json`):

| Round | Kane says | KaneJury decides | Why |
|---|---|---|---|
| 1 | passed (15.4 credits) | **recheck** | The steps show Kane typing "b" again after the last requested click. It repaired the page. |
| 2 | **failed** in strict mode (19.4 credits) | **fix** | "After clearing, the list is empty, so b is not available." A confirmed failure goes to the coding agent. |
| agent | | patch | `todos = []` becomes `todos = todos.filter(t => !t.done)`. Written by the model from Kane's report. |
| 3 | passed (14.9 credits) | **allow** | Nothing suspicious in the steps. |

Three Kane runs, 49.7 credits, one real fix. Without the check, round 1 would have shipped the bug.

## How it works

```
 Kane run ──► evidence pack ──► checks ──► vision jury ──► gate ──► receipt
 (browser)    (.evidence zip)   plain code   3 attested     5 actions  signed,
                                             models                    verifiable
```

1. **Read the pack.** Steps, screenshots, console and network logs, and Kane's own failure records are parsed from the `.evidence` file. Account fields are never copied out.
2. **Check with plain code.**
   - *Infrastructure or real failure?* Browser crashes, exhausted credits, network errors and Kane's own parser failures are recognised and sent to `rerun`.
   - *Coverage.* Every click the objective names must appear in the recorded steps.
   - *Repair-to-pass.* Typing or key presses after the last requested click are flagged.
   - *Test guard.* The protected tests (Kane's saved tests in `.testmuai/tests`, plus any paths you add) are fingerprinted before the coding agent starts. If the agent edits or deletes one, the result goes to `review`, even when Kane passes. New tests are allowed.
3. **Look at the screen.** Three vision models, hosted by NEAR AI Cloud in hardware enclaves, read the last screenshot and the claim. Each juror must first answer a known-true and a known-false fixture correctly that day, or it is left out.
4. **Decide.** One of five actions:

   | Action | Meaning | Exit code |
   |---|---|---|
   | `allow` | Passed, and nothing looked wrong | 0 |
   | `fix` | A confirmed failure; hand it to the coding agent | 1 |
   | `rerun` | Infrastructure trouble; leave the agent out of it | 4 |
   | `recheck` | Passed, but the steps suggest a repair; run Kane again in strict mode (`--mode action`) | 5 |
   | `review` | The evidence disagrees with itself; a person should look | 5 |

5. **Sign a receipt.** Each juror's full response is stored with its hardware-backed signature, so every verdict can be re-derived by anyone.

## Quick start

Requires Node 20 or newer.

```bash
git clone https://github.com/Datwebguy/kanejury && cd kanejury
npm install
npm test                                   # 69 tests, no network needed

# Decide what to do with a Kane run (no model key needed for the plain-code checks)
node src/cli.js gate path/to/run.evidence

# Add the vision jury (needs a NEAR AI Cloud key)
export NEAR_AI_API_KEY=...
node src/cli.js calibrate
node src/cli.js judge-pack path/to/run.evidence --claim "The cart badge shows 1."

# Check a receipt, offline
node src/cli.js verify examples/receipt-fail.json --image examples/evidence-fail.png

# Guard the tests around a coding agent's work
node src/cli.js guard snapshot              # before the agent starts
node src/cli.js guard check                 # after: exit 0 unchanged, 5 if a test was edited or deleted
```

To run the whole loop (Kane, gate, coding agent, Kane again), see [demo/](demo/).

## Where it plugs in

| Surface | How |
|---|---|
| **Command line** | `kanejury gate`, `judge-pack`, `loop`, `verify`, `calibrate` |
| **MCP server** | `node src/mcp.js` exposes `kanejury_inspect_pack`, `kanejury_gate`, `kanejury_judge_pack`, `kanejury_verify_receipt`, `kanejury_guard_snapshot` and `kanejury_guard_check` to any MCP client |
| **GitHub Action** | `uses: Datwebguy/kanejury@main` reads evidence packs in CI, writes a job summary, fails the build on the actions you choose |
| **Claude Code** | A prompt hook fingerprints the tests when you give the agent a task; a Stop hook runs Kane when the agent says it is done, blocks a pass against edited tests, and feeds the gate's reasons back to the agent, with three attempts before it hands over to a person |
| **Browser** | The [proof page](https://kanejury.vercel.app) verifies a receipt entirely client-side |

Setup for each is in [docs/integrations.md](docs/integrations.md).

## Results from real runs

25 real Kane runs on public test sites, each with a known right answer ([docs/evaluation.md](docs/evaluation.md), raw rows in `bench/results.csv`):

- Kane matched the known answer in **23 of 24** runs that left evidence.
- The infrastructure classifier flagged the one real browser crash (run S2) and nothing else: **1 of 1 found, 0 false alarms** across the 25 packs.
- The repair-to-pass check did not fire on any of the 25 bench runs, and it caught Kane repairing the page in the live demo above (3 of 3 lenient-mode runs).
- The three-model vision jury matched the known answer in **21 of 24**. Its best moment was run T6: one juror misread the page and the other two outvoted it. It works best next to the step checks, which read what the screenshot cannot show.
- A Kane run costs about 21 credits and 44 seconds. Judging a screenshot costs a fraction of a cent.

## Verifiable receipts

A receipt records, for every juror: the model, the exact request and response hashes, the signed text, and the signature. `verify` re-checks all of it:

- the signed text names the model and contains both hashes;
- the signature recovers to the juror's signing address (EIP-191);
- each recorded verdict is what the signed response actually says;
- the final result recomputes from the votes;
- with `--image`, the request rebuilt from the claim and your evidence file matches the signed request hash;
- with `--online`, the signing address appears in a live attestation report that echoes a fresh nonce.

The same checks run in the browser on the [proof page](https://kanejury.vercel.app): paste a receipt, press a button, and try changing a verdict to watch it get rejected. Details are in [docs/receipts.md](docs/receipts.md).

## Repository layout

```
src/        decision engine, evidence reader, jurors, receipts, CLI, MCP server, Action, hook
test/       unit and protocol tests (node:test)
docs/       evidence packs, receipts, evaluation, integrations, roadmap; proof page in docs/index.html
bench/      the 25 real runs: cases.tsv and results.csv
demo/       the planted-bug todo app, the coding agent, and the recorded loop
examples/   a real receipt and its screenshot, a GitHub workflow
fixtures/   labelled images used for daily calibration
scripts/    build-site.mjs (bundles the in-browser verifier)
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md): more recorded cases, per-step screenshot judging, policy files, and on-chain anchoring of receipts.

## License

MIT.
