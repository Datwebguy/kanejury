# Kane CLI notes (verified 2026-11-24)

Version installed in scratch: `@testmuai/kane-cli` 0.10.8 (0.10.9 exists). Node 18+. Needs Google Chrome for local browser runs (`/usr/bin/google-chrome` exists in the container). Docs: `https://www.testmuai.com/docs/kane-cli-introduction`, agent index `https://www.testmuai.com/kane-cli/llms.txt`, agent rules `https://www.testmuai.com/kane-cli-agent/AGENTS.md`, repo `https://github.com/LambdaTest/kane-cli`, cookbook `https://www.testmuai.com/kane-cli-cookbook/`.

## Commands seen in `--help`
`run`, `testmd` (run, list, status, delete, export (Playwright), sync), `testrun`, `explore`, `context`, `design`, `cover`, `maintain`, `evidence`, `bugs`, `generate`, `config`, `login`, `logout`, `whoami`, `balance`, `devices`, `apps`, `folders`, `install` (agent skill into Claude Code, Codex CLI, Gemini CLI), `plugin`, `feedback`, `changelog`.

## Run
`kane-cli run "<objective>" --agent --headless [--url ..] [--timeout s] [--max-steps n] [--name <flow>] [--variables-file f]`. Always pass `--agent` for scripted use (NDJSON on stdout). Every run needs a start URL. The `run` subcommand is mandatory. End objectives with an assertion ("verify ..."). Assert outcomes, not triggers.

## Output
NDJSON events. First line `stream_start`. Progress lines have `step`, `status` (running, done, failed), `remark`. Last line `run_end` with `status`, `summary`, `one_liner`, `reason`, `duration`, `credits_consumed`, `final_state`, `test_url`, `session_dir`.
Exit codes: `0` passed, `1` failed (objective ran but did not pass, start URL did not load, or upload failed), `2` did not start (no start URL, sign-in, config, Chrome), `3` timeout or cancelled. A start URL that does not load ends in exit 1 after about 45 s and still spends credits. KaneJury uses 4 for "inconclusive" to avoid clashing with 3.

## Saved tests
`--name <flow>` writes `.testmuai/tests/<flow>_test.md` and `output-<flow>/`. `kane-cli testmd run <file> --agent --headless` replays unchanged steps from recordings with **no LLM cost**. A step re-authors when its text changes, its recording is missing, or an earlier step re-authored. When a replay no longer matches the page, Kane re-authors from that step (up to 3 attempts), then the whole test; `--no-adaptive-heal` makes a replay miss fail instead. `testrun run --tags smoke --parallel 4 --headless --agent` runs a suite (exit codes 0 all passed, 1 failed, 2 nothing ran, 3 cancelled). The `testmd run` stream ends with `test_md_done`.

## Evidence
Every run seals an `.evidence` pack: per-step screenshots, network and console logs, run logs, failure records. `kane-cli evidence serve <path>` serves it locally (nothing uploaded). Another entry's README says the pack contains `logs/*-network.har` and `logs/*-console.ndjson`, and that `kane-cli evidence verdict --policy <file.yaml>` applies a code policy. **Seen first-hand on 2026-11-24 (see below).**

## Login and credits
- `kane-cli login --oauth` needs a browser (not possible in the cloud container).
- `kane-cli login --username <u> --access-key <k>` (basic auth). It validates against the controller (`getTmsCredentials`) at `kaneai-api.lambdatest.com` for prod. Dummy values returned "Credentials not valid", which proves the network path works.
- Key location: TestMu AI, Profile, Account Settings, Password and Security (`https://accounts.lambdatest.com/security/username-accesskey`).
- Credits: 10,000 free for 30 days after registering on TestMu AI. KaneAI has no free-forever plan. A one-off example in the docs shows 12 credits for a 45 s run (an example, not a measured price). Replays of unchanged steps cost no LLM credits per the docs; whether they cost any credits is **unconfirmed**.
- Hosts seen in the package: `kaneai-api`, `test-manager-api`, `api`, `integrations`, `mobile-api`, `mobile-hub`, `test-backend`, `downloads` (all `*.lambdatest.com`) and `www.testmuai.com`.

## Mobile
Real Android and iOS devices run in the TestMu cloud with `--target android|ios --app <build>` (needs KaneAI Max or credits plus a Real Device plan). Local emulator and simulator need macOS on Apple Silicon. The owner has an Android phone but the container cannot drive it.

## Unconfirmed
Credit cost per run and per replay; exact evidence pack layout; whether `evidence verdict` policies can read screenshots; whether more than one host needs a credential in the secure form.

## Real evidence pack layout (seen first-hand, kane-cli 0.10.8, one failed run)
An `.evidence` file is a plain **zip (stored, no compression)**. Contents for one test:
- `run.yaml` (producer, surfaces, totals: tests, passed, failed, **broken**, skipped), `failure.yaml` (index of failures), `meta/metrics-catalog.yaml`.
- `tests/<name>/result.yaml` with the test status and a per-step list. **It also contains the account's email, user name and organisation id, so never copy it wholesale into receipts or public files.**
- `tests/<name>/steps/<n>-0-<n>/screenshot.jpg` (1920x1080 JPEG), `step.json` (kind, status, summary, url) and, on failure, `failure.yaml` (error message, page URL, pointers into the console log and network log at the failure).
- `tests/<name>/logs/`: `0-actions.ndjson`, `0-console.ndjson`, `0-network.har`, `0-run.log`, `0-stability-ledger.ndjson`, `meta.yaml`, `tui.log`.
- `tests/<name>/auteur/execution.json`, `v16-trajectory/0-run_summary.json` and a DAG diagram.
Status words differ: a run that could not evaluate the objective is **`broken`**, not `failed` (here: "Credits exhausted: insufficient credits"). Kane's own validator printed an advisory that the failure record's status ("broken") disagrees with the result's step status ("failed"), so Kane's own evidence is not always self-consistent.
Session files also live under `~/.testmuai/kaneai/sessions/<id>/` (`events.ndjson`, `execution.json`, `session.json`, `tui.log`, `evidence/<id>.evidence`).

## First runs and the credit block (2026-11-24)
- Login done with the email OAuth flow (see the handoff). OAuth redirects to `http://127.0.0.1:<port>/callback`; the CLI waits only **120 seconds** for it (hard-coded), and crashes in a container without `xdg-open` unless a stub on PATH captures the link.
- A credential saved for `kaneai-api.lambdatest.com` in the session proxy **overwrote the Authorization header** and made a good OAuth login look rejected. Deleting that saved secret fixed it. Never save a credential for that host when logging in with OAuth.
- `kane-cli balance` returned **0 credits**. A run reached Chrome, navigated, then stopped with `Credits exhausted: {"error":"insufficient credits"}` and consumed 0 credits.
- A run objective that names a URL in words still needs `--url <url>` ("No start URL provided" otherwise).
- The first run auto-created a project ("KaneAI Generated") and a folder ("Untitled") in the TestMu account.
