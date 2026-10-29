# Read-only decision refresh

A real external recovery was verified remotely, but the native window retained its pending card until the conversation was reopened. The automatic focus/visibility/15-second reconciliation suppresses hidden-window reads. Its exact cancel/replacement/external-review sequence passes locally; the live stale observation does not establish a broken backend or a reproducible automatic-transition defect.

Pending proposals now expose Refresh decision as a direct recovery path. It invokes the same ownership-guarded read and never sends inference or executes an action. In-flight reads are coalesced. A failed, wrong-conversation or absent decision retains the pending state and offers retry. Verified terminal decisions reload canonical turns and receipts, pause queued work, and preserve draft and usage. Credential, conversation and decision changes invalidate late results.

Two new manual refresh tests failed before the control existed, then passed. The repeated proposal sequence and coalescing/late-credential cases cover the surrounding behavior. These are component tests, not new live provider acceptance. No additional paid inference is authorized or necessary for this change.
