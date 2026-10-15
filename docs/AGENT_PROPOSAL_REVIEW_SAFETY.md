# Agent file proposal review safety

File-write proposals capture tenant-scoped GitHub content and blob SHA on the
server before approval. Model-supplied `_review` data is discarded during
proposal preparation. The proposal digest binds the stored arguments to the
workspace, conversation, proposer and tool; approval also checks expiry,
separation of duties and an atomic claim.

Single-file approval execution requires a valid review snapshot before token
resolution or provider calls. Missing or malformed evidence returns
`file_review_required`; an old proposal without evidence must be regenerated
and reviewed. Execution must never substitute a fresh unreviewed SHA.

For an existing file, its reviewed blob SHA is passed to the write client for
comparison against current content. For a reviewed new file, an explicit null
SHA requires that the path still be absent. Both paths retain the default-branch
write restriction. Multi-file commits keep their existing per-file snapshots
and atomic commit behavior.

This boundary prevents omitted review evidence from bypassing the existing
version comparison. It does not establish a live GitHub acceptance result or
remove every race at the provider boundary. No credentials, production records,
deployment, billing policy or database schema are changed by this repair.

Approval also rechecks the workspace Agent identity before claiming the proposal:
missing/disabled identity, a removed tool, or an unavailable policy store blocks
execution. Rejection remains available without Agent permission. This check is
a current read before the claim; it does not claim an atomic lock against a
policy change that races with an already claimed external operation.
