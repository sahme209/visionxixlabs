# Vercel AI Gateway rollout

## Runtime boundary

Customer-facing text inference, repository proposals, release-operation AI,
website assistants, admin AI health checks, and internal growth generation use
`AIProviderManager`. Its production chain contains only `vercel_gateway`.
Direct OpenAI, Anthropic, Gemini, local-model, and mock fallbacks are not
advertised or reachable through the runtime manager.

If Gateway authentication, the service model, workspace opt-in, an approved
model, credits, or policy storage is unavailable, the request fails closed.
No canned response is returned as if it came from a model.

## Outbound prompt redaction

The final Gateway provider call applies the existing canonical redactor to
both prompt and system text immediately before passing them to the SDK.
This happens after structured schema hints and classification labels are
composed, and also protects callers that invoke the provider directly.
Summary and stream paths share that boundary. Caller-owned options are not
mutated, and model selection, authentication and workspace attribution retain
their existing behavior.

Coverage is limited to the canonical known-pattern redactor; this does not
guarantee arbitrary sensitive data detection or sanitize historical content.
Mocked SDK regressions use synthetic tokens and make no paid requests.

## Configuration

- `AI_GATEWAY_MODEL` — required exact Gateway model ID for the service default.
- `AI_GATEWAY_API_KEY` — required outside Vercel when OIDC is unavailable.
- `VERCEL_OIDC_TOKEN` — supplied automatically in supported Vercel runtimes.
- `AI_GATEWAY_MODEL_ALLOWLIST` — optional comma-separated catalog restriction.
- `AI_GATEWAY_IMAGE_MODEL` — required only for image generation.

The desktop model picker reads the live Gateway model catalog and persists an
explicit workspace selection. Catalog failure is surfaced as unavailable; it
does not substitute a hard-coded list.

## Verification status

Unit tests mock the network boundary and verify exact model forwarding,
attribution, usage mapping, policy enforcement, and fail-closed behavior. No
live paid inference was performed during this change. A deployment owner must
configure Gateway credentials/models and run the admin health check before
production promotion.
