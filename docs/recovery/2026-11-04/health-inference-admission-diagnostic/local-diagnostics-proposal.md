# Local non-billable AI diagnostics proposal — approval required

## Problem and selected behavior

The existing health route treats provider approval as enough to run inference and then loses the metering identifier. Keep useful configuration diagnostics, but separate **configured** from **tested**. Replace this route's inference dispatch with the already-available manager configuration status filtered by the authenticated workspace's ready, enabled provider policy. Return truthful configuration state and explicitly mark live inference health **not tested**. No model call, quote, charge, usage row or successful provider-health claim is made. Preserve authentication, tenant-scoped policy reads, unavailable-policy refusal and disabled/missing-opt-in behavior. GET and POST remain equivalent non-billable diagnostics.

Use a versioned response shape that distinguishes configuration readiness from verified provider health. Inspect and update the real dashboard consumer and validation-matrix/source documentation in the same reviewed local batch so no stale `ok` or `live` label implies accepted inference. Keep unavailable/disabled and last-observed states explicit; do not reuse old green health status as current proof. Preserve existing admitted app inference and every other endpoint. The exact contract and changed source files must be pinned before implementation.

## Why this boundary

Simply attaching organizationId restores a tag, not a reservation or billing authority. Inventing a platform-funded allowance would create an unauthorized subsidy. Reusing a coding quote for an unrelated probe misbinds purpose/payload. A generic always-unavailable guard would remove useful configuration checks. The selected metadata-only diagnostics are useful without granting new financial authority. A later optional real probe requires a separately reviewed exact funding owner, model/payload quote, durable reservation, one-attempt dispatch and usage/unknown settlement, and must not run on GET or page load.

## Verification and scope

Local source/tests only after explicit validation-first approval. Add real-chain no-SDK/no-write cases for GET/POST and enabled/disabled/unconfigured/provider-policy failure/authentication. Test the dashboard's not-tested/readiness labels and old-shape handling; verify admitted generation lanes remain unchanged. Review exact source before types/build. No production deployment, grants, provider read, credential, schema, pricing, real inference or spending. Do not replay the diagnostic as a live probe. Original RED evidence remains historical; corrected expectations must reject future inference dispatch rather than preserve the two historical200 SDK cases.

This is not complete financial admission or Governance. Full health/administrative/business/image lanes and complete transport coverage remain on the caller-review queue. Approval changes only this local diagnostics availability/meaning boundary; subsequent production activation remains separately gated.

## Proposed exact local contract

`data = { version: 2, kind: "configuration", policyEnabled: boolean, inferenceHealth: "not_tested", rows: [{ provider: AIProviderName, configured: boolean, defaultModel: string }], generatedAt: ISODate }`. Rows include only service status entries allowed by the ready, enabled workspace policy; missing/disabled policy returns an empty list. Do not expose credentials or provider responses. Successful metadata reads use the existing API success envelope and `audit_read_only`, with `sourceMode: "preview"` for enabled policy and `"disabled"` otherwise; never `"live"` to imply tested provider health. Preserve existing auth/storage error envelopes. No legacy per-row `ok`, `latencyMs` or inference `reason` fields are synthesized.

The dashboard must validate version/kind/row fields before display, clear stale results when a refresh begins or fails, handle rejected fetches, label the section “Provider configuration,” the action “Refresh configuration,” and show “Inference health not tested. No AI request was sent.” Old or malformed responses are unavailable, not healthy. The separate explicitly initiated generation tester remains unchanged and is not auto-run as a fallback. This field contract is a proposed local design, not current endpoint behavior.

Pin implementation to `app/api/ai/health/route.ts`, `app/dashboard/ai-settings/page.tsx`, the corresponding entry in `lib/validation/platformValidationMatrix.ts`, `lib/ai/FREE_PROVIDERS.md`, and focused tests. Do not rewrite the provider manager's shared health method or other callers under this approval. The source manifest binds the inspected handler/consumer; additional files need an updated exact local scope before edits.
