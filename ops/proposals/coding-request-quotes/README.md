# Future additive quote-schema draft — NOT applied

This finishes a small release-preparation gap for the locally approved quote mechanism. The SQL adds exactly the two fields already defined in `prisma/schema.prisma`: required `admissionContract` defaulting to `coding_fixed_hold_v1`, and nullable JSONB `quoteEvidence`. It changes no existing financial amounts or statuses and contains no data backfill, migration-history write, deletion or grant.

The draft is deliberately outside `prisma/migrations`. Existing/partial quote columns refuse instead of being silently accepted. A transaction, bounded lock/statement timeouts and a fixed-hold/null-evidence postcondition are included. These guards do not verify production target identity, backups, deployment compatibility or actual row preservation.

The draft has now passed one fresh owned populated-old-schema rehearsal: five synthetic ledger rows and matching hold/usage records were unchanged; both new fields had their expected defaults. [Evidence](../../../docs/recovery/2026-11-04/quote-schema-rehearsal/README.md). THIS IS NOT PRODUCTION AUTHORIZATION or complete cutover acceptance. Do not apply it to any existing database without separate authorization.

Before any future production request: extend local coverage for realistic concurrency and cutover conditions; review exact target/schema/lock state and a currently recoverable backup; bind the generated client and exact application build to the schema; preserve old migration failures; define safe writer/cutover and rollback handling. Once quoted rows exist, older code must not be assumed financially compatible. Never drop the evidence columns or rewrite history as a rollback shortcut.

Schema application is not quote activation. The real pricing reader, estimator/output/billable qualification, genuine approvals and separately authorized rollout remain independent gates. No live pricing, AI call, production database operation, push or deployment occurred while preparing this draft.
