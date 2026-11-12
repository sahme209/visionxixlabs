# P01 platform Governance — scope accepted, implementation proposed

## Owner decision and authority

The owner selected “Include all three in Governance scope”: Axiom production deployments, template hosting and growth publishing. This resolves the scope question only. It does not authorize production changes, spending, provider calls, new credentials, deployments or external posts. Existing genuine review and owner-click rules remain. P01 must remain an uncovered readiness blocker until actual enforcement and acceptance exist.

## Source inventory

Inspected from the source containing merged offline AI PR #325; no provider accessed.

| Family | Entry and actual effect | Existing authority and gap |
| --- | --- | --- |
| Platform site deployments | `app/api/leads/trigger/route.ts`, `[id]/preview/update`, `[id]/deploy-preview`, `[id]/publish` → `lib/previewDeploy.ts` → `lib/deploy/provider.ts`: Vercel deployment POST | Starter/admin checks differ by route. Platform service credentials are not customer-workspace Governance authority. Preview is also a real write/cost, not a harmless read. |
| Axiom's own production release | Owner-click Vercel procedure in CODEX_HANDOFF section7; repository build/deploy workflows | An application wrapper cannot enforce a person using an external dashboard. Require exact source/CI/schema/owner receipts, state the external administrative trust boundary honestly. No new deploy automation. Existing manual scripts/workflows are inventoried separately below. |
| Operational deployment scripts/workflows | `.github/workflows/axiom-deploy-aws-ecs.yml` uses OIDC then ECS update-service and a second rollback update; `scripts/setup-vercel-env.mjs` changes platform settings then redeploys; `scripts/setup-oauth.sh` also triggers production redeployment | These are real administrative effect paths, not application wrappers. Include exact workflow/script revision, target, source and any separately approved compensating action; unknown deployment must not automatically grant rollback authority. Do not run or modify them under this design approval. |
| AWS template hosting | `app/api/aws/quick-deploy-url/route.ts` GET → `lib/cloud/aws/templateHosting.ts`: STS lookup, S3 bucket creation/object upload, signed GET URL | A valid externalId is not platform mutation approval. Cache/head failure can reach a write. Credential selection, cache hit, operator override and upload must all respect the eventual scope boundary. |
| Growth post publication | Admin publish route and `app/api/cron/linkedin-publish/route.ts` → `lib/growth/linkedin/posting.ts` | Admin/cron and draft status are current behavior, not an independently approved immutable effect plan. |
| Growth operational scripts | `scripts/delete-linkedin-post.ts` directly DELETEs a post; `scripts/force-publish-now.ts` advances scheduled publication | Both belong in managed growth coverage. Deletion and schedule changes need their own exact effect approval, not reuse of a publish decision. |
| Growth image publication | `app/api/cron/linkedin-daily-drafts/route.ts` → `lib/growth/linkedin/imageUpload.ts`: initialize upload POST then binary PUT | Draft generation itself can have external effects before final post publication; each effect needs identity, claim and unknown-result handling. |

Source inventory is bounded to these known paths, not proof no additional provider write exists. Final implementation must inspect direct network/SDK dispatch and workflow entrypoints, not just these callers.

## Approach and rationale

Proposed: a separate platform-scope authority with three explicit families, reusing existing exact review, durable claim/history and current-authority conventions. No fabricated tenant organization, inferred workspace, browser-provided approval or automatic cron authority. Reusing customer enrollment would misattribute ownership. A blanket permanent disablement would contain effects but would not deliver the requested governed workflow.

This is the recommended design, not yet owner-approved implementation.

## Proposed staged implementation

1. Pure contract and source map: exact scope `platform`, family, immutable payload/source digest, actor/reviewer identity, target, expiry and one-use claim. Define the platform owner/role supplier from real existing authority; no silent new role/grant or invented organization row. If existing storage cannot faithfully represent it, stop for a separately reviewed schema design.
2. Mount refusal at managed final effect boundaries before credentials/provider construction when authority is absent. Keep reads/preparation distinct, but do not let cache hits or operator overrides imply approval. Initial local containment must be explicitly approved because it changes availability; do not change production flags.
3. Connect exact plan → independent review → requester execution → current authorization → atomic claim → one final send → observed outcome. For image initialization/upload, bucket creation/object upload and other multi-effect work, record each child effect under the exact parent plan and stop on uncertainty. Never replay a consumed claim or release unknown liability as failure.
4. Cron may execute only an already reviewed exact scheduled plan within its expiry and current policy; a cron secret/draft status alone cannot manufacture human approval. Preserve real actor attribution.
5. Own production deployment remains an owner-click external operation. Provide prepared evidence and record actual result; no claim of preventing arbitrary out-of-band dashboard actions. Do not change GitHub/Vercel permissions or spend controls to make coverage pass.
6. Only classify an individual managed family covered after default composition tests prove bypass refusal, current authority, revocation, exact payload, expiry, concurrent/duplicate claims, unknown outcomes and no retry. Keep P01 blocked if any family or external-release qualification remains unsupported. No list-entry deletion as a substitute for enforcement.

## Validation and acceptance

Local pure/mock tests first. Actual owned isolated SQL only under existing permitted fixture setup. All provider effects simulated; no production/native resource qualification inferred. Test every entry above, direct helper use, warm cache, force refresh, upload-before-post, scheduled/admin callers and credential/network call counts on refusal. Preserve safety notifications and unrelated tenant operations. Final independent source review, complete normal CI and living documentation are mandatory.

Live trials, installed roles/resources, exact production releases, template writes, social uploads/posts and spending remain separate owner-authorized steps. No automatic external action is part of this proposal.

## Remaining decisions before useful execution

Exact platform-role/independent-review supplier and storage representation must be source-verified during design preparation; no new authority is assumed. External dashboard coverage is an administrative trust boundary, not an application-enforceable guarantee. Scope is resolved; these implementation facts are not yet qualified.

## Review refinements and concrete first implementation unit

Independent source review identified the deletion/force-schedule scripts above. Growth plans must bind exact connection revision, account/author, fully rendered post payload, media and destination; the current latest-connected-account lookup must not substitute a different account after review. Upload destinations/redirects require bounded validation before bytes leave. Signed template URLs are access grants even when cache/override avoids an upload: bind exact object bytes/version, recipient scope and expiry. Settings, deployments, deletion, schedule changes, signed access and rollback are distinct effects; preserve one attempt and explicit SDK retry limits.

Proposed first connected unit (local code/isolated tests only):

- A server-owned platform authority reader reuses existing admin allowlisting plus current authenticated User identity, requiring a stable database user ID and fresh session; no email fallback as a durable principal. Both requester and independently distinct reviewer must remain currently authorized. A cron identity can execute only its exact pre-approved scheduled action; it cannot approve. No new platform role or allowlist setting is provisioned.
- Use dedicated LOCAL schema definitions for platform action and append-only event records rather than abusing the mandatory organizationId in DurableAgentWorkflow. Exact platform scope, family/effect/target/payload digest, version, requester/reviewer, expiry, status/attempt and sequence must be bound. Unique claim/version guards and transaction rollback preserve one attempt; unknown cannot become reusable. Production migration SQL/apply is excluded and requires a separate precheck/apply/verify decision.
- Build pure plan/review/claim/currentness kernels, real isolated repository transactions and server-only composition. Do not mount an allow path or remove P01 until the entire relevant managed default flow and all bypass routes pass. Refusal mounting changes availability and is included only in a separately approved local implementation, never production activation.
- Reuse existing session/audit and review conventions, not customer-role membership or a synthetic tenant. UI proposal/review/execution must show exact platform target/effect and separate human decision from execution; no generic client approval boolean. Live UI/session/native qualification remains separate.

These are proposed technical choices for owner design review, not an already accepted authority grant. Existing tables/identities/settings remain unchanged.
