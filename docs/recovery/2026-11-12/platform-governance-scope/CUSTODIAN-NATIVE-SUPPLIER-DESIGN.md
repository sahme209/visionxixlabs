# Fixed native ECS custodian supplier — design for owner review

Status: design prepared under the owner's bounded design/public-documentation approval. Local implementation is NOT approved by that grant. No default issuer or source is qualified or enabled. Public evidence and remaining uncertainty are recorded in CUSTODIAN-NATIVE-SUPPLIER-AWS-SOURCE-REVIEW.md; installed-code hashes are in CUSTODIAN-SUPPLIER-SOURCE-INVENTORY.json.

## Problem and selected candidate

The real missing port is the source credential that the private Axiom runner uses to assume an exact execution role. Its initial candidate is a dedicated Fargate task, separate from the website/AI process and the GitHub job. This is a recommended supported profile, not a provisioning decision, existing service or isolation guarantee. Reject generic ambient credential chains, EC2 shared-host support, EKS/full-URI/token-file variants and a same-task sidecar as v1 alternatives unless separately designed and qualified.

Use a fixed private one-request container-credential reader rather than adopting the generic installed supplier's endpoint/file/retry behavior. No new dependency is proposed. Later implementation would reuse bounded native request/state conventions and all existing action/source-intent/source-lease/derived-lease gates. It must be integrated into the actual private runner, not presented as complete by adding an unused callback.

## Trust and resource bindings

A protected, current platform issuer profile must establish the exact deployment/account/region, Fargate task/task-definition revision, immutable image/code identity, source TASK ROLE, permitted target execution role/service, controlled bootstrap/maintenance/exec/sidecar posture, profile revision and qualification expiry. Source role and target execution role are different fields. A returned RoleArn is compared to the protected source role; it is not inferred from the requested target role. No caller JSON, email allowlist, operator-entered digest, local clock, environment flag or signed GitHub JWT can supply this qualification.

Native origin/role/trust/runtime evidence must come from a separately accepted operator-controlled qualification process, repeated around acquisition and final exchange. Actual evidence must cover alternative producers and maintenance/control-plane access. Source configuration must constrain source permissions and the target's complete native trust/permission alternatives; an optional STS session policy alone does not prevent another accepted principal omitting it. General administrator/break-glass authority is documented separately, never falsely claimed universally intercepted.

The launch handoff may privately capture the native relative credential coordinate only AFTER authenticating the actual qualified runtime. Capture once; do not reread mutable environment values during a request. No arbitrary URL, credential, endpoint, path or file is accepted from a human/workload request. The full private coordinate and credential material are never logged, hashed into public metadata or persisted in proposal/events.

## Fixed transport profile (proposed Axiom restrictions)

- One native HTTP GET to literal169.254.170.2 on port80 using only the captured relative path. No DNS, proxy, redirect, full URL, userinfo, alternate host/port, caller headers or authorization-token/file fallback.
- V1 accepts only an explicitly qualified credential-path shape. The documented /v2/credentials/<identifier> example informs the candidate; it is not a universal AWS grammar guarantee. Query/fragment, path traversal, control characters and an unqualified real shape refuse. Do not broaden the profile when a real host differs.
- Proposed application bounds: one request,64KiB response,3seconds total including connection/body, no retry. These are Axiom limits, not vendor guarantees. Abort destroys the owned request and response; response completion/late data cannot produce another acquisition or restore a failed attempt.
- Parse only the independently qualified response profile. Require native source-role match, bounded nonempty credential fields and a valid expiration, never print raw bodies/errors. Do not invent undocumented success/error fields or assume example fields exhaust every real response. Unknown shape or ambiguous acquisition leaves the original durable source intent/lease unknown and held.
- No generic SDK memoized refresh or background timer. Acquisition occurs only inside the admitted private execution path. A source lifetime beyond the action's review window stays a separate liability; review expiry does not revoke it. Real response lifetime is checked against independently qualified profile/clock evidence rather than a guessed six-hour maximum.

This HTTP link-local channel relies on the qualified native task boundary; it is not claimed to provide TLS/cryptographic response identity. Unsupported boundary evidence must refuse before reading any credential.

## Joined acquisition lifecycle

1. Exact original requester/reviewer/delegation, current workload/profile/source and native-target checks succeed. Reserve the existing durable source.acquire intent under the same physical issuer/drain lock before contacting the native supplier.
2. Authenticate the captured private runtime/source profile and endpoint coordinate; refuse any changed/revoked admission or unqualified old producer. Register pending source exposure using the existing original action/attempt; no new anonymous acquisition path.
3. Make the one bounded request. A valid native response yields source metadata/expiry for the original durable source-lease observation; credential values remain lexical inside the custodian. If the request or its result recording is uncertain, preserve unknown liability; do not contact the endpoint again automatically.
4. Recheck current qualified origin/profile/source-role and source lease, then use the existing exact AssumeRole transport and role.acquire final gate. GitHub's token authenticates only the request; it is never forwarded as an AWS credential or substituted on failure.
5. Keep existing final native send/current human/source/lease checks, ecs.send intent, one attempt and original accepted/unknown receipt. No source acquisition, mint, send, rollback, resume or compensation is triggered by a history read.

Cancellation and late results preserve truthful known/unknown acquisition facts even when they can no longer authorize output or a send. No raw credential handle is exported through the human/workload HTTP boundary.

## Drain and closure: explicit missing real evidence

The existing drain stops NEW Axiom admission; it cannot by itself stop the ECS agent's automatic credential rotation, another program in the task, another task using that role, a replacement service task, a maintenance path or an external trusted principal. Do not equate an empty Axiom ledger, stopped HTTP reader, one expired source lease, GetCallerIdentity result or a fixed six-hour sleep with safe closure.

A real closure qualifier must prove all applicable source producers are prevented from future acquisition/renewal after an established cutoff, inventory known and unknown source AND derived sessions with native provenance/conservative bounds, account for replacements/old runtimes and trust/permission alternatives, and use a qualified time interval beyond all bounds. The mechanism for establishing that cutoff, relevant native revocation/propagation evidence and trusted time is not established by the three approved pages. Closure stays unavailable until separately specified and accepted. Credential closure still does not reconcile an unknown deployment result or release its target hold.

No stopping service, changing IAM, revoking sessions or disabling ECS Exec is authorized by this design. Such provisioning/cutover choices must be explicit operator-reviewed actions, never hidden in a supplier getter.

## Local implementation/test plan (requires its own approval)

1. Pure fixed-profile/response parser and private immutable capture types; missing/caller-supplied/stale authority refuses. Explicitly test source-role versus target-role separation and unsupported path/response profiles.
2. One fixed transport composed with the actual private issuer, using intercepted Node I/O only. Test relative/full URI substitution, redirects, proxies, token/file fallback, arbitrary headers, bytes/deadline/late-body failures and zero automatic retry.
3. Actual existing source-intent/lease/role/send SQL composition with synthetic runtime/qualification/time evidence. Test drain before acquisition, changed source during await, known response with lost DB acknowledgement, unknown acquisition, source expiry, parent cancellation, and independent source/derived liability preservation.
4. Positive actual installed-STS/ECS serialization intercepted with exactly one source acquisition/mint/send and original history recovery; negative no-source/no-send and malicious runtime/input cases. No simulated supplier becomes a default qualifier.
5. Complete all-family caller/legacy audit and current-source tests/types/build, then the planned single final independent whole-source review and mandatory-green PR. Real installed/runtime/provider acceptance remains separate.

## Operator setup and real acceptance packet — separately authorized

Before deployment: choose actual account/region/network/service/task/runtime/image, record actual task-role and execution-role trust/permissions/alternative access, establish immutable source and workload/native protection evidence, qualify the captured task identity/credential channel/response/lifetime, inventory old fleet/producers, define trusted-time/cutoff/closure evidence and operational recovery. Prepare exact actions, expected costs, current backup/cutover/rollback plan and genuine review before any account/provider read or change.

Fargate hosting, registry/logging/networking and evidence services may incur charges. This work has no budget authorization and makes no free-hosting promise; a concrete costed setup requires the owner's explicit decision. No real ARN/account/credential value is guessed or retrieved. Never weaken existing checks to make a synthetic or unprovisioned host pass.

## Present completion boundary

The design identifies the native supplier candidate and its trust/lifetime gaps. It does not establish actual AWS identity/custody/fleet/closure, complete P01, native host installation or universal Governance. Pending image/template/deployment decisions remain distinct; this does not replace or approve them. No code, service, account, credentials, IAM/grants, database, deployment, workflow, signing, real secret access, model call or spending occurred.
