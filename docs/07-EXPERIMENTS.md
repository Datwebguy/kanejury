# Experiments run so far

All images are labelled test fixtures rendered in Chrome from hand-written HTML. **They are not Kane output.** The scripts and raw results are kept with the author's private working notes and can be shared on request.

## 1. First vision call
One screenshot (pricing box says $19, checkout box says $29.00) to `Qwen/Qwen3-VL-30B-A3B-Instruct`. 1.4 s, 324 tokens. Verdict `fail`, correct. Attestation fetched with a fresh nonce: model and gateway echoed it; Intel quote and NVIDIA payload present. Signature fetched: `provider_tee`, signed text contains the SHA-256 of the exact request and response bytes (both matched).

## 2. Easy jury: 8 cases, 3 models
Truth: 4 pass, 3 fail, 1 inconclusive.
| Juror | Correct |
|---|---|
| Qwen3-VL-30B | 8/8 |
| GLM-5.3-flash | 8/8 |
| Qwen3.8-27B | 5/8 (three answers cut off: it hit the 600-token cap, no wrong verdict) |
| Quorum (2 of 3) | 8/8 (covered for the silent model; no accuracy gain) |
24 of 24 receipts matched. Cost about $0.0055.

## 3. Hard jury: 13 cases, 3 models (max_tokens 1500)
Near-miss prices ($19.99 vs $19.00), annual billing, a cookie modal over the total, Spanish pages, contradictory banners, wrong booking time, wrong cart badge, validation message, half-loaded page. Truth: 5 pass, 6 fail, 2 inconclusive.
| Juror | Correct |
|---|---|
| Qwen3-VL-30B | 12/13 (said pass on the cookie-modal case; truth inconclusive) |
| Qwen3.8-27B | 13/13 |
| GLM-5.3-flash | 13/13 |
| Quorum (2 of 3) | 13/13, and the split was flagged on the one case where a juror was wrong |
39 of 39 receipts matched, all `provider_tee`. Cost about $0.0064.

## 4. Reading of 2 and 3
Vision judging on NEAR AI works, is cheap and quick, and every verdict can carry a signed receipt. The data does **not** show a jury beating one good model. The single catch is n=1, and on a later rerun of the same cookie-modal image all three jurors said inconclusive, so it did not reproduce (model output is not fully deterministic at temperature 0).

## 5. KaneJury end to end (built tool)
- Calibration live: all three jurors eligible.
- `judge` on the cookie-modal image: 3 of 3 inconclusive, receipt verified OK including request rebuilt from claim plus evidence and live attestation lookup (nonce echoed, Intel and NVIDIA evidence present, not cryptographically verified).
- `judge` on a clear mismatch: FAIL, exit code 1. On a clear match: PASS, exit code 0.
- Tamper tests, all rejected: flipping votes; altering the signed text; wrong evidence file.
- **Hole found and fixed:** the first receipt design accepted a forgery that flipped every vote and the result together, because the signed hash covers the full model response, not our parsed verdict field. Fix: embed each signed response in the receipt and re-derive each verdict from it. Re-tested with exactly that forgery: rejected.

## 6. Kane CLI
Installed in scratch. `whoami` says not logged in. Key login with dummy values was rejected by the server ("Credentials not valid"), proving the network path. No Kane run has happened.

## Cost so far
NEAR AI about $0.012 calculated from token counts and listed prices (not billed figures). Firecrawl search and scrape credits were used for research (cost not tallied here).

## Reproduce
The built tool reproduces the core of these tests: `node src/cli.js calibrate` and `node src/cli.js judge --claim "..." --image <png>` use the same prompt and the same models; `node src/cli.js verify examples/receipt-fail.json --image examples/evidence-fail.png` re-checks a shipped receipt with no key.
