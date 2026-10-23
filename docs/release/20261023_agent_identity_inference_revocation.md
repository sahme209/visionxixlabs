# Agent identity revocation before new inference

A complete local Agent/credit-chain acceptance found a governance gap: the loop reread Agent identity before tools, but could start another paid decision after the owner disabled the identity during a read-only tool. An actual-Prisma/PostgreSQL regression reproduced two SDK calls and a final answer instead of stopping after the first accounted call.

The loop now rereads identity before starting every decision or accounted JSON repair admission. Disabled identity, unavailable identity storage or removal of an initially advertised scoped tool returns an existing terminal policy error. Newly granted tools cannot expand the original prompt/profile ceiling. Existing provider/model/credit checks, tool-time rereads and abort handling remain in place. Prior accounted usage stays attached to the refusal; policy refusal does not purchase a JSON repair.

This checks authority before starting admission. It does not make that identity read atomic with every subsequent billing/provider await, undo already-started work, or promise instantaneous cancellation of an in-flight provider request.

## Verification

- Real PostgreSQL regression failed before the fix in both streaming and non-streaming paths.
- Eight actual-Prisma cases pass through the real decision loop, credit admission, provider manager and installed SDK: two full two-step/settlement cases, four identity-disable/tool-removal cases, and two revocation-during-malformed-response cases that refuse a paid JSON repair.
- In the full cases, two100-cent holds become pending; a further task is denied before another SDK call. Explicitly synthetic authoritative-cost receipts settle each event once, leaving used4c/held0c/remaining196c of the synthetic200c allowance. These costs are test values, not observed provider charges.
- Four everyday unit regressions plus115 affected cases pass. Final full suite: 9,940 passed, zero failed, 81 skipped; all eight opt-in PostgreSQL cases passed separately. Root typecheck and production build passed.
- Independent review found no actionable blocker in the code or owned fixture.

The SDK transport uses a fixed .invalid URL with an in-process response function and no network branch. Catalog/pricing/cost receipts and tool observations are synthetic; policy, Free enrollment, reservation, dispatch claim, usage linking, settlement and replay use actual application code and PostgreSQL. No production backup, production/customer identity, real authentication, provider inference, Stripe operation or cloud action is used. This is not a replacement for the pending real native Agent task.

## Reproduce

With local PostgreSQL17, Node24 and repository packages installed:

```sh
python3 scripts/test-agent-credit-postgres.py \
  --output-dir /absolute/private/test-output \
  --pg-bin-dir /absolute/path/to/postgresql17/bin \
  --node /absolute/path/to/node24
```

An optional --pg-control-bin-dir supports separately signed local initdb/pg_ctl binaries. The runner initializes its own empty Unix-socket-only cluster, verifies the binding, prepares the schema only there, runs the actual tests and stops/removes that owned cluster. It accepts no external database URL or provider credential. Private output must be owner-only. A failed stop retains the cluster files for recovery. No blanket schema synchronization against production or a production restore is appropriate.
