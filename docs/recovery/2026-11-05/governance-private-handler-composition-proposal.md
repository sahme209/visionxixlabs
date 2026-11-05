# Private handler composition — bounded local implementation proposal

Status: reviewable proposal, not implementation approval. Source a23b4da3. This implements the next necessary part of the connected consumer design while preserving every unresolved custody, qualification, fleet and activation requirement. It is not a replacement miniature executor or a claim of full Governance.

## Recommended decision and alternatives

Select private-instance composition of the existing execution/history handlers. Extract their current validation and control flow into instance cores; existing HTTP exports remain thin legacy compositions with their present dependencies. The private graph composes the same cores with its actual database, paired-session resolver and coordinator. Directly importing the current global handlers is rejected because it retains shared-resource access. A second hand-written protocol executor is rejected because it could diverge from the established validation, recovery and outcome semantics. No dependency adoption is necessary.

## Exact source unit

1. Extract execution and history handler cores from `releaseProviderMergeExecutionHttp.ts` and `releaseProviderMergeOperationHttp.ts`. A module-level core may accept trusted construction dependencies, never dependencies supplied in request data. Core imports must exclude global DB/session/coordinator factories. Preserve all current method/URL/no-query/ID/body/version/binding checks, capability requirements, no-API-key policy, rate limits, request/handler deadlines, cache and error behavior. Existing exported handlers keep signatures and compose the old defaults; no route activation changes.
2. Extend `privateReleaseMergeComposition.ts` so its trusted bootstrap can compose those cores with the already captured private client, private resolver and actual private coordinator. Keep repository, keys, auth, clock and transport lexical. History/recovery retains its read-only dependency shape; no credential/provider/coordinator import is introduced into that core.
3. Prepare a lexical data-dispatch adapter around the private handler instance, reusing the six-operation envelope from `process-placement-and-request-channel.md`. No competing protocol, arbitrary URL/header forwarding, actor/org field, executable callback or public setter. Fixed request construction validates opaque session credentials and preserves the nested handler bounds. Precise credential-length/envelope compatibility must be checked against the current token codec before accepting the proposed 4 KiB cap; unsupported input refuses rather than expands silently.
4. Do not mount a Mach/HTTP/service listener, expose the dispatcher from public runtime exports, change canonical `index.cjs` startup, enable feature flags or return a verified issuer variant in this unit. The real private graph can be composed and exercised in isolated tests; external ingress and positive identity remain subsequent connected qualification work. No pretend operational route is added.

## Local acceptance after approval

1. Preserve existing handler behavior with shared core tests covering all six operations and exact route/body bindings. Wrong method, oversized/malformed/trailing/unknown fields, query scope, invalid IDs and altered plan bindings refuse.
2. Compose the actual private graph against owned isolated PostgreSQL and synthetic session/membership/policy fixtures where separately permitted by the existing local-test scope. Use simulated provider/auth transport only. A prepared/read/history/cancel/recover journey must use that supplied private store; global DB/session/auth access is a test failure. Successful fake authority cannot qualify native identity.
3. Current issuer refusal remains observable before claim/mint/send. Tests must not flip flags or inject a digest to call this runtime qualified. Existing coordinator business-positive unit fixtures remain bounded simulated tests, not operational acceptance of this new bootstrap.
4. Verify wrong tenant, expired/revoked session, self-review, source/version changes and cancellation preserve refusals. History reads/recovery never mint credentials or dispatch; UNKNOWN remains consumed and cannot become a resend.
5. Independent source review checks dependency closure and equivalence; scoped types and relevant emitted-closure build only after their execution scope is reconciled. No repeated giant packaging/signing run is included.

## Joined qualification sequence retained

A. Trusted maintenance permission is distinct from owner/runtime readiness. A future operator-approved isolated datasource and fresh synthetic keys must originate through a separately specified private maintenance input—not current placeholder material, caller data, environment, argv or public IPC. Its exact resource-input/generation mechanism is unresolved and must be decided before positive provisioning implementation.

B. Installed custody requires the original effective-policy, outsider/copy/recipient, source-protection and owned-epoch matrix. Data-only read/refusal paths before this point do not count as business execution acceptance. No synthetic success creates an issuer capability.

C. Actual same compiled consumer qualification must bind the owned native instance and private handler, retaining current origin/lifetime checks at claim, credential and final send. Distinguish native instance observations from permission for an action and from fleet qualification. No copied descriptor, test digest or public ready flag supplies authority. Its exact positive mechanism remains a design/operational gate after this source unit.

D. Only qualified resources/consumer plus the full existing session/source/independent-review/policy/claim/credential/drain/fleet checks can authorize an effect. Production writer/resource withdrawal and other mutation families remain mandatory. Do not relabel a direct-merge slice as complete A2/A9.

## Permission boundary

Requested scope is local source, pure/mocked tests and already authorized isolated synthetic database tests. No actual Security/Keychain call, fixture-secret provisioning, privileged account/file/service change, helper/canonical runtime execution, signing, image mount, customer/provider request, real credential, schema migration, production flag/deployment, paid build or spending. Existing signed artifacts remain unchanged. This changes private authority composition and therefore needs the standing validation-first decision before implementation.

## Independent design review

Qualification reviewer checked the actual handler bodies, private composition and prior channel contract. No important correction. Approval-ready for the stated local source/pure/mocked scope; actual database-test authority remains conditional on the existing explicit grant. No target execution or tests performed by this review.
