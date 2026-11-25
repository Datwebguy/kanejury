# Sample Kane evidence packs

Real `.evidence` packs written by Kane CLI 0.10.8. The account fields (email, user name, organisation and user ids) were replaced with `redacted`, and Kane's interface log (`tui.log`) was removed. Nothing else was changed.

| Pack | What happened | `kanejury gate` |
|---|---|---|
| `round1.evidence` | Planted bug: "Clear completed" removes every item. Kane, in its default mode, found the list empty, typed "b" back in (steps 8 and 9) and reported passed. | `recheck` (exit 5) |
| `round2-strict.evidence` | The same objective with `--mode action`. Kane failed honestly: the list was empty. | `fix` (exit 1) |
| `crash.evidence` | A run on the Swag Labs demo shop where the browser crashed during a screenshot. Kane reported it as broken. | `rerun` (exit 4) |
| `round3.evidence` | After the coding agent's fix, Kane passed with nothing unusual in its steps. | `allow` (exit 0) |

Open any of them on https://kanejury.vercel.app (Try it now), or run `node src/cli.js gate <pack>`.
