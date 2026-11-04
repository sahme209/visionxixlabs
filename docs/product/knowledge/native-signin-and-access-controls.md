# Native sign-in and access controls

Internal source guide, B4; frozen source baseline `08400007deba2b24bb11b754e6658bfabe304b66`. Customer eligible: false. Runtime, media, editorial, and release acceptance: false. Proposed IDs below are documentation identifiers, not runtime help bindings. A5 clean-host acceptance remains UNFINISHED. This guide is not installer, fresh sign-in, session persistence, Keychain, browser, or OS acceptance evidence.

## Entry and locked startup

`main.tsx:7–15` installs the fetch bridge and mounts DesktopStartupGate. `DesktopStartupGate.tsx:5–30` hydrates only the selected credential before App. Its status is “Opening secure sign-in…”; after 15 seconds it reports secure storage taking longer than expected and exposes **Continue to sign in**. That button aborts hydration and proceeds without a saved identity. The system-permission explanation asks the user to review any OS secure-storage prompt; there is no embedded Keychain approval button. The workspace remains locked. Hydration failure is caught; App still verifies before operations.

`App.tsx:44–120` mounts checking → sign-in, verified access-required, or authenticated workspace. Checking shows “Verifying saved sign-in”; missing identity can show “Loading verified identity”. Focus requests current-credential verification. Rejection locks transport, clears the displayed identity, retains saved vault data, and offers saved-sign-in retry only for unavailable failures. The coordinator rejects stale contexts/generations and ignores canceled results (`credentialVerificationCoordinator.ts:10–41`). Identity verification and entitlement are separate; account creation alone does not authorize deployment operations.

## Finite mounted sign-in inventory

All controls and state below are in `DesktopSignInView.tsx:7–157`.

| Proposed ID | Control or state | Behavior, disablement, error and safe recovery |
|---|---|---|
| native.signin.login | Log in | Starts browser intent `sign_in`; disabled unless idle and not checking a key. Labels: Opening secure browser…, Waiting for browser approval…, Saving secure sign-in…, Checking saved sign-in…. |
| native.signin.create | Create account | Starts browser intent `sign_up`; same disablement. This is a native handoff, not documentation of browser signup screens. |
| native.signin.cancel | Cancel | Mounted during opening, waiting, or retrying; aborts, resets idle and clears error. Not mounted during saving; committing guard refuses cancellation after persistence begins. Unmount aborts the active controller. |
| native.signin.saved-retry | Retry saved sign-in | Conditional availability from startup/retry unavailable failure; disabled while non-idle or key checking. Verifies the selected credential, rechecks durable selection/context, and activates only a current success; never writes a new selection. Failed non-canceled result becomes the alert; retry remains available only for unavailable failures. |
| native.signin.recovery | Enterprise recovery sign-in | Native details/summary disclosure; administrator-issued recovery access, still requiring approved entitlement. |
| native.signin.key | Workspace API key | Password-type input, autocomplete off, spellcheck false; editing clears error. Input itself has no disabled attribute. Enter submits only for nonempty trimmed input while idle and not checking. Do not paste keys into support records. |
| native.signin.key-submit | Use administrator key | Disabled for empty trimmed value, checking, or non-idle state. Shows Verifying workspace…; successful verification plus durable save clears the input and calls onSignedIn. Errors display in role=alert; fallback says workspace key could not be verified. |
| native.signin.error | Error alert | Initial startup error or current operation error. Browser failure returns idle; canceled/stale operations do not publish an error. Recovery requires another explicit attempt, not an automatic identity fallback. |

There is **no mounted manual pairing-code input or manual pairing submission** in this view. Browser code entry, provider login/password/reset/MFA, signup validation and account creation completion screens are outside this inventory.

## Browser handoff, selection and service boundaries

`desktopPairing.ts:9–166` requires HTTPS service origin (or loopback HTTP development origin), no embedded URL credentials/path/query/hash; validates exact `/desktop/connect` origin, challenge and intent before opening the system browser. It reads or creates a stored device fingerprint; start and status requests include that fingerprint. Browser return is not authentication success: approved token/session must pass validation, service identity verification, and durable selection save. Requests have 30-second timeouts, polling waits two seconds, and the local deadline is ten minutes (“Sign-in expired. Please try again.”). Unexpected links, changed service origin, start/status failures and cancellation fail the attempt. Unknown/unapproved status never unlocks; polling eventually expires.

`app/api/desktop/pair/status/route.ts:20–88` is a limited source reference for polling responses, not backend-wide qualification: missing device binding returns **426 desktop_update_required**, instructing download of the latest signed installer and a new sign-in. It does not enable challenge-only completion. Missing challenge, wrong device, expired/consumed request, inactive approved session and status service failure return errors; pending returns 202. Follow the existing update instruction for that old-build case; do not bypass device binding or claim a successful upgrade here.

`activeDesktopCredential.ts:17–150` validates API-key format and paired-session metadata, verifies the candidate without activating it, then commits credential plus active selection in one vault value before setting transport. Invalid selection can be replaced by newly verified recovery. Explicit selection prevents fallback across identities; only installations lacking selection metadata retain API-key-first legacy compatibility. Selected missing/invalid/expired credentials require sign-in again. Saved-session expiry checks are in `authSession.ts:24–39`. Saved credential presence/status is **not fresh sign-in or persistence acceptance**.

`desktopClient.ts:638–682` verifies `/api/desktop/access`, with a 15-second boundary, bearer candidate and expected identity kind. 401/403 classify rejected; 5xx/408/429 unavailable; other failures or schema/kind mismatch invalid; cancellation is distinct. User-facing verification errors are sanitized. `desktopIdentityResponse.ts:7–29` validates workspace identity, optional role/user/capabilities and allowed access-code shape; it does not grant operational authority. A verified current identity is scoped to its organization and current credential context; no provider-wide action permission follows from it.

`secureStorage.ts:18–42` delegates packaged storage reads/writes/deletes to native commands; outside Tauri it uses memory only. This source guide did not invoke those commands, read saved values, exercise Keychain, or inspect credentials. OS prompt appearance, consent choices, signed-app identity, denial recovery and durable storage success remain unaccepted.

## Access-required inventory

`DesktopAccessRequiredView.tsx:8–126` shows identity verified, service title/message, workspace and billing status. It renders these finite controls:

| Proposed ID | Control/state | Boundary and recovery |
|---|---|---|
| native.access.billing | Manage billing / Opening billing… | Only payment_past_due or access_canceled; disabled while opening. Requests portal, accepts only HTTPS stripe.com or its subdomains, then opens system browser. Unexpected destination/service/open failures appear as alert. No billing completion acceptance. |
| native.access.request | Request pilot access | Other access codes; opens service accessRequestPath under website base. No explicit loading/disabled/error catch on this button. Provisioning is not completed by the click. |
| native.access.refresh | Check access again / Checking access… | Disabled during checking or sign-out. Verifies current credential; allowed success calls parent; still denied reports not active yet. Errors stay visible; mounted/generation/config/auth checks discard stale results. |
| native.access.model | Review access model | Opens pricingPath in system browser; no explicit loading/disable/error catch. |
| native.access.account | Use another account | Disabled while signing out. Invalidates access check; locks transport, persists signed_out tombstone, attempts legacy cleanup, then returns sign-in on success. Failed cleanup reports that sign-out is saved but older credentials could not be removed; retry when secure storage is available. |

No arbitrary unknown access-code screen is claimed: the identity parser rejects unsupported codes. No expired-credential success is inferred from the “Identity verified” heading. Billing return/focus can cause verification; it is not entitlement proof by itself.

## Account, preferences and billing after access

Settings authentication/account scope is finite: `SettingsView.tsx:112–229,252–268,280–380`. Profile displays name, email (or Administrator credential/Not available), workspace and authentication kind; these are read-only identity rows. **Hide email address** changes local display preference only, disabled until preferences exist. **Log out** opens **Log out?** dialog; **Cancel** closes it; dialog **Log out** invokes sign-out and reloads on success. These dialog buttons have no in-flight disablement in source. External workflows are not canceled. Tombstone-first storage semantics above qualify the UI's removal wording.

Preferences load failure asks to reopen Settings. Saving shows “Saving on this computer…”; save failure restores previous UI values, marks confirmation unknown, and asks to reopen Settings before another change. The fieldset disables preference editing during save and affected general/profile/appearance/agents edits after an unconfirmed write. `preferences.ts:49–66` orders pending writes, calls native get_preferences/set_preferences, and applies presentation preferences; preferences are not credentials, identity edits, approvals or workspace access grants. Other preference categories are documented separately in settings-workspace-controls.md.

Plan & usage shows Verifying…/Unavailable/current or legacy service evidence. **Refresh plan and usage** is disabled without current context or while initial result is pending; focus/context changes also refresh. **View billing in cockpit** opens the website and catches opening failure. Snapshot **Open billing** appears only with available plan, customer, management capability and owner/admin; legacy paid branch disables it while opening or for other roles. It shows Opening… and validates the same HTTPS Stripe destination. No-plan, approved no-charge access, unavailable service and older-service allowance states have distinct copy; none is a receipt of a fresh purchase. Account identity, balances, local preferences and payment navigation never replace service execution approvals.

## Evidence limits and next acceptance

This is source-only documentation of these mounted native controls and direct boundaries. No runtime, build, tests, browser/network/provider/database/native security helper or credential access was performed for this slice. No claim covers all signup/auth backends, identity providers, browser approval screens, billing success, every Settings control, installer behavior, secure-storage consent, persistence across restart, session revocation/refresh across devices, or platform coverage. A5 clean-host installer/session acceptance remains UNFINISHED and must supply its own authorized evidence. Recovery is limited to explicit source controls: cancel before commit, retry saved sign-in for unavailable service, start a new browser attempt after expiry, administrator-issued recovery key, review OS storage prompt, reopen Settings after unknown preference save, and follow existing signed-installer update instructions for 426.

Exact whole-file and inclusive raw-line SHA256 bindings are in `docs/recovery/2026-11-03/native-signin-guide/source-bindings.json`. No mutable master-plan hash is included.
