# Receipts

A receipt is a JSON file that lets someone who was not there check how a verdict was reached.

## What is signed

Each juror runs inside a hardware-protected enclave on NEAR AI Cloud. For every call the enclave signs the text

```
<model>:<sha256 of the request bytes>:<sha256 of the response bytes>
```

with an Ethereum-style personal-sign (EIP-191) signature. The receipt stores the text, the signature, the signing address, the exact response, and the evidence hash.

## What `verify` checks

1. The evidence hash matches the image you supply.
2. The signed text names the model and contains both hashes.
3. The embedded response hashes to the signed response hash.
4. The signature recovers to the signing address.
5. The recorded verdict is what the signed response says.
6. The request rebuilt from the claim and the image hashes to the signed request hash.
7. Each juror's eligibility is proven, not stated: the receipt carries the juror's two signed calibration answers (a known-true and a known-false image), and each is checked like a vote, including its request rebuilt from the fixture images in `fixtures/`. A juror counts only if its signed answers are pass on the known-true image and fail on the known-false image. Editing an eligibility flag or a calibration answer fails verification, and a receipt without signed calibration answers is not trusted.
8. Every vote and calibration answer is a different signed response, so one real answer cannot be copied under several juror names.
9. The final result recomputes from the votes, using the eligibility re-derived in step 7, with the same aggregation rule.

The signed text holds the model and the two hashes but no time, so a receipt proves which answers each juror gave, not when the calibration ran.

`--online` also fetches a live attestation report and checks that the signing address appears in it with a fresh nonce.

The same code runs in the browser (`src/verify-core.js`, bundled to `docs/assets/verify.js` by `npm run build:site`). It needs no key and sends nothing.

## Where trust comes from

- The signature proves a specific enclave key signed that exact request and response.
- The attestation report ties that key to enclave hardware. KaneJury fetches the Intel TDX and NVIDIA quotes and stores them; checking the quotes themselves is done by NEAR AI's open verifier at https://cloud.near.ai/verify.
- Kane itself runs on TestMu AI servers, so a receipt covers the judging step.
