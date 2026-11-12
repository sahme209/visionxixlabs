# Offline dispatch inventory — source work in progress

No complete egress qualification, feature readiness or live acceptance is claimed. This is a source review map, not runtime attestation. Every closure below still needs the complete branch suite/review.

| Surface | Source boundary | Current local state |
|---|---|---|
| Legacy buffered OpenAI-compatible adapters, including old Ollama/LMStudio | `lib/ai/aiFetch.ts` | online-only gate before fetch; legacy local adapters cannot bypass token admission offline |
| Gateway ordinary/admitted buffered + streaming | `lib/ai/AIProviderManager.ts`, `providers/VercelGatewayProvider.ts` | chain/final-provider online gates; no customer-hosted fallback |
| Direct OpenAI/xAI streaming | `providers/directChatStream.ts` | online gate before fixed-origin fetch |
| Exact admitted Sonnet55 native Messages | `providers/sonnet55Messages.ts` | online gate before dispatch consumption/key use |
| Old direct OpenAI/Anthropic/Gemini SDK adapters | `providers/{openai,anthropic,gemini}.ts` | online gates before key/SDK initialization and after dynamic imports, immediately before SDK call |
| Brand image generation | `lib/growth/imageGenerator.ts` | online gate before configuration and image SDK call |
| Gateway model catalog | `lib/ai/gatewayModelCatalog.ts` | online gate before metadata fetch |
| Sonnet model endpoint metadata | `lib/billing/{smallSonnetRequest,smallSonnet55Request}.ts` | **still needs offline metadata refusal review/tests**; not a prompt send, but offline should not depend on network metadata |
| Gateway pending-cost reconciliation | `lib/billing/reconcileGatewayUsage.ts` | **still needs offline metadata/refusal handling**; preserve pending liabilities |
| Public support and coding execution composition | callers in `app/api` and workforce | underlying reviewed provider gates added; **actual route/SDK/held-reservation tests and any independent bypass inventory remain required** |
| Agent resolver | `lib/axiom/agentRuntime/governedAiCall.ts` | **offline branch before Gateway credit/catalog/manager and default durable accounting remain unmounted** |
| New customer-hosted transport | `lib/ai/customerHostedTransport.ts` | no online fallback; **must additionally require installation-mode/actual token+policy+qualification composition before use** |

Only the exact mode absence/`false` allows old online dispatch. Explicit `true`, malformed values and an empty value refuse. This is local code, not production settings/flag authority. Existing isolated-application guards are retained. No source hash or historical packet qualification was renewed.
