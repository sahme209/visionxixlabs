# Changelog

## [Unreleased] - P0 Production-Readiness Fixes

### Summary

Production-readiness and no-fake-features audit (P0) implementation. No new features; truthful UI and API behavior, entitlements unblocked, credential safety, and admin protection.

### Modified Files

| File | Change |
|------|--------|
| `lib/featureFlags.ts` | **New.** Feature flags: `ENABLE_CLOUD_CONNECTORS_AWS/AZURE/GCP`, `ENABLE_PLACEHOLDER_PLUGINS` (default false). |
| `lib/connectors/types.ts` | Added status values `unavailable`, `beta`. |
| `lib/connectors/aws.ts` | Returns `valid: false` when `ENABLE_CLOUD_CONNECTORS_AWS` is false. |
| `lib/connectors/azure.ts` | Returns `valid: false` when `ENABLE_CLOUD_CONNECTORS_AZURE` is false. |
| `lib/connectors/gcp.ts` | Returns `valid: false` when `ENABLE_CLOUD_CONNECTORS_GCP` is false. |
| `app/api/connectors/link/route.ts` | Rejects AWS/Azure/GCP link when feature flag off (503). |
| `app/api/connectors/status/route.ts` | Shows `unavailable` for stub cloud connectors when flag off. |
| `app/request/thank-you/page.tsx` | Removed AWS/Azure/GCP from infrastructure selection; Vercel only. |
| `lib/deploy/provider.ts` | Routes AWS/Azure/GCP deploy requests to Vercel (no fake contact URLs). |
| `lib/plugins/registry.ts` | Filters placeholder plugins unless `ENABLE_PLACEHOLDER_PLUGINS=true`. |
| `lib/plugins/executionRegistry.ts` | Filters placeholder execution plugins (IAM scan, cost explorer) unless flag on. |
| `lib/plugins/credentials.ts` | **Reworked.** Removed env fallback; lookups use `lead.fullPayload.connectors.aws.encryptedCredRef` via `credentialsKey` (leadId). |
| `lib/plugins/aws/iam-readonly-scan.ts` | Returns error when creds missing (no mock success). |
| `lib/plugins/aws/cost-explorer-summary.ts` | Returns error when creds missing (no mock success). |
| `app/api/execution/run/route.ts` | Passes `credentialsKey: leadId` for credential lookup. |
| `lib/axiom/pluginExecution.ts` | Passes `credentialsKey: leadId` in context. |
| `lib/admin/auth.ts` | Added `isAdminEmail()` for layout check. |
| `app/admin/layout.tsx` | Requires admin (redirect non-admins to `/dashboard`). |
| `app/api/leads/list/route.ts` | Uses `requireAdmin` instead of session-only. |

### Behavior Changes

- **Connectors:** AWS/Azure/GCP show as unavailable unless env flags are set. Link fails with 503. Status API reflects reality.
- **Deploy:** Only Vercel deploy option in UI. AWS/Azure/GCP requests route to Vercel.
- **Plugins:** Placeholder plugins (analytics, domain-dns, deployment, aws, azure, gcp, iam-readonly-scan, cost-explorer-summary) hidden unless `ENABLE_PLACEHOLDER_PLUGINS=true`.
- **Credentials:** No env fallback; per-lead lookup only. Missing creds return error, not mock.
- **Admin:** `/admin/*` and `/api/leads/list` require `ADMIN_EMAILS` allowlist.
