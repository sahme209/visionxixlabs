# Desktop startup and focus verification

The saved-credential check previously allowed overlapping focus requests to
apply out of order. A failed check also asynchronously cleared both credential
stores, even when the failure could be a service/schema/network problem. An
older response could override a newer identity or begin deleting credentials
after a newer sign-in.

The startup/focus coordinator now applies only the latest request for the same
immutable client configuration. `setSession` and `setApiBase` replace that
configuration, including same-token reloads; explicit sign-in, sign-out and
access transitions invalidate outstanding checks. Unmount disposes the
coordinator. No raw credential is logged or exposed by this controller.

An authoritative current failure clears the active transport synchronously,
removes the displayed identity and returns to sign-in. It does not delete secure
vault records. Network failure is not proof that a saved secret is invalid.
Saving credentials still does not grant access: the service must return a valid
verified identity and an explicit access result. Explicit sign-out retains its
existing vault-clearing behavior. Manual API-key and browser-pairing submission
lifecycles remain separate follow-up surfaces; this change covers startup/focus.

Eight deferred-response tests cover older failure/newer success, older
success/newer failure, credential replacement/removal, explicit invalidation,
unmount, missing credentials and sanitized unexpected errors. The existing
first-run contract also checks the coordinator wiring, explicit access gate and
absence of automatic vault-deletion calls in App. These tests do not certify
native keychain behavior, actual OAuth sessions, deep-link acceptance or signed
macOS installation. Production login and founder mapping still require the
protected read-only database preflight followed by approved repair and actual
password/Google/GitHub session checks. No production configuration or data is
changed by this desktop source repair.

Local validation: 540 Vitest files / 5,356 tests; web and desktop TypeScript;
targeted desktop lint; desktop frontend build; 30 Python CLI tests; mission
register validation. Actual native/runtime acceptance remains open.

## Administrator-key recovery candidate

Recovery input is now verified with an explicit request-scoped bearer before any
vault write or active transport change. Invalid format, server rejection and
verification transport failure preserve existing stored credentials. A vault
write failure does not hot-apply the candidate or delete the previous key; actual
OS-vault atomicity still requires native acceptance. Successful verification
keeps commercial access decisions separate, then persists before activation.
Browser sign-in buttons and the recovery Enter shortcut cannot start an alternate
flow while key verification is busy. Browser cancellation/unmount races remain a
separate tracked concern; this change does not claim to resolve them.

Recovery-candidate validation: 545 Vitest files / 5,402 tests passed on the combined
branch, including request-scoped bearer, vault ordering and rendered sign-in
interaction checks. Web/desktop TypeScript, desktop frontend build and all 30
Python CLI tests passed. Native Keychain and actual OAuth/pairing acceptance are
not established by these simulated tests.

Clean web CI follows these component imports into desktop modules. Root development
dependencies therefore pin the existing desktop versions of the Tauri API and
shell JavaScript packages for type resolution. Vitest continues to stub native
calls; no native toolchain, runtime permissions or credential access is added to
web CI, and no source/test compiler exclusion is introduced.

## Local backend pairing protocol rehearsal (2026-10-16)

`scripts/rehearse-local-desktop-pairing-http.mjs` extends the isolated auth HTTP
harness after its real web session and accepted synthetic workspace exist. The
parent supplies only its bounded loopback web request function and synthetic
challenge context; device polling and identity checks use a separate cookie-free
HTTP channel. The module checks pending/device binding, authenticated consent,
approval, single-use consumption, workspace identity, owner session listing and
revocation invalidation. Bearer/session identifiers remain in memory and are not
included in its result.

The module reports commercial access as an **observation**, not entitlement
acceptance. Current source deliberately uses identity-only commercial access;
a no-plan account may therefore report `allowed: true`. Whether to enforce paid
access remains an explicit product/commercial policy decision. This rehearsal
neither changes that policy nor exercises cloud enrollment, deployment, billing
providers or production. Its protocol safety tests use a local test server;
actual application/PostgreSQL acceptance must be recorded separately by running
the parent isolated harness. It proves neither browser consent interaction nor
native deep links, Keychain persistence, installer behavior or production login.
