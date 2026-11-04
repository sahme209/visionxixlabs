# Installed Gateway adapter serialization — bounded local evidence

The reproducible `probe.mjs` imports the installed Gateway adapter and supplies a synthetic key and an injected fetch that captures the body then deliberately throws. It makes no network request, inference, real credential access or SDK retry. One adapter invocation passed: `maxOutputTokens=137` and exact synthetic `gateway.only/order` survive serialization; AbortSignal is excluded from the JSON body. This is the v3 Gateway protocol, not evidence that REST `max_tokens` is emitted.

Installed versions: ai6.0.291 and @ai-sdk/gateway3.0.201. Source hashes are recorded alongside this file. The probe exercises the adapter directly, NOT Axiom's complete provider/manager/quote path, generated response parsing, provider enforcement, output/reasoning billing, rate freshness or model eligibility. It deliberately returns no successful response. The existing production hold/cap refusal remains unchanged. Useful quote implementation still needs separate design authorization and complete qualification; no production release or full Governance completion is claimed.

Run from the repository root: `node docs/recovery/2026-11-04/coding-quote-installed-adapter/probe.mjs`.
