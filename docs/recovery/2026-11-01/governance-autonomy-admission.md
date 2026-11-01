# Governance numeric execution ceiling — local evidence

## Implemented core correction

The admission kernel delegated numeric limits to `policyEngine`, whose legacy
ceiling recognizes only `apply`, `execute` and `auto_apply`. None of the actual
Governance mutation vocabulary uses those names. Consequently an otherwise
valid `repository.merge` at numeric level 0 was allowed by an allow baseline,
and an exact independent human approval could also permit it.

`admission.ts` now has an exhaustive, typed action-to-minimum-level table.
`discovery.read` remains available at level 0; `recommendation.create` requires
level 1; every current mutation requires level 4. Levels 0–3 cannot execute even
with an exact independent approval. Level 5 does not remove required human
approval, provider/platform authority, evidence, rollback or block rules.
Adding a new action requires an explicit table entry at compile time.
This changes admission evaluation only. No production issuer or authority source
has been invented, and no scope or executor coverage has been registered.

## Verification

The initial new regression run failed 11 of 14 tests: recommendation at level 0
and every mutation at level 0 were incorrectly allowed. After correction:

- New 14-check kernel suite passes; its vocabulary matrix exercises all 12
  actions, all six numeric levels, both allow and require-approval baselines,
  with otherwise exact independent approval (144 matrix decisions).
- Scoped production TypeScript for the edited admission module and dependencies
  passes. A broader existing final-coverage configuration was stopped after
  remaining idle for over two minutes; no broader type-check pass is claimed.
  `git diff --check` passes.
- Two request-admission checks verify low authority before claim and lowered
  authority after claim refuse despite a still-current exact approval.
- Full local Intelligence suite: 180 passed, 16 database-dependent skipped
  across 32 passing and four skipped files. Skips are not real-store acceptance.

All sources, authority and approvals in these new tests are fixtures. No provider
request, real claim, database mutation, deployment, human review or setting change
occurred. This is not full enforcement, enrollment or live acceptance.

## Initially identified root dependency: reviewed persistent execution authority

Inspection found no persisted numeric Governance autonomy issuer. The pure
`defaultAutonomyFor` and `evaluateAutonomyChange` functions have no production
consumers. `TenantAutonomyCharter.mode` controls a different scheduling charter;
it must not be converted into execution permission. Workflow rows stamped
`autonomyLevel: observe` are lifecycle metadata, not tenant authority either.
The default request service still deliberately lacks verified coverage and its
activation method refuses. The execution HTTP coordinator still needs a real
server-created admission composition. An unmounted callback accepting fabricated
Boolean facts would not complete that work.

The following records the initial design proposed for review. The user later
approved its local persistence implementation; see
[execution-policy persistence evidence](governance-execution-policy-persistence.md).
Actual merge composition, coverage and customer workflow remain open.

1. Reuse `DurableAgentWorkflow` plus its event history for separately typed,
   immutable execution-policy revision and exact-scope active-pointer records.
   A new JSON contract can avoid schema changes, but introducing this permission
   is a new product capability requiring review before implementation. Bind
   organization, exact scope, numeric level, explicit permitted action classes,
   applicable safeguards, parent active revision, requester, expiry, revision
   digest and unique request nonce. No absent/malformed record grants authority;
   no scheduling-charter import or inferred default may authorize mutation.
2. Proposal uses current paired policy-management authority. Independent review
   excludes proposer/requester/executor conflicts and requires current review
   capabilities/session. Review binds the entire immutable digest. Activation
   requires explicit current administration authority and expected pointer
   version/parent, checked with CAS inside the transaction. Idempotent request
   recovery returns only the exact previously saved result. Revocation and
   replacement append audit history and preserve consumed execution outcomes.
3. A DB-only current-authority reader verifies exact organization/scope/action,
   digest/history, activation/revocation/expiry, current recorded principals,
   parent/version consistency and maximum numeric level; it returns the stored
   limits, never a hardcoded execution level. Repeat at claim and final transport.
   A baseline/action-approval/policy revision change must invalidate the original
   private receipt rather than silently adopt a new decision mid-operation.
4. Compose merge admission from the prepared operation and current stored release
   using the existing binding reader. Reuse actual `readGovernanceProviderApproval`
   with exact baseline and operation ID, including consumed-for-this-operation
   readback. Warm active source proof outside locks, then recheck the exact source
   receipt/baseline under existing locked authority. Preserve membership/session,
   provider purpose, independent review and one-attempt consumption.
5. Derive provider/platform facts from current installation authorization, exact
   repository/token constraints and existing direct-merge policy checks. A
   provider approval alone does not prove provider access. Retain transport's
   fresh credential, branch policy and exact head checks. No network under DB
   locks. No available proof of merge rollback should mean `rollbackVerified`
   remains false, so a policy requiring rollback refuses rather than inventing
   evidence. Source freshness alone must not stand in for action verification.
6. Register only audited exact mutation entry points in a closed server-owned
   coverage manifest. Keep enrollment refusal until every required executor has
   both phases and tested revocation/transition behavior. Then wire actual HTTP
   coordinator selection through scope-aware admission; positive absence alone
   may use its existing legacy checks. No feature-flag disable, unknown metadata,
   changed principal or incomplete authority may fall back to legacy execution.
7. Before activation capability: isolated real-store proposal/review/CAS/revoke/
   recovery and claim/transport journeys with simulated providers; independent
   review; production/frontend/native checks. Actual source reads, genuine human
   decisions and production activation remain separately authorized operations.

These dependencies explain why the evaluator correction alone cannot
truthfully complete real execution or enrollment. Existing coverage and enrollment
refusals remain intact.
