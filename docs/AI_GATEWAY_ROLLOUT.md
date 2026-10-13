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
