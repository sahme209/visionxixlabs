# Four approved official documentation reads

Scope completed: official documentation search and four requested page reads, resolving to three distinct pages because the version6 alias redirected. No pricing/model API fetch, inference, customer data, code execution, installation, credentials or spending. No new quote or fallback was enabled. This report paraphrases selected facts; it does not redistribute page bodies or rates.

## What the sources establish

- The REST reference distinguishes catalog input/output price keys from endpoint prompt/completion keys. It describes per-token rates, context-sensitive tiers, endpoint context/completion limits and supported parameters. The examples do not establish complete fee coverage, an authoritative input-token/serialization bound or a quote-validity guarantee. [Official REST reference](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api).
- Gateway documentation describes an upstream-provider allowlist and separates it from preference ordering and model fallback configuration. Its examples expose per-token prices. These descriptions support binding routing options; they do not qualify Axiom’s unexecuted payload or a smaller hold. [Official Gateway provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway).
- The generic text-generation reference describes an output-token setting, configurable retries and usage details separating text/reasoning. A generic option description is insufficient evidence of a particular adapter’s complete billable-output bound. The requested v6 URL redirected to the current v7 reference; it did not provide version-specific v6 proof. [Text-generation reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) / [requested v6 alias](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/generate-text).

## Current-source comparison and next prerequisite

The exact local lock records ai6.0.291, @ai-sdk/gateway3.0.201 and @ai-sdk/provider3.0.17 (lock hash in receipt). Current latest v7 documentation must not be treated as the pinned implementation. Existing source already has separate structured-extraction protocols; none transfers its model, byte/token assumptions or pricing authority to arbitrary coding.

The earlier quote design remains design-only. Pricing-key and upstream-routing terminology are clarified; live metadata freshness/completeness, eligible current model, exact pinned-SDK serialization, input-wrapper/token estimate and complete output/reasoning/billable-option coverage remain unqualified. Documentation examples and unknown metadata are not authoritative zero fees or current rates. No hardcoded rates, default hold reduction, model switch, paid probe, silent fixed-hold fallback or automatic retry is warranted.

Next local work, if specifically approved: qualify the exact pinned transport and conservative estimator/metadata contract with isolated fixtures; authorize any later narrowly bounded metadata read separately. Implementation and activation still require the validation-first review. The existing default1000-cent hold versus500-cent cap continues to refuse safely. This research is not useful-quote implementation, provider-cost savings evidence or full A7 completion.
