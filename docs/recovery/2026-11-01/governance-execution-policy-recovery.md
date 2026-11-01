# Execution-policy read-only recovery and exact pointer selection

Local continuation of the approved execution-policy workflow. The native forms need a way to read a timed-out save and the exact current parent/CAS version without resubmitting a decision or requiring the administrator to be an executor.

## Implemented

- `lookupRequest`: an exact original nonce and operation are resolved only for the current paired original actor/session in the same organization. Existing request-marker and audit validation is shared with mutation recovery. Results are explicitly historical and executionAuthorized=false; no mutation callback runs. A missing marker is only a read result, not permission to retry.
- `readActivePointer`: current paired readers may inspect exact scope/revision/digest/parent/pointer version and historical policy status, including expired or revoked limits. It is not readAuthority and never grants action access.
- Strict `lookup` and `read_active` HTTP operations use reader capability, bounded bodies/timeouts and no-store responses. Their failures are definite read failures rather than uncertain writes. Mutation capabilities, review independence, CAS and nonce rules are unchanged.

## Verification

Four new store regressions initially failed because these operations were absent. Eleven store tests now pass, including original issuer regressions. Thirteen HTTP tests pass (two new recovery-boundary cases). Scoped production TypeScript passes. Expanded actual isolated PostgreSQL HTTP/store journey passes: recover proposal and revoked activation receipts, reject a different actor's lookup, inspect revoked pointer, keep workflow-row count unchanged and continue refusing execution authority. Four older database tests were deliberately filtered/skipped. Paired authentication is simulated; durable rows, roles, sessions and audit records are real isolated PostgreSQL. The owned fixture stopped afterward. No provider requests or existing DB changes occurred.

Independent review found no important issues. No signed/native form or complete Governance/customer workflow acceptance is claimed. Full production build receipt for852e predates this increment; a subsequent exact batch build is still required. No deployment, environment/schema change, paid CI, grant, credential or publication occurred.

Evidence logs: /private/tmp/axiom-execution-policy-recovery-{red,green,all,types,pg}.log and /private/tmp/axiom-execution-policy-http-recovery-red.log.
