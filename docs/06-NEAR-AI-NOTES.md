# NEAR AI Cloud notes (verified 2026-11-24)

## What it is
Private AI inference you can verify. TEE-hosted open-weight models run in hardware-secured enclaves (Intel TDX plus NVIDIA GPU TEE) behind an **OpenAI-compatible API** at `https://cloud-api.near.ai`. Each response can carry a hardware-signed proof. Docs index: `https://docs.near.ai/llms.txt`. Browser Verification Center: `https://cloud.near.ai/verify`. Open-source verifiers: `https://github.com/nearai/nearai-cloud-verifier`, example `https://github.com/near-examples/nearai-cloud-verification-example`. Intel Trust Authority is integrated as an independent attestation verifier.

## Access in the cloud session
The session proxy injects the credential for `cloud-api.near.ai`, so no key is needed here. On an owner's machine set `NEAR_AI_API_KEY` (KaneJury sends it as a Bearer token and never writes it to receipts or logs). Pricing is per million tokens; the account balance has not been seen.

## Models (list fetched 2026-11-24, 65 entries)
Vision-capable models hosted by NEAR AI itself (owner `nearai`) used as jurors:
| Model | Input $/M | Output $/M | Notes |
|---|---|---|---|
| `Qwen/Qwen3-VL-30B-A3B-Instruct` | 0.15 | 0.55 | fp8, vision, fastest (1.4 s on one test) |
| `Qwen/Qwen3.8-27B` | 0.04 | 1.35 | fp8, vision, **reasoning model**: averaged about 217 completion tokens per call on the hard cases but exceeded 600 on some easy ones; use max_tokens 1500 or it can return no answer |
| `z-ai/glm-5.3-flash` | 0.08 | 0.5 | fp8, vision |
Listed as "attested third party" (untested): `moonshotai/kimi-k2.6` (vision, 0.81/3.85), `moonshotai/kimi-k3`, `z-ai/glm-5.3`. Also on the gateway: Anthropic, OpenAI, Google and xAI models. **I believe these are proxied and not hardware-attested, but have not confirmed.** Do not count them as attested jurors.

## Endpoints used
- `POST /v1/chat/completions` (OpenAI format; images as `image_url` data URIs).
- `GET /v1/attestation/report?model=<m>&signing_algo=ecdsa&nonce=<hex>` returns `gateway_attestation` and `model_attestations[]` with `signing_address`, `request_nonce`, `intel_quote`, `nvidia_payload`, `event_log`.
- `GET /v1/signature/{chatId}?model=<m>&signing_algo=ecdsa` returns `text`, `signature`, `signing_address`, `signing_algo`, `signature_kind` (seen: `provider_tee`). **Signatures expire**, and a model can sit behind several nodes, so retry on 404. KaneJury stores the signature in the receipt.

## What the signature covers
`text` is `<model>:<sha256 of exact request body bytes>:<sha256 of exact response body bytes>`. Verified: both hashes matched on all 64 signed calls checked in experiments 1 to 3.
**Signature math, verified:** the signature is an Ethereum personal_sign (EIP-191) signature. Recover the address with keccak256 of `"\x19Ethereum Signed Message:\n" + len + text`, recover the public key from the 65-byte signature, take the last 20 bytes of keccak256 of the key. It matched the attested signing address. Implemented in `src/receipt.js` with `@noble/curves` and `@noble/hashes` (pinned).

## Not verified
- The Intel TDX quote and NVIDIA GPU payload themselves. Use NEAR AI's verifier.
- That the vision input path is private end to end beyond NEAR AI's own claims.

## Node tips for the cloud container
Node 22 `fetch` ignores the proxy by default. Run with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` (and `NODE_NO_WARNINGS=1` to hide the experimental-proxy warning). `curl` works without extra flags.
