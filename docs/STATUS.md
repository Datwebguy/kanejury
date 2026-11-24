# KaneJury status (2026-11-24)
Nothing here has been run on real Kane output yet. Kane CLI is not logged in.

| Feature | State |
|---|---|
| Decision logic (majority and cautious policy, calibration exclusion, no_quorum) | Built, 9 unit tests with hand-computed answers pass |
| Three NEAR AI jurors reading an evidence image | Built, run live on 21 labelled test screenshots (not Kane output) |
| Per-day calibration (known-true and known-false fixture per juror) | Built, run live, all three jurors eligible |
| Signed receipt with embedded responses | Built |
| Receipt verify, offline: signed hashes, signature recovery to the signing address, verdict re-derived from the signed response, result recomputed | Built, tested incl. a consistent forgery (rejected) |
| Receipt verify, rebuild of the request from claim + evidence file | Built, tested incl. wrong file (rejected) |
| Receipt verify, online: signing address in a live attestation, nonce echoed | Built, run live |
| Verification of the Intel TDX and NVIDIA quotes | **Not done.** Use NEAR AI's open verifier. |
| Calibration results signed per fixture call | **Not done.** Eligibility is recorded in the receipt but not individually signed. |
| Reading a real Kane evidence pack | Layout seen first-hand (docs/05). **Reader not built yet.** KaneJury judged one real Kane screenshot (JPEG) from the CLI: false claim got FAIL 2 of 3 with one inconclusive dissent; a true control claim got PASS 3 of 3; receipts verified. Two real cases, not an accuracy measure. |
| Kane re-run only when jurors split | Planned |
| MCP tool, GitHub Action, Claude Code stop-hook | Planned |
| Measured benefit over Kane alone | **Unknown.** On our test images single models were 12/13 and 13/13. A false green seen once did not reproduce on a second run. |
