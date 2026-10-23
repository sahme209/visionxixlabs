# Authenticated approval voter identity

## Problem and resulting behavior

The v1 pipeline vote route trusted a client-supplied approverUserId. A single API key could submit two different labels and satisfy a two-vote quorum. Regression tests reproduced both impersonation and the second-vote transition before the fix.

The v1 route now derives its voter identity only from the authenticated API key. Legacy request bodies remain accepted, but actor labels are ignored. Distinct keys are machine principals, not proof of distinct humans. This change does not establish a two-person policy across multiple keys held by one person.

Both machine and session vote routes use a shared database transaction. A per-approval advisory lock serializes rereading votes, inserting one durable vote and updating the terminal snapshot. A failed terminal update rolls back the new vote. Existing database uniqueness still prevents duplicate votes by one principal.

Both authenticated writers assign a new boundvote_v1_UUID database ID. Prior writers generated cuid IDs and did not accept a decision ID from callers. The new format is an application-assigned provenance marker, not a credential. Pending approvals containing any legacy decision refuse further votes until replaced through an authorized approval flow. Historical rows are neither relabelled nor deleted. Positive-quorum approvals also require bound durable votes before a new execution; prior completed execution history is preserved.

Session vote and execution routes now require same-origin requests and the existing role permissions. Security reviewers may vote; execution requires actions:apply. Read-only and finance roles cannot vote or execute, and security reviewers cannot execute. A stable authenticated user ID is required. API-key scope and entitlement checks remain unchanged.

## Validation

- Route regressions reproduced and then refused claimed voter identities, second votes from one key, ambiguous legacy rows, legacy execution, missing quorum, unauthorized roles and cross-origin requests. Authorized distinct principals still reach quorum.
- Five actual isolated PostgreSQL cases passed: competing distinct voters, competing duplicate votes, legacy refusal without rewriting history, trigger-induced terminal-update rollback and recovery, and tenant/decision refusal. The portable Agent fixture also ran its eight Agent-chain cases: 13 passed, none failed or skipped.
- Full source suite: 9,962 passed, 0 failed, 97 skipped. Root TypeScript and production build passed. Independent source review found no blocker.
- No customer approvals were cast, no production database data was changed, and no executor or paid model was run by these fixtures.

## Rollout boundary

Old application writers do not honor the new transaction lock or application provenance check. The scoped database fence in `ops/recovery/20261023_approval_writer_enforcement.sql` refuses their vote inserts, terminal snapshot updates, execution claims and approval-stage continuations. Reviewed application writes set a transaction-local version marker; that marker grants no customer authority and is not a credential. It does not defend against arbitrary SQL executed with the application's database role.

The exact SQL takes the Prisma migration fence, locks the historical ledger against migration changes, and locks the four affected tables before checking for overlapping execution. It refuses running Engineer executions, active pipelines with advanced approval gates (including expired snapshots), missing approval snapshots and terminal callbacks awaiting continuation. Unrelated coding runs before an approval gate remain intact. Three triggers validate version, server-assigned vote IDs, tenant-bound quorum and the requested transition. Functions run as invoker with fixed search paths and PUBLIC execute revoked. Historical application rows and migration history are preserved.

Validation of the fence:

- Ten actual PostgreSQL guard cases passed alongside the thirteen Agent/vote cases. Old/default-ID writes, old terminal transitions, old execution claims and old pipeline continuations were refused. Reviewed voting, execution and stage transitions worked. Zero-approver rules retain their reviewed behavior while legacy rows cannot be laundered through them. The marker did not remain active after commit. Pending creation, metadata updates, expiry, and non-owner application-role behavior were also verified.
- A fresh production logical backup was restored privately on a network-disabled local PostgreSQL 17 server. The complete exact script passed; all 137 existing public tables retained identical data fingerprints. Busy migration, running Engineer, advanced expired-gate continuation, terminal waiting continuation and repeated installation were refused. Trigger ownership, invoker mode and function privileges were checked. The owned test server was stopped and removed.
- SQL SHA-256: `ac4b92ccfc2b7d1710a5897d08ee10b1800cc9d5c0b16a414a96d2334b0c6f62`. Independent review found no blocker.

Production installation is conditional on the matching reviewed application candidate being ready. Apply only the reviewed exact SQL in one transaction on the verified target; any lock or precondition failure holds the rollout. Once installed, retired handlers intentionally cannot perform those writes. Promote the matching candidate and verify the exact production alias and public checks. The earlier candidate without transaction-local markers must never be promoted after installation.
