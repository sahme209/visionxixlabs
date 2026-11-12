# Exact-run workflow handoff: local design decision

Status: owner approved bounded design preparation and three official documentation reads. Research completed; design below awaits independent review. No workflow/configuration changed.

## Verified source gap

- The current `.github/workflows/axiom-deploy-aws-ecs.yml` dispatches a job immediately, obtains AWS credentials and directly updates/rolls back ECS. There is no configured human hold in its source.
- The approved replacement manifest requires an already-created exact workflow run/attempt and genuine independent review followed by original-requester delegation. The prepared workload HTTP path accepts only that original saved action and consumes it once.
- `createEcsPreparationStore.lookup` can derive an original requester/session/request-UUID action reference even before a proposal exists. That reference is metadata, not authorization. It can identify a future run, but cannot supply its approval.
- Dispatching only after review cannot create the exact run identity already bound by that review. Fixed sleeps or replaying failed jobs would introduce the wrong handoff/attempt semantics. A first-matching-run redemption was explicitly rejected by the accepted design.

## Proposed next design

Use a separately owner-configured native GitHub hold/release mechanism, if official contracts and this repository's actual configuration establish its availability and exact semantics. The run must exist before Axiom review/delegation; the credential-bearing step must not start until the hold is deliberately released. Axiom's own independent review, requester delegation and final signed exact-run/current-source checks remain mandatory; a GitHub gate never substitutes for them.

No environment name, reviewer set, plan entitlement or security setting is invented. Never rely on referencing a nonexistent environment to create a protected gate. The actual repository gate and its current protection must be qualified before a default execution profile can allow credentials. Unknown/unavailable policy remains blocked. No endpoint/claim/profile is enabled just because local source compiles.

Requested local scope: search/read up to three official GitHub documentation pages to verify run/job waiting, environment/protection semantics and OIDC timing; then specify and independently review the exact connected workflow handoff and its tests. This is design/preparation only, not workflow changes, implementation of new authority, environment/reviewer creation, repository access, real tokens, workflow dispatch, grants, production action or spending. Any necessary real repository configuration requires its own owner decision after the exact procedure is reviewable.

Other already-approved local work continues meanwhile. The unmanaged workflow is not retired as a claim of usable replacement until the connected qualified flow and full batch gates are met.

## Documentation findings — 2026-11-12

The three-page allowance is consumed. No repository/account API or token was accessed.

- [Environment configuration](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments): environment protections precede job execution. Required reviewers, self-review prevention and administrator-bypass prevention are configurable. A nonexistent referenced environment can be created WITHOUT protections: a YAML name is not proof of a protected gate. Availability depends on repository visibility/plan. These facts do not verify this repository's configuration.
- [Reviewing deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments): a human can release or reject a waiting environment job in its existing run. Release permits the job to continue after other rules pass; rejection fails the workflow. This supports a same-run handoff, not an automatic Axiom approval integration.
- [OIDC reference](https://docs.github.com/en/actions/reference/security/oidc): job-scoped id-token permission enables token requests, not cloud-resource writes. Tokens carry run/attempt, repository/workflow and environment claims. An environment changes subject composition; immutable/custom formats require exact qualification rather than assuming the old branch subject.

## Connected handoff specification — proposed, not implemented

1. Owner separately approves/configures one fixed protected environment. Qualify its identity, current reviewer rules, prevention of self-review, disabled bypass, allowed source refs and plan availability. Missing, implicitly created, changed or unverifiable protection keeps execution unavailable. Do not add secrets or modify trust as part of design preparation.
2. A separately authorized dispatch creates one run with the original requester/session/request UUID reference. This reference is not a bearer capability. The credential-bearing job references the fixed environment and remains held; no earlier job/step receives OIDC permission, cloud credentials or a provider-write path. Do not use a sleep, polling loop or runner held open for human review.
3. Read and qualify the exact created run ID, attempt, repository identity, workflow path/SHA, commit/ref and intended environment through a separately approved source supplier. Prepare the existing immutable ECS proposal against that exact identity. Ambiguous/multiple matches, wrong actor/source or unavailable current evidence refuse. The UI must show the exact run link and action reference.
4. A genuine independent reviewer approves the exact Axiom proposal; the original requester separately delegates once. Existing expiry/current-authority checks remain. No approval is inferred from the GitHub environment decision, and no Axiom decision is inferred from GitHub actor identity.
5. An authorized human releases only that exact pending GitHub job after verifying saved Axiom approval/delegation. This is an additional manual gate, not an automatic release API or a replacement for independent review. Reject/cancel if review cannot finish within the action window; do not renew/replay the consumed attempt.
6. Once released, the fixed reviewed job requests a fresh token for one exact audience separately qualified against the role’s trusted client ID. It sends only the existing strict action/version command and token to the private workload endpoint. The proposed extended verifier must check exact signed run/attempt/workflow/source/environment, current humans, original delegation and native reservations before the existing one-attempt credential/dispatch path. Direct workflow AWS credential minting/update/rollback is excluded from the replacement.
7. Early release, protection removal or token possession cannot authorize a provider write: the server refuses without genuine current approval/delegation and qualified source/custody. Configuration checks supplement these gates, never replace them. Network delays can consume the review window; expiry must refuse rather than extend it.
8. Timeout, lost reply, rerun or uncertain provider result remains consumed. Read original history explicitly. A changed run attempt requires a separately authorized new exact plan, never reuse of the previous approval. No automatic rollback, retry, run selection or environment bypass.

## Acceptance matrix for later approved implementation

| Case | Required result |
| --- | --- |
| Fixed protected job pending, valid exact source | Proposal can bind the existing run; no credentials issued |
| Missing/implicit environment, changed reviewer/bypass policy | Default qualification refuses |
| Release before Axiom approval or requester delegation | Workload claim refuses; zero STS/ECS writes |
| Self-review, revoked reviewer/requester, expired approval | Refuse before credential issuance |
| Wrong run/attempt/workflow SHA/ref/repository/environment/audience | Signed identity or source qualification refuses |
| Original approved/delegated run released once | One claim, one issuance liability, at most one ECS command |
| Duplicate token/command or rerun | No replay; original durable result preserved |
| Lost reply after claim/issuance/send | Unknown held; history only, no resubmit |
| Current protection/source unavailable or changed during awaits | Refuse at final currentness gates |
| Rejected/cancelled pending job | No provider command; retain honest original history |

Tests must distinguish mocked qualification from actual GitHub/native acceptance. Later live qualification needs separately approved repository reads/configuration and a bounded real run; none is authorized here. This design does not prove removal of every alternate credential path or full Governance coverage.

## Remaining decisions and evidence

Independent design review is pending. Implementation of this new gate/profile boundary, actual environment/reviewer configuration, source supplier access, OIDC/IAM/custody qualification, workflow registration/replacement and real execution each retain their existing approval gates. No environment name, account identity, plan entitlement or native subject is selected without evidence. Keep the original unmanaged workflow limitation visible until the complete connected replacement passes the batch acceptance gates.

## Independent design review findings — disposition

The independent source review identified three important gaps. They are NOT resolved by documentation or the existing tests; implementation/qualification remains blocked on them:

1. Current workload contracts/verifier do not bind the environment claim or protection revision. A later approved implementation must introduce an explicit immutable environment/profile reference in new proposals and qualified source snapshots, require the exact signed environment, and recheck current protections. Existing records remain readable as history but cannot gain this new execution qualification. Reject omitted/substituted environment, stale profile and old manifests; do not silently reinterpret historical hashes.
2. The existing workload runner passes the same incoming JWT to STS. One audience must therefore be established against the real role's trusted client ID and Axiom verifier together. No second-token exchange exists. Missing qualification refuses; selecting an invented Axiom-only audience is not a working solution.
3. A released GitHub job possessing a token accepted directly by STS might bypass Axiom entirely. The environment hold does NOT establish exclusive credential custody. A qualified prevention of direct exchange/alternate native writes is a prerequisite, not supplied by job approval, a session policy chosen by Axiom, or local ledger tests. Do not enable this profile until a separately reviewed custody design and actual trust evidence close this gap. No IAM change or new token-broker design is authorized by the present design-only grant.

Review outcome: same-run hold is feasible as an additional human gate, but this connected execution design is NOT ready for implementation approval or live activation. The next design must close the direct-exchange custody boundary rather than claim the GitHub hold completes Governance. Continue other already-approved local workflow work without weakening these blockers.


## Subsequent source disposition — local, not live qualification

The separately owner-approved private-issuance and supplier units now address the local environment/protection and JWT-to-STS coupling omissions. Actual native trust/custody/protection/fleet/time remain unavailable. Original review/history above stays intact; source-grounded next local scope is EXACT-RUN-HANDOFF-LOCAL-IMPLEMENTATION-REVIEW.md. No handoff implementation, active workflow replacement or live setup follows from the original design-only permission.
