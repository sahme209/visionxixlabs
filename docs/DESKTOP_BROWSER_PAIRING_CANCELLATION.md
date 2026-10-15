# Desktop browser pairing cancellation

Browser pairing attempts now check cancellation before request creation, after asynchronous response decoding, after browser opening, and immediately before accepting an approved credential. A canceled start response cannot launch the browser; an approval decoded after cancellation cannot enter credential persistence. Polling, server authorization, session validation and commercial entitlement checks remain required.

The sign-in view owns one browser attempt at a time. Canceling or unmounting aborts that attempt. Its later waiting notification, verification failure or successful identity cannot change the replacement attempt's screen, clear its saved session, or unlock the workspace. Startup/focus credential verification and administrator-key recovery retain their existing separate protections.

## Evidence

`desktopPairingCancellation.test.ts` exercises already-canceled entry, canceled start-response decoding, canceled approval decoding, and a successful approval. `desktopRecoveryView.test.ts` exercises late canceled success, canceled identity failure, and unmount cleanup, alongside existing administrator recovery interactions. Six of these assertions fail against the previous implementation; all pass with the change. Requests and native storage/browser boundaries are simulated, not production acceptance.

## Remaining acceptance gates and limits

Cancellation does not revoke a server challenge/session already approved in the browser. It cannot undo a native secure-store write already in progress when cancellation happens. This change blocks a canceled response before persistence starts and ignores stale UI completions; it does not claim transactional credential storage. Partial secure-store failures, cancellation during storage and simultaneous external credential replacement need a separate guarded persistence design.

A real customer must still complete website authentication and approve browser pairing, return to a signed desktop package, verify identity and commercial/pilot entitlement, cancel/retry a pairing attempt and restart to verify secure-store hydration. Those acceptance gates require the pending production authentication recovery or an explicitly authorized isolated customer environment. No production sessions, records, credentials or infrastructure were changed for this work.
