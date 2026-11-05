# Bounded source/cost admission inventory

This covers the public website assistant lane and a canonical text-admission comparison, not the full mandatory AI/billing/BYOK/vendor economics audit. Observations are local source facts and synthetic tests. No current provider prices, balances, invoices, actual calls, payments or live configuration assertions are included.

| Lane | Source authority and pre-dispatch behavior | Accounting evidence and limits |
|---|---|---|
| Public website assistant /api/visionxix-ai-chat | IP rate limit and Gateway configuration check; truncates conversation and requests1536outputtokens; calls legacy orchestrateChat, not admitAIText. No tenant/user/idempotency/reservation is supplied. | Later invocation/usage telemetry is not pre-call budget admission. Source does not prove current production exposure or an actual charge. |
| Legacy orchestrator and manager normal generateText | Configured Gateway-only chain, redaction and output-model filter; normal provider call does not consume a one-use admitted request. | Fallback logger has optional workspace attribution. This does not classify every legacy caller. |
| Canonical /api/ai/generate | Current context/workspace, policy, idempotency and reservation through admitAIText, then generateTextWithAdmission. | One-use consumption and observed usage linkage exist on this separate lane; full billing/customer pricing qualification remains open. |
| Coding quote issuer | Canonical quoteCodingRequest refuses qualification; isolated synthetic protocol is test-only. | This does not disable other manager inference entry points. Real fees, estimation and billable qualification remain open. |
| Gateway SDK boundary | Validates output bounds/inputs and optional special dispatch envelopes, then calls SDK. | SDK/metering IDs and usage counters alone do not prove tenant approval/reservation. |

No price, markup, free inference pool, anonymous subsidy, prepaid credit product, BYOK budget promise, support-content customer approval or commercial rollout is authorized. The master monetization section remains research/design only. Preserve canonical admitted paths. Anonymous traffic must not be assigned a guessed owner's identity or tenant.
