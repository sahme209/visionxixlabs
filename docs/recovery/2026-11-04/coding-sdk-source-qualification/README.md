# Installed SDK source qualification — bounded result

Installed `ai`6.0.291 and `@ai-sdk/gateway`3.0.201 package metadata and ESM entry hashes match the earlier lower-level adapter receipt. The actual Axiom provider differs from that older receipt because approved coding support was subsequently added in0253588b. Current provider and the actual installed-SDK coding test both exactly match0253588b; no changes since that commit. Do not treat the old lower-level provider hash as current Axiom-call proof. The source-manifest records this distinction explicitly.

## Exact existing evidence reused

- `lib/ai/__tests__/codingDispatchInstalledSdk.test.ts:3–19` installs throwing fetch before real SDK/provider imports; only the canonical quote consumer is replaced with a test-isolated instance.
- Lines49–79 exercise actual `generateTextOnce`, capture exactly one local request, assert endpoint/model header, redacted exact prompt/system,4096output limit, temperature0.2, upstreamallowlist and disabledthinking. `tools`/`toolChoice` are absent; reusing consumed dispatch adds no second request. No successful response, real usage or billing receipt exists in this test.
- `node_modules/@ai-sdk/gateway/dist/index.mjs:906–942` removes abortSignal from body arguments, encodes file parts and POSTs those arguments through configuredfetch. Lines1037–1044 select language-model URL and model/specification/streaming headers. This inspected path does not inject an explicit cache-disable or fixed geographic region.
- `docs/recovery/2026-11-04/coding-request-quotes-local/installed-sdk.log` preserves the previous one-case pass. No test or transport was rerun for this assessment.
- `coding-quote-installed-adapter/receipt.json` is lower-level complementary evidence (including ESM hashes); it did not exercise the complete current Axiom coding provider and must not replace that actual-provider test.

## Decision

Local serialization is established only for these pinned installed versions and exact test/source scope. The SDK passes Axiom's constraints to a remote Gateway; this does not prove remote model translation, account/virtual-model behavior, search/cache/region applicability, complete upstream price dimensions or their finite counts. In particular a serialized maxOutputTokens4096 cannot alone establish the maximum real charge, thinking/wrapper billability or conservative input count.

The proposed fee contract therefore cannot yet be promoted to production eligibility. A subsequent reviewed contract must either substantiate exclusions using exact upstream/account semantics or conservatively cover every applicable finite fee dimension with authoritative units/count bounds. Existing synthetic cache/region labels cannot supply that missing authority. No change to canonical qualification, strict parser, defaults, routing/options, prices, balances or runtime was made.

This assessment closes the local installed-source reconciliation subtask, not A7 or Governance. Real price provenance/freshness, input estimator, total billable output, customer/native and operational acceptance remain open. No external read, AI request, DB action or deployment occurred.
