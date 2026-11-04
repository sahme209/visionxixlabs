# Browser desktop pairing controls

Internal source draft at `7193de939c8e64c0684976d1600d68f79d5b30c4`. Customer eligibility and editorial, media, native, runtime and release acceptance are all false. Proposed identifiers below are documentation labels, not runtime help bindings. Actual live browser pairing and clean-host installer/session acceptance remain unaccepted.

## Purpose and entry

The installed app starts a device-bound challenge, then opens `/desktop/connect?challenge=…&intent=…` in the browser. This page lets a signed-in browser user review a device and approve a desktop session. Browser approval, native credential verification/persistence, and commercial entitlement are separate boundaries. Never interpret “Axiom Agent is authorized” as proof that the native app saved an identity or can execute operations.

`app/desktop/connect/page.tsx:11–32` loads the challenge at request time. Missing, expired or already consumed records show **Pairing link invalid** and “Return to Axiom Agent and start sign-in again.” This invalid state has no retry form or approval control. Unauthenticated visitors are redirected to `/auth/signup?redirect=…` for `sign_up`, otherwise `/auth/signin?callbackUrl=…`, preserving the challenge callback. Any other page intent becomes `sign_in`. These are navigation contracts only; this guide does not describe those destination screens or establish successful signup/login.

The start route (`app/api/desktop/pair/start/route.ts:8–59`) accepts device fingerprint/label, known platform or unknown fallback, optional app version and sign_in/sign_up intent; invalid intent/input returns 400. It creates a random challenge with ten-minute expiry and returns the matching verification URL. A creation failure returns 503 guidance. The intent travels in the URL, not the stored challenge fields shown in this route; do not claim a server-stored intent binding here.

## Review before approval

`page.tsx:34–66` displays **Authorize Axiom Agent**, the current browser context email and “Approve only if this is your desktop.” Read-only rows show device label, platform, app version (or Not reported) and request expiry. No editable device, fingerprint, challenge, account-email or intent input is mounted. Device details describe the request; they are not an independent guarantee of the physical device's identity. Current-context email is display context, not user input or desktop identity selection.

| Proposed ID | Mounted control/state | Source behavior and limits |
|---|---|---|
| browser.pair.home | Vision XIX Labs | Website home link `/`; no pairing mutation. page.tsx:36–39. |
| browser.pair.access-request | Request production access | Only when commercial access is not allowed; opens service accessRequestPath. No loading/disabled/approval-completion behavior supplied here. page.tsx:52–64. |
| browser.pair.access-model | Review access model | Same denied-access condition; opens pricingPath. Access title/message remain service output. The pairing controls still render below this notice; the notice does not itself refuse identity pairing. page.tsx:52–66. |
| browser.pair.approve | Continue / Connecting… | Posts challenge to `/api/desktop/pair/approve`. Disabled whenever state is not idle. A ref also excludes competing approval/account-switch actions. PairDesktopClient.tsx:13–33,77–84. |
| browser.pair.cancel | Cancel | Link to `/`, available even while loading or switching. It navigates away; source does not revoke the challenge/session, cancel an already dispatched approval, or abort the request. PairDesktopClient.tsx:76. |
| browser.pair.switch | Use another account / Switching browser account… | Disabled outside idle. Validates a same-challenge sign_in callback, then calls browser NextAuth signOut with explicit sign-in destination and switchAccount=1. Existing paired desktops remain signed in; no pairing approval, desktop revocation or selected native identity change occurs in this handler. PairDesktopClient.tsx:35–54,87–90. |
| browser.pair.error | Error alert | Displays approval response message, then error, then Pairing failed fallback; malformed response JSON/network errors are caught. Account-switch callback rejection asks to return to Agent and choose Log in again; signOut failure asks to retry or reload pairing page. Failure resets action/state for another explicit attempt. No error timeout or automatic retry. PairDesktopClient.tsx:24–31,37–52,74. |
| browser.pair.done | Axiom Agent is authorized | Replaces approval/switch/cancel controls after an HTTP-success response. After 450 ms attempts `axiom-agent://auth/complete`; **Open Axiom Agent** provides that link manually. This client does not validate a specific response status body, poll native state, or observe OS handoff success. There is no handoff-error UI. PairDesktopClient.tsx:24–27,56–65. |

There is no browser-local timeout, countdown, refresh-status button, challenge/code entry, session selector, password input, or browser-specific undo approval control on this page. Expiry after page load is reported by the approval endpoint; displayed expiry is request-time content, not a live validity guarantee.

## Direct approval and account-switch contracts

`app/api/desktop/pair/approve/route.ts:11–51` requires authenticated user and organization, a challenge, an existing record and nonexpired request. Errors include auth_required (401), challenge_required (400), pairing_not_found (404), pairing_expired (410). Existing sessionId/approved/consumed state returns HTTP success without a new approval. Therefore client success does not prove this current browser account created or replaced the original approved identity.

`approve/route.ts:54–146` evaluates pairing policy, returns its denial reason/code with 403, then claims a pending unused challenge using an update guard. A lost claim returns pairing_already_in_progress (409). Session creation uses the approving browser context's user/organization and the stored request's device metadata. Success records approved status/session. Creation failure attempts to reset an uncompleted approving record and returns pairing_approval_failed (500) with retry/administrator-reference guidance. These statements describe this route's source; they do not qualify database concurrency, session custody or every authentication backend.

The immediate policy (`lib/desktop/desktopAuthPolicy.ts:35–61`) requires signed-in user/organization, a fingerprint of at least sixteen characters, rejects all-zero/all-x fingerprints, requires a device label and refuses at five active sessions for that user. Session-cap guidance says to revoke an existing pairing before adding another; no revocation control is mounted here and this guide does not authorize or validate that separate operation. No role-specific approval or entitlement guarantee should be inferred beyond these inspected checks.

`lib/auth/verificationCallback.ts:1–18` accepts only a bounded relative `/desktop/connect` callback, with one valid challenge and optional recognized intent, no extra query keys, fragment, network-path URL, whitespace/control characters or challenge mismatch. The account-switch handler supplies sign_in even if entry used sign_up. The validator's own contract is navigation context only; it establishes no identity, entitlement or pairing approval.

## Native consumption remains separate

The installed poller sends challenge plus stored device fingerprint (`desktop/src/lib/desktopPairing.ts:94–143`). It continues on 202 pending, surfaces non-success status errors, and accepts only approved status with token and session before calling native verification/activation. It checks service origin again, and its local wait eventually expires. Browser approval is not saved-native-identity evidence.

`app/api/desktop/pair/status/route.ts:20–88` rejects malformed input; missing device fingerprint specifically returns **426 desktop_update_required** with existing latest-signed-installer guidance, never challenge-only completion. Wrong device returns 403, absent challenge 404, expired request/inactive approved session 410, consumed/lost-consumption claim 409, unavailable status 503. Pending returns 202. Approved active session is consumed with a guarded update before token/session are returned. No repeat-use or automatic-recovery success is claimed.

`desktop/src/lib/activeDesktopCredential.ts:30–73` separately validates paired-session metadata, verifies the credential with the service, commits credential plus active selection to storage, then activates transport. An approved session can still fail this native verification/save boundary. Native storage consent, Keychain behavior, restart persistence, current entitlement and operational permissions remain outside browser success. See [native sign-in and access controls](native-signin-and-access-controls.md) for the finite native control inventory; it remains a separate source draft.

## Recovery and evidence limits

For an invalid/expired/consumed challenge, start a new sign-in from Agent. For a browser-account mismatch, use the explicit account-switch control, sign in with the intended account, then review the device again; it does not reassign an already approved challenge. For approval errors, use the displayed guidance and explicit retry. For a failed OS deep link, the manual Open Axiom Agent link exists, but native outcome must still be verified separately. Cancel navigates home and is not revocation. No screenshots, live identities, actual challenges, tokens, passwords, keys or session records were read for this guide.

Scope excludes full sign-in/signup flows, provider password/reset/MFA/verification screens, browser-session internals, backend-wide authentication guarantees, complete account/revocation controls, billing completion, actual device binding qualification and all platform/browser acceptance. No tests, builds, browser/native/auth operations, network/provider/database/credential access, Security APIs, Keychain or helpers were performed. The two-file source guide records source behavior only. Exact whole-file and inclusive raw-range SHA256 bindings are in `docs/recovery/2026-11-04/browser-desktop-pairing-guide/source-bindings.json`; no mutable master-plan hash is included.
