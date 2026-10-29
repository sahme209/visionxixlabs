# Public billing fulfillment implementation plan

Goal: finish the approved payment-to-access path from ebb48031; do not alter pricing, VisaNova, supporter payments or existing customers.
Architecture: extend the approved recurring-intent and public-anniversary designs with durable production storage. Stripe events trigger current-state retrieval; only verified collected invoices grant seat-scaled monthly credits. All public readers/admission share that authority. Preserve the isolated TEST implementation.
Tech: existing Next.js, TypeScript, Stripe (pinned API 2024-06-20), PostgreSQL/Prisma, Vitest, existing PGlite rehearsal.
Spec: RECURRING_SUBSCRIPTION_INTENT_DESIGN.md; mission/production-public-billing-readiness.json; publicSubscriptionAllowance.ts.

Global constraints: Free 200c/org/UTC month, 2 seats, 10 deployments; Pro 2900c/seat/month or 27840c/seat/year, 1000c/seat/month, 100 deployments; Enterprise 7900c/seat/month or 75840c/seat/year, 3000c/seat/month, 500 deployments. Paid credit windows use monthly anniversaries even for annual payments. Preserve original Free spending and purchased-credit attribution. No live customer test charge, no hidden plan migration, no secret logging, no automatic production migrations.

Review focus: duplicate clicks and response loss; forged/mismatched/late webhook receipts; expiry and refund while holds are pending; original Free bucket versus first paid bucket; fail-closed public-plan reads without changing legacy subscribers.

- [x] Verify current subscription/invoice/payment evidence (publicSubscriptionEvidence.ts): red tests for active-but-unpaid, wrong account/mode/price/seats, refunds/disputes, stale invoice and cancellation; implement only existing approved terms.
- [x] Durable purchase intent and original create receipt: SQL constraints, serializable organization fence, stable provider key, no redispatch after ambiguous outcome; readback/reconciliation rather than new purchase on retry.
- [x] Versioned public contract and invoice ledger: canonical snapshot retrieval, replay fencing and immutable collection evidence; signed webhook -> transaction -> plan/credits.
- [x] Public credit authority: lock enrollment and purchases; immutable hold attribution; retain unknown holds; reads, admission, dispatch and settlement agree; preserve original calendar Free bucket and annual monthly resets.
- [x] Mount canonical checkout/webhook and public entitlement/seat/deployment readers. Keep checkout flag off through verification; signature/mode/ownership checks first.
- [x] Run connected local PostgreSQL/schema fixtures and route tests, then project tests, TypeScript/lint/build. Separate fixture results from hosted Stripe TEST acceptance.
- [x] Review exact schema/migration and rollback; verify current target/recovery before any authorized production application.
- [ ] Activate catalog/webhook/checkout only after payment-to-access acceptance; push/deploy exact validated source and verify live state. Do not label an untested installer as published.

Initial source audit (superseded by implementation below): legacy planForStripeTier grants 2500/20000/500000 cents; public allowances are arithmetic candidates only; subscription Checkout has no durable org purchase fence; invoice.paid has no public fulfillment handler; public seat/deployment/readback mounting is incomplete. Baseline: 87 selected existing tests passed on Node24.21.0.


## Final implementation checkpoint — 2026-10-22

Implemented the separate opt-in public contract, immutable invoice/checkout evidence,
organization purchase fence, original SDK receipt, one-attempt checkout, canonical
subscription collection verification, paid-seat anniversary allowances, Free and
purchased-credit attribution, hard-stop reservations, and consistent seats/deployment/
account readback. Existing legacy and VisaNova/supporter billing remain separate.
Webhook processing remains available if new sales are paused. The legacy duplicate
subscription receiver refuses the new public lane. Unsupported portal plan/seat
updates are disabled; cancellation is at period end.

Fresh validation: 9,415 passed / 0 failed / 35 explicitly skipped. This includes
15 actual isolated PostgreSQL/WASM tests and 3 connected HTTP/signature/store/readback
cases. Root and desktop TypeScript, changed-source lint and diff checks passed.
Hosted Chrome Stripe TEST payment purchased two Pro seats ($58 TEST), granted $20
AI allowance once, ignored replay and revoked allowance after a real TEST refund.
Authentication, account identity, event transport and database for that paid journey
remain isolated/fixture boundaries, not live customer acceptance.

Applied only the reviewed additive six-table public-billing schema to the verified
production database under bounded locks/transaction. Five immutable/revision guards
present; all new tables empty; two legacy billing rows and one unresolved Prisma
migration record unchanged. Snapshot snap-falling-wildflower-aif6heir retained; actual
Neon restore remains unproven. No blanket migrations or backfills. Dedicated live
portal configuration bpc_1UTN9wFet66ERY29IlY5XbRH restricts customer changes to safe
invoice/payment-method management and period-end cancellation.

Release gate: exact source build, configured production policy/account/portal binding,
Axiom-only live catalog and dedicated signed webhook activation, staged deployment
verification, then normal promotion and live smoke checks. No installer publication.
Before any rollback, pause new sales and inspect public enrollment/contracts. After
any new contract exists, do not revert to code lacking public attribution/fulfillment;
retain reconciliation and use a forward repair. Never drop immutable billing evidence.

Original source and local work remain preserved in their separate worktree.

Final local production build passed without credentials or migration side effects. Root/desktop TypeScript, changed-source lint and 9,415 tests (35 opt-in skipped) passed on the release tree. Original source worktree remains untouched. Sales/catalog/webhook activation and actual production promotion still pending at this source checkpoint.
