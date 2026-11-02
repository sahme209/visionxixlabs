# Agent requester API composition — local partial progress

The paired operation API now accepts only saved-ID execution in addition to prepare/cancel/read. A separate paired GET eligibility endpoint projects the internal current-authority read to a shared strict display contract. The public object contains proposal ID, bounded effect/expiry, optional operation ID, closed reason and booleans; it never serializes raw arguments, source evidence, roles, private claims or provider credentials. The desktop and server now share this pure contract.

Execution and preparation each independently read current original-requester authority from the durable store. Execution re-authenticates the paired principal and invokes only the fixed stored-operation coordinator. No caller approval/readiness/argument field is accepted as permission. Positive display metadata is not execution authority. Recovery/cancellation remain paired-reader operations when the execution switch or commercial execution access is off.

## Explicit unfinished-source gate

Branch creation, PR creation and ECS dispatch still lack the required immutable source binding. The public service therefore hard-refuses preparing/executing those three tools even when AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED is true; eligibility says workflow_incomplete. The fixed adapters and their lower-level tests remain present. This is a temporary incomplete part of the original eight-tool scope, not a smaller completed product or a permission that a client boolean/flag can restore. File/blob-reviewed changes and the three database configuration tools use the current validated source contract. Production execution stays OFF/unset; no activation is authorized.

## Deadline and uncertainty

The handler constructs a request carrying the combined incoming/15-second deadline signal and passes it into the composed service. This fixes response-observation-only cancellation: the worker's current-authority/provider guards see that deadline too. A provider request already accepted at cancellation remains consumed and must be recovered read-only; cancellation is not a rollback guarantee. Closed payloads,2KiB input limit, rate limiting, safe response validation and private/no-store headers apply to both route kinds. Unknown response errors never trigger a fallback responder or resend.

## Verification

- Initial missing projector/service/HTTP methods produced RED checks; final70 checks across six HTTP/service/projector/client/panel suites pass. This includes19 HTTP boundary cases,13 service cases,6 projection cases and32 existing client/panel cases. Authentication/store boundaries are mocked in these unit suites. Log `/private/tmp/axiom-agent-requester-full-boundary-tests.log`.
- Scoped TypeScript includes both actual routes, handler and service and passes. Log `/private/tmp/axiom-agent-requester-api-final-types.log`.
- Actual isolated PostgreSQL HTTP journey passes with real durable/source/review/role/session rows, handler, service and fixed database responder: ready → prepare → ready → execute confirmed → recovery after role and commercial access loss. Client authority overrides refuse. No raw source is returned.
- Three further actual HTTP/database cases pass: requester revocation after displayed readiness, reviewer revocation after readiness, and an independently reviewing administrator trying to adopt the requester's prepared action. Each refuses before a claim/mutation and preserves original prepared history. Log `/private/tmp/axiom-agent-requester-execute-http-authority-pg.log`; owned fixture cjp4gqyl stopped.
- One actual PostgreSQL/provider HTTP composition passes through the real fixed file client and pinned installation resolver boundary, with token issuance and provider HTTP simulated. It performs one simulated PUT, confirms one durable attempt and refuses re-execution without another PUT. Log `/private/tmp/axiom-agent-requester-provider-http-pg.log`; owned fixture oqtvn5ej stopped.
- Entire current store/API suite:34 actual isolated PostgreSQL checks pass in32.04s, including the natural30-second lease test. Log `/private/tmp/axiom-agent-requester-api-all-store-pg.log`; owned fixture0thtdd5d stopped. Request authentication, commercial availability, human identities/reviews, token issuance and provider responses are explicitly simulated; no genuine account, approval or live provider acceptance is implied.
- Desktop types and Vite6.4.2 build pass after extracting the shared contract. Logs `/private/tmp/axiom-agent-requester-api-desktop-{types,build}.log`. Existing chunk warning remains. No signed native rebuild or visual acceptance.

Automated independent source review found no important findings in the request-bound deadline, source privacy, current-authority composition or three-tool refusal. This is not independent human provider authorization.

## Remaining requirements

Complete the three immutable-source paths, broader real Governance admission/coverage/enrollment and remaining callers. Validate current requester controls/native full flow, outcome/conversation presentation, source staleness and exact whole-project/native builds. Old proposal approvals are never adopted; original review history remains unchanged. Existing unused legacy responder is not invoked or used as a fallback by the new entry points. ServiceNow, release, Windows/Store and every remaining website/documentation/security/integration master-plan item remain open. This partial code is not production-ready or full Governance completion. No deployment, flag, schema, grant, purchase, paid CI or live provider action occurred.
