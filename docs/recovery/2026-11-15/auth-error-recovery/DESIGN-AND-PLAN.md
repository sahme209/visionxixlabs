# Auth denial recovery — local corrective unit

Owner's Google AccessDenied report remains a real unresolved live identity/storage failure. This unit corrects a separate reproduced journey gap: installed NextAuth AccessDenied uses its default error page because current authOptions declares only signIn. The newly approved/designed simple login is therefore not reached. Installed NextAuth core/error dispatcher drops callbackUrl when handing off to a custom error page; blindly pointing errors at /auth/signin would strand an original desktop pairing target.

## Exact correction

Set the existing NextAuth error-page destination to a public /auth/error route. It reads only public configured NEXTAUTH_URL and Host comparison, never forwarded Host authority, sessions/DB/provider or credential settings. A noncanonical request redirects to the configured canonical /auth/error before reading a cookie. Missing/unsafe configured origin renders a branded unavailable notice; it does not require authentication or redirect recursively.

On canonical host, recover ONLY this installation's original transport-specific default NextAuth HTTP-only callback-url cookie. Installed core defaultCookies proves the exact secure/plain names. Treat the value as an untrusted navigation hint: reject foreign origins, protocol-relative paths, credentials, malformed/whitespace/backslash/control values, excessive length and recursive auth destinations; convert valid same-origin absolute/relative to an internal path. Missing/invalid callback falls back to existing sign-in behavior. Use URLSearchParams to redirect to existing /auth/signin with fixed generic error marker and optional sanitized callback. No raw provider error, OAuth code/state, query extension or actor is forwarded. Existing signin canonical origin, callbacks/provider detection/verified identity/concurrency and desktop session guards stay unchanged.

Cookie navigation is not identity or pairing authority. Existing sign-in and desktop endpoints must still validate their own challenge/current session. No cookie is written/cleared and no callback/lifetime is extended. This does not fix, allow or retry a denied identity; it offers a deliberate existing sign-in choice.

## Implementation and validation

1. Reproduce actual installed AuthHandler error response and missing helper/page: three RED files (one dispatcher assertion, two missing-source suites) before edits.
2. Implement fixed error-page mapping, pure callback parser/cookie selection and canonical-host public route.19focused initial PASS.
3. Add malformed/encoded/secure-cookie and actual NextRequest cookie-decoding coverage; run existing signin/callback/identity refusal/currentness regressions plus strict types. One independent source review; important actual findings get reproducer and correction, no review loops.
4. One offline website compilation after final source is coherent, then bounded localhost read-only error→signin navigation with synthetic callback cookie only, alias/missing-cookie checks and desktop/mobile visible failure message. No real provider/account submission. Preserve exact source, logs, review and owned cleanup.
5. Update current internal control guide and full master/handoff/goal by backup+preserving prepend; save coherent local commit. No new PR/deployment/native/install/production/secret/account/provider/resource/spending action. Private production diagnostic remains unanswered, full Governance/master scope open.
