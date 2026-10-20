# Canonical-origin authentication recovery — October 20, 2026

## Fresh evidence

Read-only Vercel alias/deployment metadata identifies production domain
`visionxixlabs.com` with deployment `dpl_5Kdgq8YPSjysSQqk8rNLbrjAVVeH`, main
commit `0099adfab5ccc22342f1637c1eaeea8e1cd50ac2`, READY. This supersedes the
historical older-deployment finding. This controller did not deploy or promote it.

The founder retried Google sign-in and still observed denial. Vercel runtime logs
on October 20 correlate:

- 11:32:35.751 UTC: POST `/api/auth/signin/google` on the preview deployment
  `dpl_Et7PsW4ExedkbKAcRq8JLewib3VL`.
- 11:32:40.325 UTC: GET `/api/auth/callback/google` on production deployment
  `dpl_5Kdgq8YPSjysSQqk8rNLbrjAVVeH`: `OAUTH_CALLBACK_ERROR`,
  `State cookie was missing.`

OAuth started on one hostname and returned to another. Host-only state cookies
cannot cross that boundary. This attempt fails before identity-store acceptance;
it does not disprove the earlier missing-column P2022 diagnosis or establish the
current production schema. A seven-day log query exceeded plan retention; a
23-hour P2022 query returned no matching events, which is not recovery proof.

The Vercel page-fetch tool was rejected by automatic approval review because it
creates/reuses an authentication-bypass link. No bypass was created, and no
alternative was used to circumvent that rejection. The founder's interactive
retry and read-only runtime logs supplied the evidence instead.

## Direct production retry establishes a separate database blocker

At 11:38:51.577 UTC the founder started Google on production directly. At
11:38:54.592 UTC the same production deployment/domain logged
`[NextAuth signIn] identity upsert failed`, Prisma `P2022`, model `User`, column
`User.emailVerifiedAt`. This fresh attempt establishes the current production
schema mismatch independently of the preview state-cookie failure. The callback
reaches the application identity gate; it then correctly denies when identity
storage fails. It does not establish a working authenticated session or prove
all provider, authorization or database-binding checks succeeded.

Commit `1ce1f376` added the verification scalar on October 14. The OAuth upsert
implicitly returns all User scalars even though this callback consumes only ID
and email. Credentials legitimately require the verification field. Narrow
OAuth projection must be proven against the actual Prisma engine before source
publication; password recovery still needs approved schema readiness.

## Focused source correction

Both signin and signup hand off to the server-configured `NEXTAUTH_URL` origin
before rendering their unchanged client forms. Only safe internal return paths
and supported confirmation/account-switch markers survive the handoff. Redirect
targets never come from request/forwarded headers. Configuration must be HTTPS
except explicitly configured literal-loopback HTTP for isolated testing.

All noncanonical NextAuth API GET/POST requests return a no-store 409 before
NextAuth can issue cookies or process credentials/callbacks. They are never
replayed or redirected with passwords, OAuth codes or state. Properly configured
same-origin preview/local environments remain usable. Existing state, PKCE,
CSRF, session, authorization and email-verification checks remain unchanged.

The OAuth User projection now selects only `{ id: true, email: true }`.
An actual local PostgreSQL 17 / Prisma 5.22.0 regression reproduced exact P2022
for both existing and absent new identities with the old unprojected query;
the projected queries then updated the existing identity and inserted the new
one successfully. Row-count assertions confirm the latter really exercised an
insert, and the existing canonical ID was preserved. The ordinary full User
lookup still failed on the missing verification column. The owned container was
removed. See `docs/mission/oauth-user-projection-local-proof-2026-10-20.json`.
The first disk-backed attempt failed with SQLSTATE 53100 and cleaned up; the
successful retry used bounded 256 MiB tmpfs. No shared data/cache was deleted.

This changes only returned OAuth identity fields; it cannot remove password
verification, validate founder workspace membership or replace schema recovery.
The SQL proof is not NextAuth HTTP/browser or production acceptance.

## Validation and remaining release gates

Focused regressions cover unsafe configuration/return paths, canonical handoff,
signup, desktop callback preservation, noncanonical credential POSTs and cookie-
bearing GETs, callback code/state containment, existing account switching and
verification recovery, and fail-closed identity/password behavior. Initial
focused run: 57 tests / 8 files passed. The first full default run had 8,025
passes, 58 failures and 29 unhandled errors: subprocess/listener sandbox denials
and two static signup-contract assertions pointing at the former client path.
Those paths are updated. The native-permission rerun passed 8,119 tests across
723 files, with 28 opt-in tests in one file skipped. Python CLI: 30 passed.
Final web compilation, desktop release consistency/types/frontend build, scoped
lint and the Vercel build safety contract passed. Exact-head CI remains pending.
The desktop check did not produce or publish a native installer.

This is source preparation only: no deploy, production environment/secret change, production database
write, production migration, payment change or installer publication. Actual deployed Google,
GitHub, password login, founder workspace access, session/logout and native
pairing remain unverified. Production recovery still requires serving/preflight/
Neon binding equality, a usable recovery point, verified restore readiness and
explicit approval of exact changes in `PRODUCTION_AUTH_RECOVERY_PLAN.md`.

After source/CI checks, present the exact commit and release impact for approval
under the ONE FINAL production deployment policy. Do not deploy this PR on merge.
If the corrected origin flow exposes P2022, follow the existing recovery gates;
never weaken cookie checks or fake verification/membership to bypass it.

Post-login navigation remains unchanged: `/auth/success` is currently the web
companion and desktop pairing preserves its challenge. `/dashboard/*` is
intentionally redirected to downloads by existing delivery policy. Selecting the
latest actual cockpit requires validating the supported application route; it
must not point users to an obsolete or disabled dashboard.

## Current read-only recovery metadata

October 20 Neon API reads confirm the existing main branch is ready and the
project retains 21,600 seconds (six hours) of history. Branch metadata labels
its endpoint restrictions as a Vercel production branch; this is corroborating
integration metadata, not proof of equality with the serving deployment's
effective DATABASE_URL or protected preflight target. The project snapshot list
is empty and this branch's snapshot schedule is empty. These API inventories do
not establish absence of PITR history; neither do they prove a usable timestamp
or a successful restore. No snapshot, branch or restore was created or modified.
Binding equality, a current usable recovery point and a verified isolated restore
remain required before any production schema/ledger execution.
