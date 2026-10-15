# AI usage settlement binding

A persisted reservation must match the current reconciled usage event before
Stripe submission: organization, usage event and exact billed cents. Previously,
an existing reservation was returned from the transaction and its amount and
organization were trusted without comparing them with the selected usage event.

Four regression cases reproduced submission for another organization, another
usage event, a larger amount and a smaller amount. A pure binding predicate now
blocks those cases before the Stripe call. The batch reports the row blocked
and retains its reservation and idempotency key for reconciliation; existing
ledger rows and quota reservations are unchanged.

The valid retry path still uses the original amount and key within the existing
conservative retry window. Expired/unknown/failed outcomes remain held, submitted
rows remain excluded, and disabled or live-mode billing is rejected before
repository access. Pricing, cost reconciliation and the 1.5x kernel are unchanged.

Evidence: `lib/billing/__tests__/settleAIUsageToStripe.test.ts` exercises the real
worker with a mocked Stripe boundary and verifies zero invoice/ledger writes
for all four mismatches. Existing retry/unknown-outcome/test-mode cases still
pass. This is boundary evidence, not a completed customer/provider billing trial.
No migration, production data repair or live billing activation is involved.

Next: inspect actual approved test-tenant receipts and ledger consistency before
any billing rollout. Contradictory historical records require reviewed
reconciliation. Batch fairness for held/disabled rows remains open.
