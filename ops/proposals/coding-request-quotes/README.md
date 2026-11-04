# Future additive quote-schema draft — NOT applied

This finishes a small release-preparation gap for the locally approved quote mechanism. The SQL adds exactly the two fields already defined in `prisma/schema.prisma`: required `admissionContract` defaulting to `coding_fixed_hold_v1`, and nullable JSONB `quoteEvidence`. It changes no existing financial amounts or statuses and contains no data backfill, migration-history write, deletion or grant.

The draft is deliberately outside `prisma/migrations`. Existing/partial quote columns refuse instead of being silently accepted. A transaction, bounded lock/statement timeouts and a fixed-hold/null-evidence postcondition are included. These guards do not verify production target identity, backups, deployment compatibility or actual row preservation.

Only source/schema consistency was checked. THIS SQL HAS NOT BEEN EXECUTED OR DATABASE-REHEARSED. The earlier owned PostgreSQL tests created the full updated schema; they do not prove this old-populated-schema→new-schema cutover. Do not apply this draft to any existing database without separate authorization.

Before any future production request: rehearse the draft against a fresh owned populated old-schema fixture; prove existing financial rows unchanged; review exact target/schema/lock state and a currently recoverable backup; bind the generated client and exact application build to the schema; preserve old migration failures; define safe writer/cutover and rollback handling. Once quoted rows exist, older code must not be assumed financially compatible. Never drop the evidence columns or rewrite history as a rollback shortcut.

Schema application is not quote activation. The real pricing reader, estimator/output/billable qualification, genuine approvals and separately authorized rollout remain independent gates. No live pricing, AI call, production database operation, push or deployment occurred while preparing this draft.
