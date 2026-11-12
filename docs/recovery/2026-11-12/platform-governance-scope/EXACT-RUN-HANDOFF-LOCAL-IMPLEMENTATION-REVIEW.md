# Exact-run handoff — local implementation scope for owner review

## Current source and prior review findings

The original design/public-documentation grant is consumed; it did not authorize this workflow handoff implementation. The original findings in EXACT-RUN-HANDOFF-PROPOSAL.md remain historical evidence, not rewritten approvals.

1. `operations/contracts.ts` and `workloadIdentity.ts` now bind new execution manifests to explicit environment/protection revision; the signed environment and current profile are checked. Existing historical records are not silently upgraded. The private runner refuses missing environment/protection/profile. This closes the named local contract omission, not actual GitHub environment qualification.
2. `workloadRunner.ts` now uses `privateStsIssuer.ts`, not the old web-identity issuer. The incoming JWT authenticates the exact Axiom workload claim only; installed AssumeRole signs with a separate private custodian credential. `nativeCustodianSupplier.ts` joins immutable private capture/strict response/qualified-time checks. The prior audience-coupling implementation observation is superseded locally, not an actual AWS trust assertion.
3. Local source and SQL tests prove original source-intent/lease/role-intent/send sequencing with synthetic qualification. Actual prevention of direct GitHub→AWS exchange, host custody, alternative producers, current protection, fleet cutoff and trusted time remain UNQUALIFIED. Neither a GitHub environment nor passing synthetic tests can close those real gates.

Source receipts: NATIVE-SUPPLIER-JOINED-RECEIPT.json and PLATFORM-ECS-RETIREMENT-RECEIPT.json. Axiom's direct checked-in workflow now refuses; customer template/observer bytes remain unchanged. No real workflow has been dispatched, environment created, setting changed or credential read.

## Proposed bounded local deliverable

Prepare the connected credential-free/run-hold handoff as SOURCE ONLY, reusing existing immutable request references, ECS preparation/review/delegation/history and strict workload HTTP contract:

- A pure exact workflow artifact compiler binds a private source-qualified environment reference, protection revision, reviewed audience, fixed Axiom workload origin/path and source identity. No caller-provided arbitrary endpoint, shell code, job name, token source or redirect target. Compiled text alone is not configuration or execution qualification.
- The prepared workflow has no AWS action/SDK/CLI, AWS credential variable, native service mutation or automatic rollback. Its protected job can request only its reviewed Axiom audience and send the strict original action/version command once. No token/body output, logging, artifacts or credential exports. No automatic retry, polling, rerun or first-matching-run selection. A native GitHub run/attempt remains distinct from the human session and independently reviewed action.
- An original request reference may identify future action metadata before a proposal exists, but cannot grant approval. New preparation requires independently supplied exact existing run/attempt/source/protection evidence; absent/ambiguous evidence refuses. History never resets a request or renews an approval.
- The owner/human releases the exact native GitHub hold after genuine independent Axiom review and requester delegation. No automatic environment release API, reviewer impersonation or invented owner authorization.
- An explicit private source qualification interface rechecks current environment/protection/workflow/run evidence around awaited handoff reads and before existing final execution admission. It accepts no production default, caller booleans or environment-name-only proof. No live repository reads are part of this unit.
- Keep the checked-in platform workflow's refusal intact. Store any prepared replacement as an unregistered artifact; no active workflow/configuration switch. Do not change the customer template or its current hash/observer.

## Acceptance to implement after approval

Pure artifact and intercepted transport tests must verify fixed target/no shell injection, no AWS credential path, no early OIDC job, strict original command, redirect/deadline/output limits, no secret output, no retry, one native attempt and preserved uncertainty. Existing real crypto/current authority/SQL tests must join wrong environment/protection/run/attempt, early release, missing independent decision, requester/reviewer revocation, expiration, concurrent claim, lost acknowledgement and original-history recovery. All GitHub/native/provider/host/time qualification remains simulated and labeled.

No generated source is to be installed, executed as a real workflow or enabled because a string test passes. Actual native configuration/source receipts and same-artifact/host acceptance require separate concrete owner authorization and cost review.

## Requested approval and exclusions

Approve local code, source-only workflow artifact preparation, intercepted HTTP, synthetic crypto and existing owned isolated PostgreSQL tests. This adds the new gate/profile handoff composition identified by the original design review, so the validation-first boundary requires an explicit decision.

Excluded: actual repository/environment reads or configuration, audience/role trust setup, real JWT/credential requests, native GitHub workflow runs, release/review actions, signing/installing helpers, production migration/flag/settings/deployment, publishing, dependencies and spending. Missing real qualification continues to refuse execution. Existing image/template/deployment recovery decisions are unchanged and are not re-requested or inferred here.
