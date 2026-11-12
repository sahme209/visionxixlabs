# ADR: Governed AI with customer-hosted models in offline mode (A9.8 decision 10)

Status: **accepted for local v1 implementation** (owner decisions November 11, 2026). Original proposal November 9. No production enablement, provider access, model-server installation or spending is granted by acceptance. Parent: [A9 orchestrator and on-prem ADR](2026-11-09-a9-orchestrator-and-on-prem.md), row 10.

## Problem

`lib/axiom/agentRuntime/governedAiCall.ts` is the only place the Agent may call a model. Today it is deliberately bound to the reviewed Vercel AI Gateway:
- preferred models must be concrete gateway IDs;
- the output bound must be verified for the effective gateway model;
- customer cost is settled from gateway generation cost;
- credit admission fails closed.

An air-gapped deployment cannot reach the gateway, so offline mode has no governed AI at all. The existing Ollama/LM Studio providers are not on the governed path and must not become a silent bypass.

## Decision (accepted v1)

Add one new governed provider kind, `customer_hosted`. It is a second, separately reviewed branch of the governed call, not a fallback.

1. **Operator-configured endpoint only.** The base URL, model IDs and per-model output bounds come from server configuration set by the deployment operator (`AXIOM_LOCAL_MODEL_*`), never from a request, workspace setting or model output.
   - The URL must be HTTPS, or loopback HTTP for single-host installs.
   - Its host must exactly match the configured allowlist after DNS resolution.
   - Redirects are refused.
2. **Mutually exclusive modes.**
   - `AXIOM_OFFLINE_MODE=true` makes `customer_hosted` the only provider the policy can allow. The gateway branch refuses (`workspace_ai_provider_unavailable`), so an offline install can never leak a prompt to the internet.
   - In v1, online installs cannot select `customer_hosted`; there is no online opt-in exception.
3. **Same admission sequence.** The workspace keeps the same rules:
   - AI is opt-in, and a disabled policy refuses;
   - only allowed providers and models;
   - bounded structured input (`boundedStructuredAIInput`);
   - context redaction (`redactSecrets`, A7.16) on every prompt;
   - Governance enrolled-refusal rules for policy widening (M02).
4. **Output bound is configuration, then verified.** Each configured model declares a max output token count. A response that exceeds it, or reports no usage, is refused as `workspace_ai_output_bound_unverified`, like the gateway branch.
5. **Metering without a price source.** There is no gateway generation cost offline.
   - Usage events record tokens with `settlement: "customer_hosted_unpriced"`.
   - Credit admission is replaced by a per-workspace token budget the operator configures.
   - A missing or unreadable budget refuses. The system never runs unmetered.
6. **Audit.** Every call records provider kind, configured model ID, token counts and outcome in the audit log (sealed by the existing chain). It records no prompt content.
7. **No new I/O surface for agents.** Tool calling, browsing and code execution stay behind their existing governed executors; the local model gets the same tool contract as the gateway model.

## Explicitly out of scope

- Running or bundling a model server. The customer hosts it.
- Fine-tuning, embeddings or retrieval stores.
- Any change to the online gateway branch's behaviour or tests.

## Original owner questions — resolved below

1. Which model servers to support first: OpenAI-compatible APIs (vLLM, Ollama, LM Studio) only, or also native APIs.
2. Default per-workspace token budget offline, and who can change it (operator only, or workspace owner within an operator cap).
3. Whether online installs may ever enable `customer_hosted` alongside the gateway (proposed: no for v1).

## Acceptance before enabling

- Kernel tests for mode exclusivity:
  - offline refuses the gateway;
  - online refuses `customer_hosted` unconditionally in v1.
- Kernel tests for the endpoint allowlist: redirect and DNS-rebind refusal.
- Kernel tests for the output bound and budget fail-closed behaviour.
- Redaction applied on the new branch (shared test vectors).
- Independent review of the governed-call diff.
- A live run against a customer-hosted model in an isolated network (A9.7-style acceptance). Mocks prove only the schema.

## Owner decisions recorded — November 11, 2026

The owner accepted this ADR, then explicitly selected “Use these v1 settings”:

1. OpenAI-compatible APIs for vLLM, Ollama and LM Studio only. Native server-specific APIs are outside v1. This is compatibility scope, not permission to install or operate those servers.
2. No automatic token allowance. An operator must configure each workspace cap; only the operator may change it. Missing/unreadable caps refuse calls. Implementation must retain durable accounting and explicit budget-window semantics; no invented numeric default.
3. Customer-hosted models are disabled in online installations. Offline installations cannot use the Gateway. No fallback between them.

The “Owner decisions needed” section above is the preserved original question set, now resolved by these recorded choices. Local implementation/tests may proceed under the handoff sequence. Production settings/schema/enablement, real endpoints/inference, live acceptance and spending retain their separate approval gates.

Here “operator” means the deployment operator configuring the installation, not the workspace role named Operator. No new workspace role or UI permission is granted.
