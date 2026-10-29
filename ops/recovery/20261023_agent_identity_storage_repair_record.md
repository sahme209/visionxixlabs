# Agent identity storage repair execution record

2026-10-23: production project `odd-union-57413470`, branch `br-holy-voice-ai303o8m`, endpoint `ep-small-mountain-ailw0kvt`, database `neondb`.

The user had explicitly authorized production database/Agent repair. When asked about a shared paid-plan upgrade, the user delegated judgment. The upgrade was avoided; no existing branch or snapshot was deleted.

A private SSL/read-only PostgreSQL17.11 custom logical backup of the actual source database was created and retained with restricted permissions on a FileVault-protected Mac. Backup SHA256: `e93fcdd9b6e9cf6fe8d8ca0ca8897d6c48abe237f15672acc0c795bb0d7655d1`. Credentials and backup/customer contents are excluded from this repository and public evidence.

The dump restored on an owned Unix-socket-only PG17 instance. Restore omitted application of owner/ACL/publication/subscription metadata. This does not verify Neon snapshot/PITR or full infrastructure recovery. The exact schema-only SQL passed; full-row fingerprints for all 133 existing public tables remained unchanged, the new table was empty with disabled/no-tools defaults, the historical migration remained unresolved, and repeat execution was refused. The owned restored cluster was stopped and removed. Independent review accepted this rehearsal for the narrow additive repair and identified production role/ACL/concurrency checks, which were completed separately.

After fresh source/role/default-ACL/concurrency and migration precondition checks, the fixed operations from `20261022_agent_identity_schema_only.sql` were applied atomically through the provider transaction API. SQL SHA256: `c8eda796cabeefd2c3e697ed89c5e1f5a1fd13d3db5c4042d1c11ec48f048fdf`. The single-query API initially rejected the multi-command script at parse time; it did not partially execute it.

Post-commit verification: identity table present, zero rows, defaults false/empty tools, expected application ownership/default ACL, application-owner access available, original failed migration unchanged. The authenticated serving-runtime diagnostic observed the table, and the cockpit loaded Agent controls with Disabled status and no storage error.

**Operational hold:** the historical `20261013172000_add_workspace_agent_identity` migration remains unresolved. Do not run its broad enabling/tool-grant backfill, replay the schema-only proposal, or falsely mark omitted work complete. Generic migration deployment remains blocked pending an explicit migration-history convergence strategy. This record is storage recovery, not complete migration-ledger recovery.

No Agent identity, model, or tool was enabled and no inference was sent during the repair. A separate minimal live-test permission request was presented for `list_environments` only, Observe and recommend, and one desktop task using the existing allowance. Its approval is not implied by this record.
