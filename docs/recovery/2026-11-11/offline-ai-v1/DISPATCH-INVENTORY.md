# Offline dispatch inventory — locally validated source

This is a source review map, not runtime attestation or an air-gap guarantee. The full local suite and production build pass; live isolated-network/model acceptance and default protected-file/OS qualification remain unperformed.

| Surface | Source boundary | Current local state |
|---|---|---|
| Legacy buffered OpenAI-compatible adapters, including old Ollama/LMStudio | `lib/ai/aiFetch.ts` | online-only gate before fetch; legacy local adapters cannot bypass token admission offline |
| Gateway ordinary/admitted buffered + streaming | `lib/ai/AIProviderManager.ts`, `providers/VercelGatewayProvider.ts` | chain/final-provider online gates; no customer-hosted fallback |
| Direct OpenAI/xAI streaming | `providers/directChatStream.ts` | online gate before fixed-origin fetch |
| Exact admitted Sonnet55 native Messages | `providers/sonnet55Messages.ts` | online gate before dispatch consumption/key use |
| Old direct OpenAI/Anthropic/Gemini SDK adapters | `providers/{openai,anthropic,gemini}.ts` | online gates before key/SDK initialization and after dynamic imports, immediately before SDK call |
| Brand image generation | `lib/growth/imageGenerator.ts` | online gate before configuration and image SDK call |
| Gateway model catalog | `lib/ai/gatewayModelCatalog.ts` | online gate before metadata fetch |
| Sonnet model endpoint metadata | `lib/billing/{smallSonnetRequest,smallSonnet55Request}.ts` | online-only gates before preparation and final metadata fetch; two offline entrypoint tests and existing online tests pass |
| Gateway pending-cost reconciliation | `lib/billing/reconcileGatewayUsage.ts` | online-only gates before pending read and before lookup after awaited read; tests preserve pending liabilities when mode changes |
| Public support and coding execution composition | callers in `app/api` and workforce | underlying shared provider gates refuse offline; full existing route/SDK/reservation suite passes. These operations are not customer-hosted v1 operations; no live route/network acceptance claimed |
| Agent resolver | `lib/axiom/agentRuntime/governedAiCall.ts` | mounted offline branch before Gateway credit/catalog/manager; actual default Agent/decisionLoop and real ledger/membership SQL pass with simulated model/evidence/audit I/O |
| New customer-hosted transport | `lib/ai/customerHostedTransport.ts` | offline and isolated-lane checks, final one-use token claim and current policy/accepted-limit composition mounted; cancellation/early-response negatives pass with simulated DNS/socket |

Only the exact mode absence/`false` allows old online dispatch. Explicit `true`, malformed values and an empty value refuse. This is local code, not production settings/flag authority. Existing isolated-application guards are retained. No source hash or historical packet qualification was renewed.
