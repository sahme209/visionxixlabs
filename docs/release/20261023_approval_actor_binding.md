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
- Full source suite: 9,962 passed, 0 failed, 89 skipped. Root TypeScript and production build passed. Independent source review found no blocker.
- No customer approvals were cast, no production database data was changed, and no executor or paid model was run by these fixtures.

## Rollout boundary

Old application writers do not honor the new transaction lock or provenance guard. Releasing source alone does not retire those writers. The production transition must block the affected vote and execution paths, allow prior requests to drain, promote the tested candidate, and prevent requests reaching old deployments before reopening canonical production routes. Deployment protection on old GET URLs is insufficient proof of this boundary. This release remains staged until that condition is verified.
