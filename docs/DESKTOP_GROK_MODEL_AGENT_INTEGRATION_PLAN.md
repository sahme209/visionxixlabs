# Desktop Grok, model selection and governed specialist agents

Status: scheduled within the existing desktop AI/model integration phase, after
current authentication and website priorities. This is an implementation and
acceptance plan, not a claim that Grok or multi-agent customer workflows work.
Source audit: `35d1592b2c8c54b200f9a1ce3009314c74ee9e1a`, October 20, 2026.
No runtime, model request, credential configuration or production change is
included in this planning checkpoint.

## Existing implementation and gaps

| Area | Evidence | Assessment / next action |
| --- | --- | --- |
| xAI adapter | `lib/ai/providers/XAIProvider.ts`, `AIModelRegistry.ts` | Partially implemented: fixed official endpoint and server-side key interface; dormant in production. The static Grok entry is not authenticated discovery or live acceptance. |
| Inference routing | `lib/ai/AIProviderManager.ts`, `providers/VercelGatewayProvider.ts` | Production deliberately uses Gateway only. Extend that path first; do not turn on direct adapters or bypass settlement. |
| Discovery | `lib/ai/gatewayModelCatalog.ts`, `app/api/desktop/ai-providers/route.ts`, `app/api/control/ai-governance/route.ts` | Existing live catalog, service allowlist and admin controls are reusable. Add verified capabilities and distinguish catalog presence from authenticated inference availability. |
| Selection | `desktop/src/views/AgentChatView.tsx`, `desktop/src/lib/aiProviderStatus.ts`, `lib/ai/workspaceProviderPolicy.ts` | Chat selects a provider and its one workspace-approved model. Multiple selectable models within Gateway require a policy/API extension; existing customers retain their current selection. |
| Streaming | `VercelGatewayProvider.streamText` | Currently awaits complete generation, then yields text. Real incremental transport, cancellation and partial-usage settlement are unfinished. |
| Editor integration | `desktop/src/views/RepositoryWorkspaceView.tsx` | Repository context exists. Shared model selection and verified editor-to-Agent context handoff need implementation and actual acceptance. |
| Agent governance | `lib/axiom/agentRuntime/{decisionLoop,agentIdentityPolicy,governedAiCall,skillCatalog,toolExecution}.ts` | Existing workspace identity, skills, current permission checks and proposal execution are the foundation. Skills are not evidence of independent specialist agents or safe concurrent orchestration. |
| Costs | `lib/billing/recordAIUsageEvent.ts`, `lib/billing/checkWorkspaceAICredits.ts` | Reuse existing reservation, settlement and credit controls. Real provider and installed-app acceptance remains unverified. |

## Verified external API boundary

Official sources reviewed October 20:

- [xAI authentication and Responses endpoint](https://docs.x.ai/developers/quickstart): server-held API key; consumer subscriptions are not API authorization.
- [Model discovery](https://docs.x.ai/developers/rest-api-reference/inference/models): authenticated model listings and language-model metadata.
- [Streaming](https://docs.x.ai/developers/model-capabilities/text/streaming): text SSE is documented.
- [Function calling](https://docs.x.ai/developers/tools/function-calling): application executes custom calls; model output is never execution authority.
- [Gateway REST API](https://vercel.com/docs/ai-gateway/openai-compat/rest-api): model discovery and compatible inference are documented. Verify each selected model's actual endpoint/capabilities before enabling it.
- [xAI multi-agent guide](https://docs.x.ai/developers/model-capabilities/text/multi-agent): beta research feature using Responses, not Chat Completions. It excludes custom function tools; only leader output is visible by default. Internal state is opaque/encrypted. `max_tokens` is unsupported, and internal tokens/tools are billable. The model summary's generic function-calling badge does not override these explicit limitations. Keep this variant outside engineering execution pending compatibility, privacy and enforceable-cost review.

This research does not prove our account has access, the gateway supports every
xAI feature, or any consumer Grok UI can be embedded. No paid probe was made.

## Implementation sequence within the established phase

1. Extend the existing catalog and policy boundary. Represent a service routing
   provider separately from model vendor; allow multiple admin-approved model
   IDs per workspace. Retain the current default/legacy policy semantics.
   Reject unknown, retired, unapproved or incompatible models server-side.
   A failed catalog or policy read disables new inference honestly.
2. Use the existing Gateway path for Grok, OpenAI, Anthropic and other verified
   available models. Service-managed authentication keeps setup simple for
   members. Never ship keys to the renderer, localStorage, prompts or logs.
   A separately enabled direct xAI path would require secure server credential
   ownership, revocation, endpoint pinning and equivalent metering first;
   no automatic direct fallback or production secret change is authorized.
3. Add true incremental model output with bounded parsing/backpressure,
   cancellation, reconnect/error states and a documented terminal receipt.
   Preserve gateway generation identity; reconcile partial and canceled calls
   exactly once. No fabricated tokens, fake typing, midstream replay or silent
   unapproved provider switching. Use version-matched installed SDK contracts.
4. Reuse one searchable accessible selector in chat and editor: group by model
   vendor, show verified capabilities/availability, remember an allowed choice
   per workspace, and explain admin restrictions. Selection is a user
   preference intersected with server policy, not permission to expand it.
   Keyboard navigation, loading, offline and revocation states are required.
5. Add Axiom-managed coding, debugging, code-review, Terraform and cloud-release
   profiles over the existing runtime and skills. Each has an explicit ID,
   purpose, model compatibility, context scope and tool allowlist. Show which
   specialist is active, its evidence and permission boundaries. Code review is
   read-only by default; coding edits are reviewable proposals; Terraform apply,
   cloud execution and rollback retain existing environment-specific approvals.
6. Add bounded orchestration: parallel read-only work first, shared run budget,
   per-agent usage, cancellation, depth/concurrency/time limits, durable run
   correlation and isolated context. Delegation can only narrow authority.
   Serialize overlapping edits and consequential actions. Child output cannot
   approve itself, mint credentials, alter policy or trigger provider writes.
   Recheck current actor/workspace/resource authority at dispatch and resume.
7. Enterprise admins control available models, agents, tools, limits, permitted
   destinations/data handling and enablement. Audit policy changes, selection,
   delegation, decisions and execution outcomes without secrets or raw hidden
   reasoning. Policy outage or revocation fails closed. Server-hosted search,
   execution and MCP tools remain disabled unless separately reviewed: they
   could otherwise act outside Axiom's local approval boundary.

Any necessary schema changes get a reviewed compatibility/migration proposal;
no production migration is authorized. Preserve the existing 1.5x settlement
policy and approved test-catalog semantics, including purchased-credit balances.
Aggregate agent reservations must prevent concurrent overspend; reconcile
reasoning, cache and provider-tool charges where the provider reports them.
Unresolvable cost remains held for reconciliation rather than silently free.

## Acceptance required before advertising availability

- Isolated authenticated discovery and inference for each enabled vendor/model,
  including invalid/revoked auth, unsupported tools, 401/403/429 and timeouts.
- Actual chunks arrive before completion in desktop chat and editor; cancel,
  disconnect and restart do not leak credentials, replay writes or lose charges.
- Real sandbox repository: select Grok, propose a bounded code fix, review/apply
  only under current authority, inspect diff and run the relevant checks. Repeat
  selection with OpenAI/Anthropic when credentials and access are available.
- Coding/debugging/review/Terraform/cloud specialists demonstrate distinct
  bounded behavior; parallel agents cannot cross tenants, exceed a shared
  budget or bypass an approval, revocation or immutable artifact requirement.
- Actual sandbox Terraform and cloud journeys retain existing plan, approval,
  execution, validation, rollback and audit evidence. No production testing.
- Test-mode credits reconcile successful, failed, partial, canceled and retried
  calls without duplicate charging; exhausted credits block new work.
- Native vault, installed-app interaction and real provider receipts are separate
  acceptance gates. Mocks/unit tests never substitute for those outcomes.

Service credentials, authorized paid inference budget, sandbox permissions and
native acceptance are later dependencies. No credentials are requested in chat
and no owner decision is needed for this scheduling/audit checkpoint.

## Priority continuity

Production Google login has owner-confirmed success from the approved hotfix;
password/GitHub/native pairing and database recovery remain separate open gates.
PR #182 website source validation and its local-browser lifecycle/navigation
blocker retain their current priority. Existing Agent/ECS/cloud/Terraform/
Airflow/billing/security work is preserved. The ONE FINAL website deployment,
database recovery, live billing and installer approval gates are unchanged.

## Read-before-write Gateway policy compatibility checkpoint

October 20 source-only implementation: the existing policy JSON slot can be read
as either its unchanged legacy model string or a strict stored Gateway v1 value
`{ version: 1, defaultModelId, approvedModelIds }`. Existing consumers still receive
`modelSelections.vercel_gateway` as the default string; validated, frozen metadata
is carried separately as optional `gatewaySelection`. The v1 shape permits 1–32
unique concrete Gateway model IDs, each at most 200 characters, using the existing
`isGatewayModelId` syntax. Dynamic `service-default` and virtual `vmc/` routes remain
valid only under existing legacy semantics, outside this concrete v1 selection.
Unknown versions/fields, getters, sparse/extended arrays, duplicate IDs or an
unapproved default fail closed without invoking stored accessors.

Only the stored-row loader uses the new reader. The existing public normalizer
and admin write boundary still reject object-valued selections; no new API/UI
write capability, catalog, credentials or model request is enabled. Saving a
validated loaded policy preserves the v1 JSON value rather than flattening it.
Service-provider intersection or workspace disable drops revoked Gateway metadata;
invalid normalized metadata fails closed without inventing a direct fallback.
Legacy provider strings, service defaults and explicitly configured direct-provider
semantics remain intact. Mocked repository tests cover compatibility, strict
validation, save preservation and revocation; these are not live Grok, catalog,
model-selection UI, inference, billing or installed-desktop acceptance. Remaining
writer/API/catalog/cost-reservation phases and production gates above still apply.
Legacy null/primitive/non-array provider and fallback values retain the original
normalizer's empty-list behavior; actual arrays are descriptor-checked before
iteration. Regression cases compare stored/public legacy normalization directly.

Root validation: 48 targeted tests across stored/legacy policy, control governance
and desktop provider routes pass; scoped lint and independent source review pass.
These checks establish storage compatibility only, not hosted inference acceptance.
