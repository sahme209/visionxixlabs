# Generic text generation: shared durable admission source follow-on

This is a source-only continuation of the governed Agent admission checkpoint.
It does not authorize production billing, database operations, migrations, model
enablement, streaming, infrastructure changes or deployment. Inert tests are not
proof of actual provider/SQL/customer acceptance.

## Reused authority and API compatibility

`/api/ai/generate` now uses the same existing reservation/claim/capability/usage
kernel as Agent extraction. There is one reserve, one durable legacy or v2 claim,
one possible SDK attempt, and one usage writer. No parallel meter, reservation,
receipt, public skip-accounting flag, or new price catalog is introduced.

The route retains authenticated workspace identity, credit/policy checks,
provider/model approval and input validation, the public idempotency header/key,
correlation headers, success envelope, and reservation/reuse error codes. Missing
authenticated actor identity is explicitly `auth.required`; body-supplied actor
or organization cannot replace the trusted context. A reused hold cannot call
the provider, even if its earlier attempt is uncertain.

Closed server-selected task binding prevents text and extraction admissions from
being interchanged. The existing Agent SHA-256 reservation key domain is unchanged.
The anniversary-v2 classification comes from the existing reservation authority,
never a request flag or a caller-supplied reservation object.

## Safe handoff and singular accounting

The isolated-provider denial occurs after reservation but **before** either claim
or provider handoff. Only this unclaimed denial calls the existing reserved-only
release operation. SDK errors, missing usage or generation identifiers, duplicate
or foreign generations, writer/link failures and unknown commit outcomes cannot
release a claimed hold. `dispatch_unknown` continues consuming capacity after
its original TTL until authoritative reconciliation supplies a safe resolution.

The manager consumes one-use authority before a configured Gateway SDK call.
The shared single-attempt provider path explicitly sets `maxRetries: 0` and uses
the existing validated maximum of 4096 output tokens. Generic system instructions,
temperature and smaller validated output bounds remain supported. The ordinary
manager/provider methods keep their existing behavior and retry settings; this
does not activate direct or alternative providers. The production manager remains
Gateway-only, with its existing service-configuration and policy filters.

Usage is durably recorded before text is returned. The v2 attributed writer is
reused unchanged. Legacy calls use the same existing producer with transactional
unique CREATE plus exact owned-hold linkage; pre-existing generations are refused,
not borrowed from other calls or tenants. There is no route-level second write or
release-on-uncertain post-call cleanup. Actual Gateway cost lookup and bounded
settlement still use the existing reconciler.

## Acceptance limits

The existing 1000-cent default hold and reviewed override range are unchanged.
New TEST Free's 200-cent allowance still refuses that default unless an isolated
test configuration is separately reviewed. A 4096-token output maximum does not
prove model-specific actual/reasoning-cost coverage. Provider cost, real database
serialization, end-to-end payment/account/application behavior and production
readiness remain subject to their existing independent gates.

The separate prepared PostgreSQL fixture follow-on remains preserved on its own
branch; this source change neither executes it nor claims its concurrency cases
have passed. No local SDK, network, database, container, worker or application
server is executed by the inert validation for this change.
