# Fresh reviewed ServiceNow attempt after a proved pre-write refusal

The original b38 note action is permanently retained as refused/version8/attempt1/providerWritePerformedfalse. It must never be reset, amended or replayed. Its corrected proof resource does not itself authorize another attempt.

Proposed local recovery: expose an exact read-only journal-access/absence check for the already bound original note. A fresh child plan may then reference the refused parent, its immutable version/digests and the same intended note. Require current administrator access, current original ticket/deployment/native metadata, a new independent human approval and explicit requester authorization. Keep one durable attempt per child, no automatic retry, and recheck exact parent-note absence immediately before the single write. If the parent is unknown/dispatching/confirmed, has any possible write, changes, or the note exists, refuse. Preserve the parent marker to prevent duplicate logical evidence and bind the child ledger to it; do not accept a different note as a retry.

Do not bypass ServiceNow's New-state approval lifecycle. Closure remains a separate independently reviewed action under an administrator-declared native terminal policy. No new credentials, grants, Table API, database schema, recovery SQL or historical edits.

Approval requested: LOCAL implementation/tests only for this recovery boundary. Deployment, fresh provider write and human decisions remain separate. Final package must cover expired/revoked authority, parent races, preexisting note, missing proof, consumed child, no resend after uncertainty and native lifecycle restrictions.
