# Current-source production compatibility preparation

**The SQL remains unexecuted.** Preparation used no provider or network access. A later owner-approved sequence stopped after one Vercel metadata call: the reviewed selector could not verify the returned representation. No decrypted detail, Neon or database call occurred; see LIVE-OBSERVED-RESULT.json. That allowance is consumed. The goal's first unresolved release gate remains the November 11 target/schema discrepancy; its cause is not established.

## Why the old query is insufficient for the next review

The current source has 195 Prisma models. The last recorded owner-deployed source `0caaaaab6c809f2188d1a4c8fdd64980e6ef35f0` has 175; twenty platform-only models were subsequently appended. The 120 tracked migration files are unchanged across that source comparison. In particular, **the twenty proposed platform tables have no production migration in this batch**. This is expected local-only preparation, not proof the live tables are absent, and not permission to create them.

The previously executed November 11 query found AuditSeal/AgentGatewayRequest and their two migration rows absent on the recorded Neon target, contradicting the historical owner verification. The private Vercel comparison stopped before reading the database value, so that target's relationship to the running deployment remains unverified. No restore, configuration change or cause is inferred. Historical receipts remain intact.

## Files and exact scope

- `SOURCE-INVENTORY.json`: current schema hash, complete 195 model names, the twenty additions, baseline commit and all 120 migration paths/SHA256 checksums. No credentials, environment values or application data.
- `1-PRECHECK-READ-ONLY.sql`: one catalog/migration-metadata SELECT. It reports all model table-presence/kind mismatches and completed-migration checksum/name/unfinished/duplicate discrepancies. It separately reports missing baseline and proposed-platform tables, so an unapplied platform proposal cannot be confused with restored historical tables.
- Detailed column type/nullability/default-presence, index key/include/validity metadata and constraint key/reference/action metadata cover the twenty proposed tables plus AuditSeal, AgentGatewayRequest and PipelineAICallReservation. Literal defaults, index/check expressions, migration failure logs, application rows, credentials and settings are deliberately excluded. Missing `_prisma_migrations` makes the query fail; do not create it or route around the failure.

Generation was local source inspection only: extract unique plain model declarations, refuse schema/table mappings, compare baseline names, hash each sorted migration file, and substitute those literals into the fixed SELECT. All 195 names and 120 file hashes were rechecked against the saved inventory. Whitespace, single-statement/read-only text screening and preservation checks are not a PostgreSQL parser or execution acceptance. **The SQL has not been executed or database-validated.** No current build/test suite is re-run for this documentation-only preparation.

## Execution gate and interpretation

1. First establish the exact current production target from a separately approved private Vercel/Neon comparison or the owner's inspected settings. A familiar branch name, old receipt or matching `neondb` name is insufficient. Never expose/store the database URL. No new provider/credential read is authorized here.
2. Obtain fresh permission for the exact query/target, bind the file hash, use the agreed finite observation budget and no retry. The owner may run it in the confirmed Neon SQL Editor; connector execution needs its own exact approved scope. Return metadata only. On timeout/error or unexpected output, preserve the result as unverified rather than repeat.
3. Any missing baseline table, checksum/name/unfinished/duplicate mismatch or unexpected relation kind requires review. Matching migration names alone does not prove matching schema. Missing proposed platform tables block their platform workflow/qualification/activation, not automatically every unrelated web-only release; assess actual runtime mounting before selecting a release.
4. Existing platform tables are not automatically accepted: compare their returned shape and provenance with the exact source, current approved migration design and recovery evidence. Do not adopt a pre-existing table just because its name matches.
5. Resolve the earlier two-table discrepancy and current recovery/backup identity before proposing any repair. Prepare separately reviewed pre-check, all-or-nothing apply and read-only verify files only after the required target-specific facts are known. The owner runs approved production writes. Do not apply old build-3 SQL blindly, alter migration history, backfill or manufacture missing records.
6. This screen does not qualify all existing column/index/default/enum semantics, pool/TLS/channel binding, runtime/database roles, recovery availability, source custody, actual Governance, or a production release. Unknown expressions/default semantics require separately scoped review. Complete compatibility/recovery evidence and exact green release source still precede the owner's deploy click.

No production migration, feature enablement, apply script or deployment is included. Existing platform defaults and native qualification gates remain closed. Keep genuine reviewer decisions and the already-written ServiceNow unknown attempt unchanged.
