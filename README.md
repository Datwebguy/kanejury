# KaneJury

**An independent jury for Kane CLI verdicts.** KaneJury reads the evidence a Kane run left behind and asks three privately hosted models whether the claim held. It returns **pass**, **fail** or **inconclusive**, shows who disagreed, and writes a **signed receipt** anyone can check.

Independent project built for the Kane CLI Online Hackathon. Not affiliated with TestMu AI.

> **Status: early, with a first real measurement.** We ran 25 real Kane CLI runs on public test sites and compared Kane alone with KaneJury ([bench/README.md](bench/README.md)). The honest result: the vision jury did **not** beat Kane (21 of 24 correct against Kane's 23 of 24). What did hold up on real runs: a plain-code check that tells an infrastructure failure from a real one (it caught the one browser crash in 25 runs with no false alarms), and signed receipts. See [docs/STATUS.md](docs/STATUS.md) for every feature and its state.

## Why

Teams that gate coding agents or CI on browser verdicts hit two failures: a **false green** lets broken work ship, and a **phantom failure** sends the agent chasing a bug that is not there. The usual fix is to re-run the browser several times, which costs credits and minutes. KaneJury judges the stored evidence instead, which costs a fraction of a cent per juror. Whether that is better than re-running is **not yet measured**.

## How it works

1. **Calibrate.** Each juror must answer a known-true and a known-false fixture correctly. A juror that fails is excluded from the vote. Fixtures are labelled test images, not Kane output ([fixtures/README.md](fixtures/README.md)).
2. **Judge.** Three vision models hosted by NEAR AI Cloud in hardware-secured enclaves read the evidence image and the claim.
3. **Decide.** Policy `cautious` (default): a majority decides, but a pass is downgraded to inconclusive if any calibrated juror says fail. Policy `majority`: plain majority. Too few calibrated jurors gives `no_quorum`.
4. **Receipt.** The receipt stores each juror's signed response, the signature, the evidence hash and the calibration.

## Use

```bash
npm install
export NEAR_AI_API_KEY=...              # your NEAR AI Cloud key
node src/cli.js calibrate               # check the jurors
node src/cli.js judge --claim "Price shown at checkout matches the advertised Pro price." --image examples/evidence-fail.png
node src/cli.js verify examples/receipt-fail.json --image examples/evidence-fail.png
node src/cli.js judge-pack <run.evidence> --claim "..."   # judge a real Kane evidence pack (last step screenshot)
```

`judge-pack` first checks, with plain code, whether Kane's failure was really infrastructure (a browser crash, exhausted credits). If so it calls no model and exits 4, so a gate does not send the agent after a bug that is not there.

Exit codes: `0` pass, `1` fail, `4` inconclusive or no quorum, `2` could not run.

`verify` needs no key. It checks that:
- the signed text names the model and contains the request and response hashes;
- the signature recovers to the juror's signing address;
- every recorded verdict is what the signed response actually says;
- the final result recomputes from the votes;
- with `--image`, the request rebuilt from the claim and your evidence file matches the signed request hash;
- with `--online`, the signing address appears in a live attestation report that echoes a fresh nonce.

## Limits

- Jurors see only the image they are given. They cannot see what Kane did not capture.
- Kane itself runs on TestMu AI servers, so a receipt covers the judging step only.
- The Intel TDX and NVIDIA quotes are fetched but **not verified** by this tool. Use NEAR AI's open verifier for that.
- Calibration results are recorded in the receipt but not individually signed.
- On our labelled test screenshots a single model was already 12 or 13 of 13 correct. A false green seen once did not reproduce on a second run. The benefit over Kane alone is unknown.

## Test

```bash
npm test      # unit tests of the decision logic, the evidence reader, and the failure classifier; no network
```

MIT licensed.
