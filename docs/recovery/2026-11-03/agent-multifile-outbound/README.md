# Local Agent multi-file physical-effect protocol

Base 2d113a53, isolated branch codex/agent-multifile-outbound-ledger. User approved the exact local design (call_297fb4478f914f58ab0352bccecc97bc item 1). This is source implementation, not live qualification or production enablement.

## Result

The actual requester coordinator now reserves the original real claimed operation's parent exposure before token resolution, then records one immutable execution-time parent commit/tree after all exact reviewed base-blob checks. Each of 2–20 files creates a blob, then one tree, one commit and one non-force ref update: exactly 5–23 physical effects. Every server-derived child has a strict versioned durable record tied to the original private claim/attempt, scope, source, current installation, parent/tree and all prior validated receipts. Each owns a separate canonical drain reservation and one submission intent immediately before its sole fixed write. No provider I/O runs under database locks.

Only method/path/body digest and binding metadata are duplicated in the child record; file bytes remain in the original reviewed proposal. The adapter reconstructs expected bytes/dependencies from that proposal and validated prior receipts. The final synchronous transport callback rehashes its live descriptor and enforces the current private freshness/signal. Blob/tree/commit and exact final ref SHA receipts must commit before the next dependency. The original parent reserved slot and every confirmed child's exact canonical submission-intent history are revalidated under org-first locking, including before recording a receipt and before completion. These receipts never mark a slot quiescent.

Any lost reply, changed authority, missing or tampered history, failed receipt acknowledgment or abort stops continuation. Existing attempts remain consumed and restart cannot recreate children or resend. The existing force:false semantics are preserved; no new original-parent compare-and-swap, reviewed immutable branch-head or universal branch movement guarantee is claimed. Earlier branch/PR/single-file contracts and old histories are preserved. Legacy alternate writers are not qualified by this adapter.

## Exact verification

- Genuine integrated RED: actual first fixed POST logged child count `[0]`; original behavior reached the physical write without a child record. Retained explicit log, fixture ki6zco9u stopped. A preliminary baseline RED was less explicit and is not the causal evidence.
- First actual vertical GREEN: two files, five ordered child reservations/receipts and one original attempt; fixture rmyjkti7 stopped. This established the complete source-to-transport path before a failure matrix.
- Reviewer found missing canonical parent/child-slot history validation. Actual owned PostgreSQL RED: deleting either exact fixture slot still allowed five writes instead of one (two failures). Correction reuses the original canonical slot history validator in the existing transaction, not a new authority grant.
- Corrected slot-integrity GREEN: **3 passed / 35 filtered**, including two deletion negatives and the integrated vertical; fixture 67u3kc92 stopped.
- Final risk matrix: **11 passed / 29 filtered**: lost response at each of five effects, reviewer/connection revocation, injected lost acknowledgment after an actual child-receipt commit, actual canonical-negative, 20-file/23-effect positive bound, and tampered canonical child history. Fixture lrbg_zp5 stopped.
- Final integration/regressions: **7 passed / 34 filtered**: vertical with exact request payload assertions, abort after durable intent but before physical write, three existing single-file cases and two branch/PR positives. Fixture 3lgzdf63 stopped.
- These are separate actual PostgreSQL runs with overlapping vertical coverage, not one 21-test suite. External provider, auth/human decision and positive issuer are simulated. Real SQL/private claims/history/CAS/locks/slots/intent and canonical-negative execute the actual implementation.
- Final affected non-PostgreSQL regression batch: **112 passed**, four files (drain store, existing GitHub adapter, fixed transport, requester coordinator). Scoped production-source TypeScript terminal exit 0; exact inputs/log retained. No full build rerun.
- Independent scoped review: PASS after the canonical association correction; no remaining important finding. No additional reviewer test rerun.

Owned runner usage `--help` unexpectedly created and safely stopped one usage-only fixture b4867jhw; no test result from it is counted. No fixture/process remains active.

## Limits

Canonical issuer remains unavailable and coverage remains empty. Current runtime refuses before consuming approval or minting credentials. The separately approved native experiment failed retained-file-descriptor confinement and remains unqualified; these tests do not amend it. No live provider actions, credentials, grants, customer reads, schema changes, activation, deployment, paid CI, token-lifetime proof, fleet proof, slot clearing or automatic retry occurred. Complete Governance and enrollment remain unavailable.
