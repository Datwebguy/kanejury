# Integrations

All four share one decision function (`src/gate-pack.js`), so they always agree.

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

Tools: `kanejury_inspect_pack`, `kanejury_gate`, `kanejury_judge_pack` (writes a receipt), `kanejury_verify_receipt`.

## GitHub Action

```yaml
- uses: Datwebguy/kanejury@main
  with:
    pack: .testmuai/evidence      # an .evidence file or a folder of them
    claim: "The checkout total is shown."   # optional; adds the vision jury (needs NEAR_AI_API_KEY)
    fail-on: fix,recheck,review
```

Outputs `action` and `reasons`, and writes a job summary. See `examples/github-workflow.yml`.

## Claude Code Stop hook

`hooks/claude-code-stop.mjs` runs Kane after each agent turn, gates the result, and returns the reasons to the agent. It stops after three attempts and hands over to a person.

```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "command",
  "command": "KANEJURY_OBJECTIVE='...' KANEJURY_URL=http://localhost:3000 node /path/to/kanejury/hooks/claude-code-stop.mjs" } ] } ] } }
```
