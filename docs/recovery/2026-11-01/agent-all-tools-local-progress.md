# Agent fixed tools and deliberate controls — local progress

Current source covers all eight existing fixed Agent tools in the separate server coordinator: four GitHub mutations, ECS restart dispatch and three database configuration responders. This is not full Governance admission, production activation or a finished native workflow.

## Backend evidence

- The AWS adapter uses the fixed policy evaluator, target review, current deployment capability, pinned installation token, original requester/idempotency key and existing quota/reservation helpers. Promotion inputs refuse; unknown tiers refuse before claim. Production controls are preserved. Reused or already-reserved operations are never dispatched again. Definite provider refusal releases only a fresh hold; lost replies keep it. Completion cannot trigger resend.
- A bounded strict canonical policy snapshot hashes relevant tenant repositories and enabled environment policies. The final store transaction locks current target/review/requester/policy rows, binds the real reservation to the original operation/environment/ref/commit/requester, then uses a final single SQL snapshot for current connection/session/time and repository/policy evidence. A real late-policy-insertion race was reproduced and fixed: the earlier policy snapshot alone had accepted newly changed authority.
- Current requester readiness is an internal store read only. It returns private source evidence for later trusted projection, never an HTTP-ready object. It cannot prepare or claim; revoked reviews and changed paired sessions cannot become fresh executor authority.
- Final focused backend batch:50 checks pass, including17 AWS cases,8 snapshot cases and25 previous coordinator/descriptor checks. Scoped coordinator/server types pass. Logs `/private/tmp/axiom-agent-deployment-reviewed-final.log` and `/private/tmp/axiom-agent-all-tools-final-types.log`.
- Final entire store suite:29 actual isolated PostgreSQL journeys pass, including real30-second lease expiry. Log `/private/tmp/axiom-agent-all-tools-store-final-pg.log`; owned fixture lilmco7f stopped.
- Entire coordinator suite:10 actual isolated PostgreSQL journeys pass:4 GitHub/common authority cases,3 real fixed database responders and3 real AWS policy/quota/reservation/fixed-client cases. Authentication, human review identity, token issuance and provider HTTP responses are simulated. No live provider acceptance is implied. Log `/private/tmp/axiom-agent-all-tools-coordinator-pg.log`; owned fixture031p6ssc stopped.
- The expanded real target fixture exposed an invalid test expectation after configuration update: actual updatedAt changes invalidate the previous target review. The test was reordered to test policy/reservation changes before target mutation; it does not rewind a target revision or relax runtime validation. Initial combined store result was28 pass/1 fail, then the corrected focused case and final29-case suite pass. All owned fixtures stopped.

## Frontend evidence and scope

The strict eligibility DTO and bounded paired transports support explicit readiness, preparation, fresh readiness, one execution and cancellation of an observed unused record. They accept no caller authority fields. Shared read transport now races the entire response against cancellation/deadline even if a transport ignores abort. Requests are scoped to the current configuration/revision and use no cookies or redirects. An uncertain mutation never automatically resends.

Independent review found that a lost Prepare response could not be reconciled by reading the original prepared record. The panel now retains which command became uncertain. Exact prepared lookup or true absence may reconcile preparation; uncertain execute/cancel responses remain held for prepared or dispatching records. A new panel regression failed before this fix. Final32 client/panel checks, desktop TypeScript and Vite6.4.2 frontend build pass. Earlier137 view regressions also pass; do not add overlapping counts into a single total. The frontend worker reported a capacity error after saved checks; root reconciled terminal logs/processes and completed the review fix. Current frontend logs `/private/tmp/axiom-agent-controls-reviewed-final.log`, `/private/tmp/axiom-agent-controls-desktop-toolchain-{types,build}.log`. Existing chunk-size warning remains.

React quality check: event-driven commands, one pending controller per card, effect cleanup/expiry handling, derived control availability, strict response ownership, escaped text and native buttons. No new dependencies. This is source/build acceptance, not a signed native or visual/customer walkthrough.

Automated independent source review confirms the lost-prepare correction and found no other important current adapter/snapshot/control findings. It is not a genuine human provider approval.

## Remaining gates — do not ship as complete

- Backend eligibility projection/HTTP and deliberate execute HTTP are not implemented. The frontend receives no positive current server readiness; positive control tests use simulated metadata. Existing execution switch stays OFF/unset and current HTTP accepts only recovery/preparation/cancel. Never serialize readiness.source/raw arguments/private claims.
- Symbolic branch/PR/workflow references are not proposal-time immutable source binding. This remains an activation requirement. The ECS path is restart capability, not immutable artifact promotion.
- Complete requester/native HTTP end-to-end validation, exact full production/native builds and final composition review remain Tasks3–5.
- Full registered Governance coverage/admission/enrollment remains incomplete and refuses. Airflow/dashboard/other catalog callers and baseline issuance/customer workflow must still be completed.
- ServiceNow written-note observation/native lifecycle/closure, release reconciliation, website audit/demos/documentation/support foundation and the rest of the master plan remain open. No live writes, deployment, environment/schema changes, paid CI or impersonated human decisions occurred.
