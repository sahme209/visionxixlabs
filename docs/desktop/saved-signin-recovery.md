# Explicit saved sign-in recovery

If startup or focus verification cannot reach the workspace service, the desktop
locks operational transport and retains the saved vault credential. The mounted
sign-in screen offers **Retry saved sign-in** for that unavailable result. Each
click makes one attempt; focus does not automatically reload a locked credential.
Browser sign-in, account creation and administrator recovery remain available.
A pending attempt can be canceled before choosing another sign-in method.

The existing access verification boundary classifies failures without parsing
error text: network/service unavailable, credential rejected, invalid response,
or canceled attempt. It returns fixed messages rather than raw response or
transport errors. Rejected or malformed credentials do not offer saved retry.
Explicit retry never writes or deletes the vault. It shares startup's selected
credential reader, including signed-out tombstones, missing/expired selected
credential refusal and the existing legacy precedence for installations without
an explicit selection. It never chooses an inactive credential as recovery.

The retry verifies a candidate while transport remains locked. Before activation
it checks cancellation, the current config/revision and local selection generation,
then re-reads and compares the durable selection snapshot. A changed selection,
expiry, sign-out, newer sign-in, service context change or unmount prevents stale
activation. Snapshot comparisons stay in memory; no credentials are logged.
Successful verification still routes denied entitlement to the access-required
screen. Identity verification does not create commercial entitlement.

Acceptance uses the actual mounted App and sign-in view with mocked vault and
transport, stubbing authenticated feature children. It covers unavailable recovery,
rejection/malformed denial, late vault reads, changed durable snapshots, context
replacement, cancellation followed by browser choice, unmount and explicit
sign-out. It does not prove OS vault persistence, native browser handling,
production authentication, customer access, or real provider acceptance.
