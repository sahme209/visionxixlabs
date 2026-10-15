# Legacy website deployment authority and provider boundaries

Reviewed 2026-10-15. This preserves existing website-builder functionality while correcting reachable authority and provider-selection errors. It does not authorize or perform a deployment.

## Corrected behavior

- `/api/leads/[id]/deploy-preview` and `/api/leads/[id]/publish` now call the existing `requireAdmin(req)` before accessing the lead or invoking a deployment. An unauthenticated caller receives 401, an authenticated nonadmin receives 403, and the existing configured admin retains access. Empty admin configuration remains fail-closed; this change does not grant or change admin identities.
- The admin UI already required an allowlisted admin, but page protection did not protect direct API requests. Preview previously checked only a supplied lead ID; publish previously accepted any session user despite its admin-only contract.
- Both `lib/deploy/provider.ts` entrypoints reject explicit AWS, Azure, GCP, or unknown provider values before generation or outbound requests, with `UnsupportedDeploymentProviderError` and stable code `deployment_provider_not_supported`. They no longer deploy to Vercel when another provider is requested.
- Both preview wrappers pass explicit provider choices through for validation. Omitting the wrapper's provider argument still defaults to Vercel. Existing repository callers use explicit/default Vercel and retain their provider selection.
- `/api/leads/trigger` and `/api/leads/[id]/preview/update` retain their signed lead-token flow. No admin session was added to these public customer capabilities. Tests exercise successful public access and rejected wrong-lead/expired/invalid token revisions.

## Validation and limits

Dedicated behavioral tests exercise real route handlers with the existing admin helper and simulated session/database/provider boundaries. Provider tests cover both low-level entrypoints and wrappers, verify zero generation/fetch for unsupported choices, and preserve Vercel request payload and omitted-provider defaults. No external provider call or production record was used. These are regression evidence, not actual customer or cloud acceptance.

This correction deliberately does not certify deployment readiness. Existing Vercel POST handling can still label an accepted request READY without verifying build completion. Admin preview/publish and revision handlers can persist ready/published for a missing-credential PENDING response. The next coordinated milestone must bind provider-reported readiness and asynchronous observation to persisted lead status, prevent premature ready emails/published timestamps, and preserve existing working previews on failed updates. Those semantics require tests across all callers rather than a library-only return-value change.

The legacy infrastructure selector stores a provider preference; it does not implement or run an AWS/Azure/GCP adapter. This website-builder path is separate from the tenant-owned GitHub/OIDC ECS workflow. Neither path's tests prove the other can deploy an approved immutable artifact.
