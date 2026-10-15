# Desktop recovery, restart and entitlement ownership

## Customer milestone

A verified browser recovery must survive restart even when an older administrator key remains saved. Previously startup hydrated a pairing token, then always overwrote it with a saved API key. A rejected key could therefore lock the customer out again after apparently successful pairing, or select an older workspace.

The desktop now stores an explicit versioned selection together with its selected credential in one OS-vault value. Verified administrator recovery and verified browser pairing use the same boundary. Server candidate verification happens before the write and transport activation happens only after it succeeds. Switching credential kinds preserves the inactive value in the envelope and does not delete legacy values. Startup uses only the selected value; missing, malformed or expired selected values lock the client for recovery rather than silently restoring another workspace. The normal server identity/access check still runs before operational screens load.

Existing installations without a selection keep their previous API-key-first order. Reading those legacy values no longer deletes invalid/expired credentials. A newly verified recovery can replace corrupt selection metadata, without deleting legacy credentials. A single envelope write removes the earlier split credential/preference commit window; it is not a claim of transactional OS-vault behavior across process crashes.

## Honest cancellation boundary

Browser approval is verified without first replacing the active transport. Abort is checked after verification and again after reading prior selection metadata. Before the durable write starts, cancellation preserves the prior selection. Immediately before the write, the view synchronously enters **Saving secure sign-in** and stops offering Cancel. Already-started native persistence cannot be canceled or undone by the JavaScript abort signal. Unmount suppresses late UI completion; it is not a promise that an already-started native write was rolled back. No multiwrite rollback can overwrite a newer selection.

## Sign-out and access checks

Explicit sign-out locks the transport, saves a signed-out tombstone, then attempts legacy cleanup. Even when cleanup fails, restart cannot reactivate leftover legacy credentials. A vault failure saving the tombstone is reported rather than claiming durable sign-out; the in-memory transport stays locked and retry is needed. The device should not be treated as durably signed out until persistence succeeds.

A pending blocked-workspace access check may grant access only while its view is mounted, its request remains current, and its immutable credential context is unchanged and present. Sign-out invalidates pending checks synchronously. Replacement credentials, unmount and verification exceptions cannot resurrect an old workspace identity.

## Evidence and remaining native acceptance

Behavioral tests cover browser recovery followed by simulated process restart with an older saved key, switching kinds while retaining inactive credentials, rejected candidates, denied persistence, selected missing/expired/corrupt values, legacy compatibility, before-commit cancellation, the saving UI, sign-out cleanup failures, and stale entitlement responses after sign-out/unmount/replacement. These use simulated vault/provider responses; no actual accounts or OS credentials are accessed.

Still required: exact signed artifact installation, real website authentication and browser pairing, allowed workspace/pilot policy, OS-vault restart persistence, denied/locked vault behavior, upgrade from a deliberately seeded isolated legacy fixture, and sign-out/restart cleanup on each supported native platform. Production schema recovery and provider-backed customer acceptance remain separately gated. This change does not authorize any production database, secrets, routing, cloud infrastructure or live billing operation.
