# Installed Gateway adapter serialization — bounded local evidence

The reproducible `probe.mjs` imports the installed Gateway adapter and supplies a synthetic key and an injected fetch that captures the body then deliberately throws. It makes no network request, inference, real credential access or SDK retry. One adapter invocation passed: `maxOutputTokens=137` and exact synthetic `gateway.only/order` survive serialization; AbortSignal is excluded from the JSON body. This is the v3 Gateway protocol, not evidence that REST `max_tokens` is emitted.

Installed versions: ai6.0.291 and @ai-sdk/gateway3.0.201. Source hashes are recorded alongside this file. The probe exercises the adapter directly, NOT Axiom's complete provider/manager/quote path, generated response parsing, provider enforcement, output/reasoning billing, rate freshness or model eligibility. It deliberately returns no successful response. The existing production hold/cap refusal remains unchanged. Useful quote implementation still needs separate design authorization and complete qualification; no production release or full Governance completion is claimed.

Run from the repository root: `node docs/recovery/2026-11-04/coding-quote-installed-adapter/probe.mjs`.

## Full installed SDK transport increment

`sdk-probe.mjs` additionally exercises installed `ai.generateText` through the Gateway adapter with `maxRetries:0`, the same synthetic capture-and-throw transport and output/routing assertions. It passed with exactly one captured invocation and zero network calls. It does not call Axiom's manager/provider or establish successful response, provider-enforced cost limits or quote eligibility. ESM entry resolution was checked explicitly; the receipt now hashes both actually imported `index.mjs` entries as well as the previously inspected CJS source. Independent source review identified and corrected that prior ESM evidence-binding omission; the original serialization result remains valid.
