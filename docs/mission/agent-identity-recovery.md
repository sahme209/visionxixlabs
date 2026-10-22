# Agent identity storage recovery — proposal only

Owner's failed enablement is correlated with a P2021 missing-table error for WorkspaceAgentIdentity on the serving deployment's AI-governance route. A single scoped runtime query provided this evidence; raw logs were not persisted. This establishes the immediate storage failure, not the complete state of the migration ledger or database binding.

Local code now distinguishes absent configuration from unavailable storage, disables unusable identity controls, returns bounded errors, and reports a possibly saved identity when its audit fails. This code is not deployed. Origin, owner authorization, tool validation and execution approvals are preserved.

## Exact proposed database change

File: `ops/recovery/20261022_agent_identity_schema_only.sql`

SHA256: `c8eda796cabeefd2c3e697ed89c5e1f5a1fd13d3db5c4042d1c11ec48f048fdf`

The transaction creates only the original identity table structure, initially empty. It refuses an existing table, unexpected baseline, changed migration checksum, absent/ambiguous failed migration or completed migration. Five-second lock and thirty-second statement limits apply. It does not enable any identity, grant tools, insert organization rows, change credentials or modify migration history.

The historical `20261013172000_add_workspace_agent_identity` migration also enables existing organizations with a broad tool allowlist. Do not execute that backfill as an incidental repair. Preserve its file and history. The schema-only proposal intentionally leaves the failed ledger unresolved: do not mark the entire original migration applied while omitting its data operation. A separately reviewed migration-resolution strategy remains necessary before normal future migration deployment. The existing production-db-migrate workflow deploys all pending migrations and can resolve failed attempts; it is unsuitable for this bounded repair and must not be dispatched for it.

## Preconditions before any execution

1. Privately verify the serving deployment's effective database binding against the intended Neon branch/database. Matching project names or schema alone is insufficient. Do not expose connection strings.
2. Read only the exact migration name/checksum/finished/rolled-back fields and expected table metadata. Confirm the script's preconditions against current state; historical recovery evidence is insufficient.
3. Verify an actually usable recovery timestamp and current history window; retain a protected recovery record.
4. Rehearse on an authorized disposable database with the matching schema and failed-ledger state. Verify an empty table, disabled default, no organization backfill, precondition refusal and transactional rollback. This rehearsal has not run; the existing local PostgreSQL environment blocker remains.
5. Obtain explicit approval for this exact SQL hash on the verified target. Never run a generic migration deployment or resolve the failed ledger as part of this approval.
6. After execution, verify metadata and empty identity state. The owner then explicitly chooses identity/tool permissions through the existing audited UI. Model approval, credits, billing and deployment execution remain separate.

Before commit, failure must roll the transaction back. After a successful commit, preserve the additive table and any newly saved policies; do not drop it to undo the release. Code rollback and an owner-reviewed identity disablement are separate from destructive database recovery. No database action in this document has been executed.
