# Cloud-First Repositioning — Summary

## Files Modified

| File | Changes |
|------|---------|
| `lib/websiteBuildPricing.ts` | Starter $49, Professional $499, Enterprise (custom); `done_for_you` → `enterprise`; `resolveTier()` for backward compat |
| `app/request/page.tsx` | Messaging "AI + Enterprise Cloud Deployment Platform"; removed cloud provider, use-my-cloud, add-ons from form; tier options (starter/professional/enterprise) |
| `app/request/thank-you/page.tsx` | Cloud-first messaging; infrastructure selection after preview (Managed Cloud, AWS, Azure, GCP); Infrastructure Stack block with Provider, CDN, SSL, CI/CD, Security status |
| `app/api/leads/route.ts` | Simplified: tier only (no cloudProvider, useMyCloud, addOns, credentials); `resolveTier` |
| `app/api/leads/trigger/route.ts` | Managed cloud (vercel) for initial preview; tier logic (enterprise); cloud-first email messaging |
| `app/api/leads/status/route.ts` | `resolveTier`; tier mapping (enterprise); cloudProvider default "managed" |
| `app/api/leads/[id]/preview/update/route.ts` | `resolveTier` |
| `app/api/leads/[id]/upgrade-tier/route.ts` | `resolveTier` (accepts done_for_you → enterprise) |
| `app/admin/leads/page.tsx` | `resolveTier` for tier display (legacy done_for_you → enterprise) |
| `lib/infrastructureAddOns.ts` | `done_for_you` → `enterprise` |
| `lib/previewDeploy.ts` | Import path fix: `./deploy/provider` |

## Files Created

| File | Purpose |
|------|---------|
| `app/api/leads/[id]/infrastructure/route.ts` | POST saves infrastructure selection (managed/aws/azure/gcp) after preview ready |

## Updated Tier Logic Summary

| Tier | Price | Features | Server-Side Gating |
|------|-------|----------|--------------------|
| Starter | $49 | AI build, managed cloud preview, 3 revisions | Revision limit in preview/update |
| Professional | $499 | Production deployment, cloud provider selection, CDN, SSL, CI/CD enabled | cdnEnabled, cicdEnabled, sslEnabled |
| Enterprise | Custom | Multi-cloud, networking, security hardening, performance optimization | Same as Professional + securityLevel "hardened" |

- `resolveTier()` maps legacy `done_for_you` → `enterprise`.
- Tier gating enforced in: `preview/update` (revisions), `trigger` (infrastructure flags), `status` (returned values).

## Updated User Flow Summary

1. **Request form** (/request): Business details, tier (Starter / Professional / Enterprise). No cloud provider or credentials.
2. **Submit** → Lead saved → Redirect to thank-you with token.
3. **Thank-you** → Trigger AI generation + managed cloud deploy (Vercel).
4. **Poll status** → When deploy_ready: show preview link.
5. **Infrastructure selection** (after preview ready): User selects Managed Cloud (default), AWS, Azure, or GCP. Saved via POST /api/leads/[id]/infrastructure.
6. **Infrastructure Stack** block shows: Provider, CDN, SSL, CI/CD, Security status.
7. **Request changes** (revisions) for Starter: 3 max; Pro/Enterprise: unlimited.

## Assumptions

1. **Managed Cloud** = Vercel for initial preview. Infrastructure selection (AWS/Azure/GCP) is stored for production deployment; actual deploy to non-Vercel is not implemented.
2. **Legacy `done_for_you`** mapped to `enterprise` via `resolveTier()`; no schema change.
3. **Emails**: Trigger route sends confirmation; leadEmailService (multi-step form) unchanged.
4. **Archiver build error**: Pre-existing in lib/leads/scaffoldGenerator; not touched by this repositioning.
