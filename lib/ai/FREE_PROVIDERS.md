# AI execution and admission — current source guide

The filename is historical. The current `AIProviderManager` registers **only Vercel AI Gateway**. Missing configuration refuses; it does not silently select GitHub Models, a local model or Mock. Retained provider classes and model catalogs are not evidence of current service support, a free tier or an air-gapped deployment.

This is an internal source guide, not a live readiness test, customer price commitment or full Governance acceptance. The prior free-provider/Mock-fallback instructions are superseded; their original bytes remain in Git history. All broader security, integration and offline requirements remain in the master plan.

## Configuration is not permission or funding

Gateway configuration uses `AI_GATEWAY_MODEL` plus server-side `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`. Do not expose values to a browser or paste credentials into documentation. A concrete configured model and service credential do not establish workspace approval, actual availability, cost or an enforceable budget.

Workspace provider policy is opt-in. A missing or disabled policy does not authorize generation. A model in a compatibility catalog is not an approved model or qualified price. Direct-provider keys in old adapter code do not enable a supported BYOK offering through the current manager; provider-managed BYOK charges and customer consent require separate qualification.

## Existing admitted entry points

| Entry | Current source responsibilities | Important limits |
| --- | --- | --- |
| `POST /api/ai/generate` | Authenticated org/user, ready workspace policy, credit precheck, stable `Idempotency-Key`, reservation/dispatch claim, one-use capability and usage linkage | Generic fixed-hold scope/task binding is not a full exact-payload price quote. Real pricing, complete policy freshness and custody qualification are separate. |
| Agent decisions | Current conversation/session owner, per-extract policy checks, bounded admitted extraction/streaming and usage handling | Fixed holds and specialized small-model envelopes have different binding guarantees. A logged user or optional caller fence is not universal financial or policy coverage. |
| Coding proposals | Persisted run/stage actor and claim, per-phase policy/model checks, run/workspace reservation and accounted generation linkage | Machine labels do not silently charge an owner. Canonical qualified quote mode remains unavailable; local synthetic quotes are not production rate authority. |

Use the existing reviewed request/run composition. Calling ordinary `generateText`, `extractStructuredData`, an orchestrator or a legacy helper does **not** by itself supply financial admission. Credit-meter checks and post-call telemetry do not reserve concurrent capacity. Do not attach a guessed tenant, select a paid model or add an automatic retry to make an unavailable path appear successful.

## Generic route contract

The request body includes a nonempty bounded `prompt`, optional bounded `system`, `maxTokens`, `temperature`, and only approved model/provider selections. Tenant/user identity comes from authenticated server context, not body fields. A stable request key (16–200 allowed alphanumeric/underscore/hyphen characters) is required in `Idempotency-Key`; it is not an authorization token.

The admitted path claims before dispatch, uses one Gateway attempt, then links returned generation/token evidence before returning success. A missing key refuses before reservation; a reused reservation does not dispatch again. Missing usage, a provider timeout or usage-link failure leaves claimed capacity uncertain. Do not change the key to replay an unknown operation or infer that a disconnected request was free. Settlement is separate; `pending` or a null cost is not zero final cost.

See [joined generic-route evidence](../../docs/recovery/2026-11-04/generic-ai-installed-sdk-composition/README.md). The installed SDK test uses synthetic external authority/storage/transport, not a real financial transaction or model acceptance.

## Diagnostic and legacy paths

- `/api/ai/status` reports configured service/provider-policy metadata; it does not prove successful inference or accepted financial controls.
- `/api/ai/health` currently runs a model probe for an enabled workspace. It is **not** a free metadata read merely because its response says `audit_read_only`. The reproduced synthetic funding/attribution gap and [proposed non-billable replacement](../../docs/recovery/2026-11-04/health-inference-admission-diagnostic/local-diagnostics-proposal.md) remain separate; that design has not been approved or implemented.
- The settings generation tester's current source does not send the required request key. Do not treat it as an accepted billing demonstration or work around server admission; a reviewed client contract repair is still needed.
- The local legacy website assistant returns `ai.public_admission_unavailable` after its IP limit. The separately named public bot product has different owner/quota paths; it is not automatically funded by that containment.
- Administrator/cron access, product tiers, a linked connector or job status do not issue an AI spending allowance. Growth image generation uses an image-specific SDK path and needs separate pricing/usage qualification.
- One legacy remediation callback can plan with AI, but its real GitHub writer refuses missing `beforeWrite` authority before network. An `approvalRequired` field in model output does not create genuine approval or open that writer.

The [ownership audit](../../docs/recovery/2026-11-04/ai-admission-ownership-map/README.md) and [callback follow-up](../../docs/recovery/2026-11-04/ai-helper-reference-followup/README.md) retain current bounded source evidence. They are not a universal transport or financial audit.

## Retained adapters and future integrations

Direct OpenAI/Anthropic/Gemini SDK functions and other provider adapters remain in source. Source presence, re-exports, historical tests or environment-variable names do not prove reachable service wiring. They must not be advertised as configured/free fallbacks. Local/offline models and customer-controlled execution remain explicit unfinished requirements, not deleted scope.

Adding a provider requires a reviewed identity/tenant/data/consent contract, current routing and model policy, exact-purpose financial admission, retry/unknown handling, redaction, usage/settlement evidence and independent acceptance. Do not enable an adapter simply by registering it or setting a key. Evaluate dependency/license/network behavior before adoption; no new installation is authorized by this guide.

## Logging and evidence

Usage metadata, invocation logs, reservations and settlement have different roles. A process-local usage buffer or successful audit write is not a financial hold. Known-credential redaction is a pattern-based defense, not complete PII removal or proof against every secret format. Keep prompts, customer content and credentials out of diagnostic fixtures and externally shared evidence.

All claims here are source-scoped. Current source, local tests, compiled artifacts, production deployment and real provider acceptance must remain separately versioned. Full Governance/custody/coverage, real prices and the enterprise security program remain open.
