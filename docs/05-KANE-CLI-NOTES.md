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
Every run seals an `.evidence` pack: per-step screenshots, network and console logs, run logs, failure records. `kane-cli evidence serve <path>` serves it locally (nothing uploaded). Another entry's README says the pack contains `logs/*-network.har` and `logs/*-console.ndjson`, and that `kane-cli evidence verdict --policy <file.yaml>` applies a code policy. **We have not seen a real pack ourselves.**

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
