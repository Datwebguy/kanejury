# Integrations

All of them share one decision function (`src/gate.js`), so they always agree.

## Command line

```bash
node src/cli.js gate run.evidence        # prints the decision; exit 0 allow, 1 fix, 4 rerun, 5 recheck/review
node src/cli.js judge-pack run.evidence --claim "..."
node src/cli.js loop --objective "..." --url http://localhost:3000 --agent "node agent.mjs"
```

## MCP server

`kanejury-mcp` (`node src/mcp.js`) speaks MCP over stdio with no dependencies.

```json
{ "mcpServers": { "kanejury": { "command": "node", "args": ["/path/to/kanejury/src/mcp.js"] } } }
```

Tools: `kanejury_inspect_pack`, `kanejury_gate`, `kanejury_judge_pack` (writes a receipt), `kanejury_verify_receipt`, `kanejury_guard_snapshot`, `kanejury_guard_check`.

## GitHub Action

```yaml
- uses: Datwebguy/kanejury@main
  with:
    pack: .testmuai/evidence      # an .evidence file or a folder of them
    claim: "The checkout total is shown."   # optional; adds the vision jury (needs NEAR_AI_API_KEY)
    fail-on: fix,recheck,review
```

Outputs `action` and `reasons`, and writes a job summary. See `examples/github-workflow.yml`.

## Claude Code hooks

Two hooks close the loop for a coding agent:

- `hooks/claude-code-prompt.mjs` (UserPromptSubmit) fingerprints the protected tests when you give the agent a task. The fingerprint is kept outside the project, in `~/.kanejury/baselines/` (or `KANEJURY_STATE_DIR`), so the agent cannot delete it along with a test. If it is missing when the agent stops, the guard fails closed.
- `hooks/claude-code-stop.mjs` (Stop) runs Kane when the agent says it is done, gates the result, and returns the reasons to the agent. If a protected test was edited or deleted, it blocks the finish and asks the agent to restore the tests, even when Kane passed. After three attempts it hands over to a person.

```json
{ "hooks": {
  "UserPromptSubmit": [ { "hooks": [ { "type": "command",
    "command": "KANEJURY_OBJECTIVE='...' node /path/to/kanejury/hooks/claude-code-prompt.mjs" } ] } ],
  "Stop": [ { "hooks": [ { "type": "command",
    "command": "KANEJURY_OBJECTIVE='...' KANEJURY_URL=http://localhost:3000 node /path/to/kanejury/hooks/claude-code-stop.mjs" } ] } ]
} }
```

## Test guard

The guard makes sure a coding agent reaches green by fixing the application, not by changing the test. It fingerprints (SHA-256) every file under the protected paths before the agent works and compares afterwards:

| Change | Result |
|---|---|
| none | unchanged, the normal gate decides |
| a protected test edited | `review`, even if Kane passed |
| a protected test deleted | `review`, even if Kane passed |
| a new test added | allowed and reported |

Protected paths: Kane's saved tests in `.testmuai/tests`, plus anything in `KANEJURY_PROTECT` (comma separated) or `--protect`.

```bash
node src/cli.js guard snapshot --protect e2e,tests   # before the agent starts
node src/cli.js guard check                          # exit 0 unchanged, 5 review
```

The loop (`kanejury loop`) takes the fingerprint before the agent's first turn and checks it after every turn. The MCP server offers the same as `kanejury_guard_snapshot` and `kanejury_guard_check`.
