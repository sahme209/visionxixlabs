# Customer email-verification recovery

Reviewed: 2026-10-15. Necessary website functionality, not a visual redesign. No schema, provider, credentials, production SQL, deployment routing, billing or entitlement changes.

## Reused contracts

The existing `/api/auth/resend-verification` endpoint already replaced unused proof tokens for unverified password accounts. It had no website caller. The signup confirmation and signin page now expose one shared recovery form using this endpoint; the form does not reset passwords or create identities. Concurrent clicks share one in-flight request. Requests report account-neutral guidance, not a claim that an account exists or delivery succeeded. A globally missing delivery configuration still returns 503. User-specific provider rejection, provider exception and account-store exceptions return the same public `{ok:true}` response as unknown, already verified and OAuth-only accounts. Private operational logs use fixed failure codes only, never provider errors, mailbox, token or identity details.

The existing in-memory combined mailbox/IP limiter is unchanged. This patch does not establish durable abuse protection or constant-time account lookup.

## Desktop navigation context

The active desktop pairing start route emits `/desktop/connect?challenge=…&intent=sign_in|sign_up`; its challenge is URL-safe and the server checks the pending record on signup. The new pure verification callback parser permits only that exact path, one bounded URL-safe challenge, and at most one valid intent. It rejects absolute/protocol-relative origins, backslashes/control characters, other paths/parameters, duplicate query keys, fragments and mismatched signup challenges. Valid existing path/parameter conventions are preserved.

Signup attaches a callback only when its challenge matches the already validated desktop request. The email helper carries it as an encoded `callbackUrl`; resend and the proof endpoint independently sanitize it. After atomic proof consumption, the endpoint redirects to signin with `verified=1` and optional valid callback. Signin explains that email proof does not establish a session or approve pairing. Expired requests still require returning to the desktop and starting Log in again.

**The callback is untrusted navigation context, not cryptographically bound proof metadata.** Editing it cannot change which token owner's email is verified. It establishes no identity, session, workspace access or pairing approval. `/desktop/connect` performs its existing challenge expiry/consumption/current-user checks and the operator must explicitly approve the displayed desktop. Token lifecycle, single-use/expiry, atomic identity update, OAuth and entitlement gates remain unchanged. No new signing, cookies or migration were introduced.

## Regression evidence

The new resend regressions failed four cases against the previous route (lost callback and rejected/throwing delivery or account-store failures), then passed against this patch. Focused tests cover strict navigation attacks, signup challenge binding, encoded proof links, proof-to-signin handoff with no cookie, existing atomic rollback/replay cases, account-neutral resend eligibility/failure handling, no raw-secret operational logging, global delivery unavailability, existing limiter denial, DOM duplicate-click protection, unavailable-service recovery, preserved signup confirmation and verified-email signin messaging.

Tests simulate delivery, database and browser/framework boundaries. They do not prove production mail delivery, account login or native desktop acceptance. Real acceptance still requires approved production recovery readiness and schema repair, then an authorized disposable customer's actual email proof, login, expired-link recovery and explicit desktop pairing with tenant/entitlement checks. Google/GitHub sessions and cloud/deployment/Stripe journeys remain separately unverified.
