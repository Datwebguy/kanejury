# Evidence packs

Every Kane CLI run seals an `.evidence` file. KaneJury reads it directly; nothing is uploaded.

## Layout (kane-cli 0.10.8)

An `.evidence` file is a plain zip with stored (uncompressed) entries:

- `run.yaml` and `failure.yaml`: totals and an index of failures.
- `tests/<name>/result.yaml`: the test status and a per-step list.
- `tests/<name>/steps/<n>-0-<n>/`: `screenshot.jpg`, `step.json` (kind, status, summary, url) and, on failure, `failure.yaml`.
- `tests/<name>/logs/`: actions, console, network (HAR) and run logs.
- `tests/<name>/auteur/execution.json` and `v16-trajectory/0-run_summary.json` (objective and start URL).

`result.yaml` contains account fields (email, user name, organisation id). KaneJury never copies them into receipts, reports or logs.

Status words are `passed`, `failed` and `broken`. A run that could not evaluate its objective is `broken`.

## What KaneJury checks

| Check | Question | Result |
|---|---|---|
| `classifyFailure` | Was the failure infrastructure (browser crash, exhausted credits, network error, screenshot failure) or Kane's own parser failure, rather than the app under test? | `rerun`, and no model is called |
| `coverageGaps` | Does every click named in the objective appear in the recorded steps? Phrases such as "without clicking" are ignored. | `review` |
| `postActionInputs` | Did Kane type or press keys after the last requested click? That is the signature of repairing the page to pass. | `recheck` |
| Vision jury | Does the last screenshot support the claim? | `allow`, `fix` or `review` |

## Kane run modes

The default `testing` mode lets Kane recover from unexpected state. `--mode action` is the strict mode: Kane performs the objective as written and fails if the page does not allow it. `recheck` uses strict mode. Do not add strictness wording to the objective itself; use the flag.

## Cost

A run takes about 44 seconds and about 21 credits (balance change across 25 runs). Kane's `run_end` event reports about 13% less than the balance moves.

Exit codes of `kane-cli run`: 0 passed, 1 failed, 2 did not start, 3 timeout or cancelled.
