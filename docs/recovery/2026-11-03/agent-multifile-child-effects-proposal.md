# Proposed Agent multi-file outbound decomposition — local review required

Status: design only, not implementation or authority. Existing `commit_github_files` performs N blob POSTs, one tree POST, one commit POST and one ref PATCH (N+3 writes). A single once-only outbound slot cannot truthfully authorize all of these submissions.

## Exact proposed change

Retain the existing independently approved proposal, real parent claim, current requester/reviewer membership, installation, policy, path/content/message and reviewed per-file base-blob checks. Add a bounded durable child-effect ledger owned by that exact parent operation and private attempt. The server derives phase/index child keys; a request cannot choose arbitrary IDs, skip phases, or provide an authoritative digest. Each child binds its parent claim, previous child receipts, exact fixed method/path/body digest and current issuer/connection. Each child reserves before consequential credential use and consumes one submission intent immediately before its sole physical fetch. No network call runs under the database locks.

Preserve the existing Agent limit of 2–20 reviewed files, therefore 5–23 physical effects. Reuse the existing durable workflow/event storage with a new strict versioned child kind and immutable parent/phase/index binding; no schema migration or reinterpretation of old parent rows. Bound per-parent child/history reads and reject overflow, missing phases and malformed history.

Persist bounded validated blob/tree/commit SHA receipts before allowing dependent phases. An ambiguous submission or lost result prevents continuation to the next effect and prevents replay. On restart the parent and child history remain consumed; no automatic blob recreation, ref replay, descendant retry chain or cleanup deletion is permitted. A caller cannot substitute an old child receipt, another parent's effect, changed bytes or changed connection.

Current reviews bind file base snapshots, not an immutable shared parent commit/tree. The proposed implementation must explicitly preserve that existing review meaning: acquire one execution-time parent commit/tree, record it immutably before child effects, validate every reviewed blob against it, and refuse mismatches. It must not claim that review approved an immutable parent commit, that `force:false` is an exact original-parent compare-and-swap, or that branch-head movement is universally prevented. A stronger reviewed parent/tree contract is a separate design change.

## Validation before implementation

Review the new parent/child authority decomposition and persisted receipt semantics. Then test actual isolated PostgreSQL with simulated issuer/auth/provider: exact N+3 children, object order, duplicate reservation, concurrent attempt, role/connection revocation, every dependency substitution, lost acknowledgment at each effect, abort before final fetch, and restart with unknown child. Existing single-file/branch/PR paths must remain independent. Coverage, canonical issuer qualification and activation stay unavailable; successful mock transport cannot qualify native confinement or real token lifetime.

No deployment, live provider action, credential mint, grant, schema migration, paid CI or production activation is authorized by this document.
