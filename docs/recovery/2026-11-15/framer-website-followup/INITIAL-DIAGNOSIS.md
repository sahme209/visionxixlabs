# Website follow-up — observed source and public endpoints

Owner identifies **Google** as the provider producing Access Denied. No OAuth account, callback, cookie, secret setting, private log or database access was attempted here.

Unauthenticated public HTTPS GETs observed:

- `/api/auth/providers`: HTTP200,781bytes, credentials/Google/GitHub/Cognito registered; GitLab absent. Google is configured, which does not prove its callback/identity-store succeeds. Third provider is Cognito, not an observed Okta registration.
- `/api/desktop/download?platform=mac-arm&format=json`: HTTP503,323bytes, status temporarily_unavailable. This reproduces the paused-download condition without downloading/installing anything.
- `/api/status`: HTTP200 with overall unknown; autonomy_loop/outbound_channel/billing_plane unknown, cron_self_heal/agi_spine/ai_provider operational. Initial parser incorrectly used name/status instead of id/verdict and printed nulls; corrected parser after inspecting actual source obtains the observations above. Those nulls were a diagnostic parser mistake, not a service result. The web reader's initial internal retrieval failures were likewise NOT HTTP/server evidence; direct unauthenticated HTTPS reads succeeded.

Source: `lib/auth.ts` registers configured Google/GitHub/Cognito. Its Google callback denies absent email or failed canonical identity upsert; workspace bootstrap is best-effort and is not a denial gate. A successful provider registration response does not establish which path the real Google callback took. `lib/desktop/desktopRuntimeReadiness.ts` fails closed if any of five required storage reads throws; download route returns503 before asset handoff when that readiness is false. Public status's three unknown components separately catch failed durable-storage reads.

**Leading hypothesis, not established cause:** sign-in and downloads may be affected by the same unresolved data-access issue. No current private callback/connection evidence establishes the exact cause, affected table or actual connection configuration. Existing separate private connection diagnostic approval is still unanswered. Do not infer missing schema, Google credential defect, required key rotation, broken TLS or pooler/direct endpoint from these public results. Do not return true from failed identity establishment, skip storage readiness, enable GitLab or change live settings to make the UI appear fixed.

The last verified production build state was staged/not promoted. The owner's newer live screenshot has vxix branding; that alone does not identify a deployment or prove who promoted it. No new authenticated alias/deployment metadata was read in this follow-up, so current exact live deployment identity is unverified; do not turn the prior snapshot into a fresh current-state claim.
