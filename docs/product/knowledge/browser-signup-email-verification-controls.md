# Browser account creation and email-verification recovery

Internal source draft at `32e8d5a3f5107e7f91e650d537d16d9adb928e0b` (reviewed signup busy-state repair; historical inspected1fb9f9a8 retained separately). Customer/publication/editorial/media/native/runtime/release/shipped acceptance: false. Proposed IDs below are authoring labels, not installed help bindings. No account, email, password, verification token, session, provider, database or runtime configuration was read. No auth operation was invoked.

This is the missing browser `/auth/signup` form, its **Check your email** state, shared verification-email recovery and narrow token-verification endpoint/credentials guard. Existing [native sign-in](native-signin-and-access-controls.md) and [browser pairing](browser-desktop-pairing-controls.md) inventories explicitly exclude these forms and remain unchanged. This guide does not repeat pairing approval or document all sign-in/provider/account flows.

## Entry and challenge navigation

`app/auth/signup/page.tsx:1–7` calls the canonical-auth-page guard before rendering the client. The configured server origin owns redirection; Host is compared, not used as the redirect destination. Missing/invalid auth configuration throws rather than granting identity. This source statement is not a live host/cookie/security qualification.

The signup client's `redirect` is an internal path with `/download` fallback. Only a validated `/desktop/connect` callback with a syntactically valid challenge supplies the desktop challenge. Callback validation is navigation context, never proof that a pending/unexpired server challenge exists. The server checks that separately. Missing challenge displays the return-to-Agent alert and disables account/OAuth creation; this page has no challenge-code entry or repair button. Start again from Agent as the displayed guidance directs. The initial Suspense fallback is a visual spinner, not account/provider acceptance.

## Finite mounted signup controls

| Proposed ID | Actual control/state | Effect, disablement and boundary |
| --- | --- | --- |
| browser.signup.home | Vision XIX Labs | Ordinary `/` navigation; no cancel/rollback/auth-state change handler. |
| browser.signup.name | Name | Optional text, autocomplete name; server trims and caps at100characters. Input has no loading-disabled attribute or UI maxLength. |
| browser.signup.email | Work email | Required email input/autocomplete email; server trims/lowercases, caps254characters. HTML validation is not mailbox verification. No loading-disabled attribute. |
| browser.signup.password | Password | Required new-password input, minLength12/maxLength128, initial hidden text. Server enforces same length range. Do not include passwords in documentation/support. |
| browser.signup.password-visibility | Show password / Hide password | Changes local field presentation only; remains available during request, does not change password/server identity. |
| browser.signup.terms | I agree to Terms and acknowledge Privacy Policy | Required checkbox. Terms `/terms` and Privacy Policy `/privacy` open separate tabs; navigation is not acceptance or signup. Checkbox alone neither creates an account nor grants workspace access. |
| browser.signup.create | Create account / Creating account... | Disabled while either credentials creation or OAuth is pending, without accepted terms, or without a parsed desktop challenge. A shared synchronous ref guards both handlers, including direct form/Enter attempts while OAuth is pending; the guard releases in each finally. These are local overlap controls, not new authentication policy. Submits trimmed email/name, password, challenge, validated callback and terms. Inputs remain editable; no Cancel/abort/request deadline/automatic retry UI. |
| browser.signup.oauth | Continue with Google / Continue with GitHub / Opening… | Only rendered for providers returned registered by getProviders. Provider-loading/failure may leave buttons absent; absence does not inspect all provider service health. Buttons require accepted terms/challenge, no create loading and no other OAuth loading. Handoff invokes NextAuth with redirect, not provider login/MFA completion or backend terms/entitlement proof. |
| browser.signup.error | Alert | Non-success signup uses returned error or Sign up failed; thrown/parsing failure shows Something went wrong. OAuth returned error/throw uses its handler error text. Error is not proof no account/token row or mail side effect exists. |
| browser.signup.signin | Already have an account? Sign in | Navigates to `/auth/signin` retaining callback. It is not a password reset, account creation, verification or desktop approval. |
| browser.signup.entitlement | Production-access copy | Account creation does not include production access; approved pilot/commercial entitlement and genuine approvals remain separate. Read-only text, no entitlement purchase/provisioning control. |

This guide grants no retries for uncertain creation. The reviewed12-line local repair serializes credential/OAuth initiation and mirrors existing terms/challenge UI guards in the submit handler; it does not change backend auth/entitlement policy or qualify a live session. The Google/GitHub signup handoff is inventoried only through its local initiation; provider-hosted account/password/MFA, NextAuth callback completion and all OAuth identity semantics remain outside scope.

## Check your email and the real account boundary

`AuthFormClient.tsx:77–151` treats `verificationRequired:true` as **Check your email**, clears the password and does not attempt credentials login. The status says a link was sent to the submitted address; that is displayed service-response copy, not observed delivery/inbox ownership. **Continue to sign in** preserves callback; the recovery disclosure remains available. Pairing may expire while email is pending; a new Agent sign-in is then required, not extension of the old challenge.

A compatibility branch for a successful response without verificationRequired attempts credentials sign-in and either navigates to redirect or manual sign-in. This is not a verification bypass: the inspected current signup route always returns verificationRequired on success, and credentials authorization separately requires the stored verified-email field and password comparison. UI navigation/HTTP200 alone is not identity/session acceptance.

`app/api/auth/signup/route.ts:9–95` checks database/mail-service configuration, source-IP rate limit, required email/password, nonblank challenge, accepted terms and password/name/email bounds. It loads a pending, unconsumed, unexpired challenge and refuses duplicates (409). It creates a password-hashed user, persists a hashed verification token and calls the email helper. Account/token rows may already exist when email delivery fails (503), later setup/storage errors occur or a response is lost. No full rollback or verified delivery is established. Workspace-membership bootstrap is best effort and is not deployment entitlement. Displayed database/configuration errors are service-unavailable feedback, not instructions for a customer to run migrations or provide connection strings.

## Shared verification-email recovery

`components/auth/VerificationRecovery.tsx:8–54` mounts on signup both before submission and after Check your email, and on sign-in. These are real controls distinct from password recovery:

| Proposed ID | Actual control/state | Behavior and limits |
| --- | --- | --- |
| browser.verification.open | Need a verification email? | Expands recovery and copies the current supplied email as initial input. No close/collapse/cancel button is mounted after expansion. |
| browser.verification.email | Verification email address | Required email/autocomplete, maxLength254; editable while pending. Typing does not create/reset an account or send mail. |
| browser.verification.request | Request verification link / Requesting link… | Disabled while pending; inFlight ref refuses another handler request concurrently. Sends trimmed email and only a validated desktop callback. No deadline/cancel/automatic retry here. |
| browser.verification.neutral-status | If your account needs email verification… | Shown for any HTTP-success response without checking response body. It deliberately confirms neither account existence nor successful delivery, mailbox ownership, verification or login. |
| browser.verification.error | Recovery unavailable alert | Network/non-success request asks to try later. No claim that prior unused links or account state remained unchanged. |
| browser.verification.support | Contact support | `/contact` navigation only. No support message, mailbox/API write or account change is performed by this link. |

The recovery endpoint (`resend-verification/route.ts:13–38`) returns neutral success for empty/overlong/rate-limited requests and unknown/verified/OAuth-only accounts. This is response-level neutrality, not constant-time or backend-wide privacy certification. For an unverified password account it transactionally removes previous unused links and creates a new hashed token, then attempts mail delivery. User-specific delivery/store failures stay neutral. Missing global mail configuration can return503. A successful response is not proof that any mail was sent. A newly issued link can invalidate old unused links even if delivery fails; preserve that uncertainty and use displayed later/support path, not repeated signup with another identity or a guessed token.

## Verification link outcomes and sign-in confirmation

The helper issues a random token, stores its SHA256 digest and expiry24hours; source code is not a read of any real token. Following `/api/auth/verify-email` is a **GET that can mutate verification state**, not harmless URL inspection. Do not paste/share/replay real verification links in support artifacts.

`verify-email/route.ts:6–35` returns400 for missing/overlong token or invalid/expired/already-used proof. Its transaction conditionally claims an unused unexpired token and updates the owning user's emailVerifiedAt in the same commit; a failed transaction does not consume proof without the identity update. Success redirects to `/auth/signin?verified=1`, retaining only a validated desktop callback. Temporary store failure returns503 with Try this link again guidance; no automatic replay or endpoint invocation occurred for this guide.

The sign-in page's **Email verification completed. Sign in to continue** banner is driven by the `verified=1` query parameter. The banner alone is not proof that this visitor verified email, received a session or approved desktop pairing. `lib/auth.ts:26–71` independently rate-limits normalized-email credentials attempts, requires stored passwordHash and emailVerifiedAt, compares the supplied password and denies on identity-store error. Subsequent session, membership, commercial access and pairing decisions remain separate and are not accepted by this source inventory.

## MFA and other explicit gaps

Finite source discovery under app/auth, app/api/auth, components/auth, app/account and lib/auth found no mounted MFA enrollment, TOTP input/challenge, backup/recovery-code or password-reset form for this unit. lib/auth.ts's enterprise MFA-claim comment is not such a UI; any provider/enterprise claim handling or design document must not be presented as a customer MFA flow. This is a scoped absence finding, not proof no MFA exists anywhere or no upstream provider uses it. Provider-hosted MFA and enterprise/Cognito policy enforcement are excluded/unqualified.

Also excluded: full sign-in form/provider-specific callback/error/account-switch inventory, password reset, account settings/SSO management, email client/link-delivery behavior, mail provider setup, complete auth/session/cookie backend security, current mailbox/account existence, production entitlements, native storage/clean-host pairing, every browser/platform/media/AT state. No auth code changed; no test/build/browser/network/email/provider/DB/native/auth/API/credential/Security/helper operation was run. B4/B5 globally remain incomplete; offline AI ingestion/customer support acceptance is not enabled. Exact current source hashes/ranges are in `docs/recovery/2026-11-04/browser-signup-verification-guide/source-bindings.json`.
