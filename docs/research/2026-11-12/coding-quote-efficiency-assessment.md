# Coding context efficiency and accounting boundaries — gap-time assessment

Local source inspection and one pure-function arithmetic measurement only. No new provider read, inference, model tokenizer, customer input, dependency, configuration, billing or production action. This supplements the prior retrieval baseline; it is not a repeated retrieval benchmark or implementation authority.

## Verified current facts

- `lib/ai/codingRequestQuote.ts` seals exact prompt/system/model/options and scope; changing compressed context changes the request digest. Existing one-use quotes cannot authorize a modified prompt. The prepared contract requires4096maximum output tokens, zero retries, Anthropic-only routing, disabled thinking and `cache:none`. Its available estimator/pricing evidence is explicitly synthetic; default real quote qualification remains unavailable.
- The existing quote kernel computes a conservative provider-cost bound, then applies two1.5reservation buffers with integer rounding. This hold is neither actual model usage nor the customer rate card. Do not describe reservation arithmetic as actual billing, a universal markup or model-token savings.
- `lib/axiom/agentRuntime/governedAiCall.ts` deliberately bypasses the900second UI model catalog cache on dispatch and checks the current allowed model. Caching a model list or decision to reduce reads must not preserve revoked model/policy authority.
- `lib/workforce/pipelines/codingRunReservation.ts` already provides atomic run/workspace reservation and unknown-cost preservation. New observability/compression libraries cannot replace these controls.

## Synthetic sensitivity observation

Executed the actual `parseSyntheticCodingPricing`/`calculateCodingQuote` functions at the source hashes in the JSON receipt. The invented rates3000input/15000output nano-dollars per token are test inputs, NOT verified model pricing. Fixed output bound4096. One local assertion passed; no provider/model was invoked.

| Hypothetical input tokens | Provider bound, cents | Reserved hold, cents |
|---:|---:|---:|
|256|7|17|
|512|7|17|
|1024|7|17|
|2048|7|17|
|4096|8|18|
|8192|9|21|

For these exact synthetic inputs, halving4096to2048reduces the hold18to17cents (about5.6%), not50%. Halving512to256does not change the rounded hold at all. The output allowance and rounding dominate this example. It says nothing about actual output consumption, invoice cost, task quality, production pricing or savings versus another product. An output limit cannot safely be reduced without representative completion/quality evidence and a reviewed contract change.

## Reuse/candidate decisions for owner review

|Area|Current overlap/boundary|Assessment outcome|
|---|---|---|
|Scoped code context|Existing exact request sealing and retained TypeScript AST tooling; prior support retrieval already limits passages|Reuse current selection facilities first. Investigate only a measured language/context gap; no default whole-repository packing.|
|Prompt compression|Would alter exact prompt bytes and invalidate original quote handles|An experiment needs a newly bound request/quote and safety/quality baseline. Never compress structured authority/approvals or reuse the old authorization. No adoption now.|
|Provider prompt caching|Current coding contract explicitly requires no cache; cache-write/read fees and retained-context access matter|A caching library alone cannot enable it. Separate verified provider fee/routing/currentness design and approval required; no assumed cache savings.|
|Tokenizer|Current estimator is synthetic; one model family's tokenizer is not a universal native-token source|A tokenizer estimate does not qualify production prices or actual billing. Establish supported-model input bounds before adoption.|
|AI telemetry|Existing run/workspace accounting and unknown holds|Measure existing safe usage dimensions first; adding prompt capture or external telemetry increases privacy/hosting burden and needs review.|

External candidate versions, licensing, native packaging, security and representative quality/cost remain unqualified; this assessment neither refreshes earlier public-source checks nor installs any candidate. No runtime/code or tariff change follows automatically.

Evidence: `coding-quote-efficiency-assessment.json` and `coding-quote-efficiency-procedure.txt`. Continue the primary Governance sequence when its pending protocol/qualification decisions are available. Full token-efficiency/master-plan acceptance remains open.
