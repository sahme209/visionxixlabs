# Agent keyboard recovery repair

Frozen source repair from c47d13bd, pending independent review. A real rendered Agent regression first queues a follow-up while sending, cancels the response, waits for recovery, then presses Enter with a new draft while Queue message is disabled. Behavioral RED clears the draft incorrectly; GREEN retains it and the original queue without another message attempt.

The exact existing button predicate is shared with submitDraft. Existing transport, queue pause, recovery, draft retention, IME handling and execution authority boundaries remain in place. Scoped Agent streaming and Bot composer tests: 37 passed. Scoped TypeScript: exit 0. Full suite/build excluded by explicit scope. No browser, app, native, session, provider, database, credentials, helper Security, install or network interactions performed. HTTP and native test peers are in-memory synthetic fixtures; this is not native runtime acceptance.

Raw logs, exit codes, test/type runners, kernel sandbox, configs and SHA256 provenance are retained here. Failed import/setup attempts are infrastructure evidence, not behavioral RED. Root dependency cache and canonical desktop cache are read-only under the sandbox; writes use this isolated worktree and owned temporary evidence directory. No push or integration authorized by this slice.
