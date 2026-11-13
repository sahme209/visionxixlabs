# Connected real qualification — design preparation, not implementation authority

November13; source basis is merged f689a3e9 / PR327 over PR326. Owner requested real security qualification/end-to-end/enablement and then chose a minimal setup/cost proposal after the opened us-east-2 ECS inventory showed zero clusters. No provisioning, spending, implementation of a new trust boundary, credentials, native experiment or production operation follows from this document.

## What the source actually does

- `nativeCustodianSupplier.ts` supplies real fixed native HTTP only through an injected `NativeCustodianQualification`. Its source comment expressly says no production qualifier exists. Matching a role, URI, digest or profile object is insufficient.
- `workloadRunner.ts` already composes real claim → source/credential liability → private AssumeRole → one ECS transport. Missing qualification refuses before use. Reuse this path; do not create a second execution/approval ledger.
- `privateStsIssuer.ts` records source acquisition after `beforeSource` and before derived STS dispatch; actual source and derived expirations remain distinct. It never accepts a GitHub JWT as an AWS credential. Retain opaque credential ownership and final currentness checks.
- `operationalRequestService.ts` currently supplies unavailable source/profile defaults. The prepared human HTTP handler is unregistered. A cloud task alone cannot create a usable genuine human workflow or complete Governance.
- `custodianClosureObservation.ts` requires genuine complete lifetime/source/fleet evidence and trusted time past `credentialNotAfter`. That time cannot be earlier than a recorded issued lease's actual expiration. Neither task shutdown, the test's wall deadline, an operator's policy ceiling nor a normally six-hour ECS credential lifetime proves closure of an unknown acquisition.
- Existing `ecsObservation/taskDefinition.ts` and its pinned registration schema can reconstruct task-definition identity. `sdkObservation.ts` reads exact service/task definitions/images using bounded fixed-region clients and no retries. It does not inspect the running issuer's complete process/task identity; do not label it as that proof.

## Target boundary

Keep two distinct qualification lanes. Existing Mac origin/Keychain/installed-native qualification remains mandatory for its own covered executors. The proposed Linux/Fargate platform custodian is a separately reviewed P01 profile, not a port-by-flag or a replacement for the Mac trust boundary.

The platform lane must trust an exact immutable build and actual provider-controlled task identity, with an authenticated current observer/control path outside the user/model/request body. The web/AI/GitHub job receives only action metadata/results. AWS source and target credentials stay inside the fixed executor. Separate task identities—not containers sharing one task—must isolate an unprivileged fixture database and target workload from issuer-role capability. No public shell, ECS Exec, arbitrary command/image/env override, SDK credential chain or writable source-tree fallback is proposed. Whether each requested protection is natively supportable remains to be verified, not inferred from SDK field names.

Account administrators and AWS control-plane operators remain explicit trusted/break-glass actors, not secretly claimed as intercepted by Axiom. This does not relax source integrity, current policy, genuine independent approvals, one-attempt execution, unknown history, credential custody or the existing native qualification matrix.

## Smallest coherent full-test topology

1. One fixed execution task, provisionally 1vCPU/2GiB, running only the closed compiled private executor and its qualified initializer. No arbitrary agent/model code runs here.
2. A separate isolated PostgreSQL fixture task, provisionally 0.25vCPU/0.5GiB, with no application task role. It owns a fresh synthetic database; never production Neon. Private network access only from the exact executor; setup/admin bootstrap remains distinct from the restricted runtime database role. This sizing is a proposal, not proven sufficient.
3. A distinct disposable ECS target service/task, provisionally 0.25vCPU/0.5GiB with no application task role, so a real reviewed deployment can run and reach a measured native terminal state. An accepted update against desiredCount0 is not a healthy-deployment trial. Replacement concurrency, lifetime and health checks must be explicitly bounded in the run packet.

The initial one-worker price in MINIMAL-SETUP-AND-COST-PROPOSAL.md excludes items2/3. Do not present it as the full end-to-end bill. Before a real run, confirm effective native permissions, exact component/image digests, private fixture bootstrap, bounded networking/egress, observer identity, exact signed job source and real human login/review path. Use no NAT gateway, load balancer or managed database by default; if any becomes necessary, stop and revise the design/quote rather than silently add it.

## Required supplier evidence and source joins

| Existing seam | Actual supplier must establish | Refusal conditions |
| --- | --- | --- |
| `assertQualified` | Exact current sealed runtime/profile, provider task and source/target trust, closed executor coverage and recorded source generation | Test callback, matching JSON/hash, unselected task or incomplete coverage |
| `capture` / `assertCurrent` | Private immutable association of this running task/process to exact image/role/source URI/generation; origin/liveness and current approved source | Environment/HTTP-selected URI, changed image/command/task, lost observer/native origin |
| `clock` | Protected current interval and bounded freshness, not a user-supplied timestamp or an unchecked local clock | Unknown/stale/reversed interval |
| `assertSourceLeaseCurrent` | Complete current recorded and physical source/derived capability inventory, including native renewal/vending and earlier generations | Empty application ledger used as fleet proof, untracked/unknown lease or unsupported cutoff |
| Original source/identity/target ports | Provider-backed repository/run/attempt/workflow/environment and exact disposable ECS target; no permissions minted by selection | Source/run mismatch, stale independent review, revoked current principal, unqualified native target |
| Closure observation | Native issuance cutoff and complete relevant lifetime evidence, fresh trusted time and exact original snapshot | Task STOPPED or policy cap treated as universal expiration, erased unknowns or a reusable old receipt |

The exact native authority source for task/process identity, fresh protection and trusted time is still a design gate. AWS metadata's role/expiration payload does not cryptographically attest the whole Axiom process or prove fleet completeness. Do not implement `assertQualified: async () => {}` or import any fixture supplier as a production default.

`maximumExpiresAt` must have a reviewed authoritative meaning before a real adapter is built. A maximum permitted by operator policy can reject an overlong returned credential; it cannot prove all unknown credentials expire by that time. Preserve this distinction. Do not invent a six-hour universal wait or an early-revocation mode unsupported by the current closure contract.

## Genuine application end-to-end gate

Before the positive write trial, real requester and distinct real reviewer must authenticate through the actual accepted test identity mechanism, see the exact target/source/plan and approve personally. The requester then executes via the actual client/HTTP/private runner, with current permissions and independent review rechecked. Test fixture tokens, manually edited database approval rows, developer callbacks and the agent acting for a human do not prove this.

The current unregistered human handler and unavailable source defaults therefore need an approved qualified composition plus a test-only registration/delivery plan before this trial is runnable. Production registration, schema, feature enablement and owner deployment remain separate. No new sign-in provider, public endpoint, role grant, real credential or customer read is authorized here.

## Finite acceptance sequence

1. Finish exact main CI observation and preserve PR326/327 receipts. Do not rebuild unchanged source solely for this design.
2. Verify the missing public platform contracts, then independently review the complete runtime/profile/fixture/identity source design. Ask for local implementation scope only after this concrete design is ready.
3. Implement the connected qualified source, initializer, current evidence reader and test delivery composition with actual existing stores/executors; ordinary/intercepted tests and one coherent PR before effects. Preserve current default refusal until native acceptance.
4. Freeze exact current Linux artifacts and all setup/precheck/test/readback/owned-cleanup operations, account/region/resources, permission diffs, budgets and limits. Review actual artifacts before asking for specific native/provider/resource authority.
5. After that approval, provision only the owned isolated resources and run one bounded security qualification: actual source/process protection/custody, unchanged image, forbidden alternate caller, revocation before claim/send, concurrent/replayed request, cancellation and original unknown recovery. Stop on unsupported/unknown results; do not reuse the invocation.
6. After real runtime/source qualification and genuine human decisions, execute one expressly authorized disposable deployment; separately verify the actual native result. Prove no second send after lost reply/reload. No automatic rollback/redeployment.
7. Keep any unknown liability and its original history. Observe valid closure under the existing native contract; a stopped task alone is insufficient. Freeing compute does not erase outstanding credentials.
8. Complete all other covered executor/native/product-family and independent security acceptance requirements. Enable only the scope proven by fresh complete receipts under explicit owner production/schema/deploy/flag authority. One AWS test never proves full Governance.

## Public contract research needed before specification can be approved

At most three official AWS pages: task-metadata-v4 response identity fields; task-definition runtime/protection parameters; ECS Exec's permissions and filesystem/process implications. Read public text only, no account/resource API, credentials, download/install, workflow, new grant, provisioning or spending. Cached SDK types establish serialized field shapes only. Existing task-role/supplier documentation review is reused; do not repeat its consumed research allowance or claim a universal credential maximum.

## Source-research outcome and selected direction

The three owner-approved AWS public reads are consumed and recorded in AWS-PROTECTION-SOURCE-REVIEW.md. They support a fixed Linux task profile with explicit non-root/read-only-root/capability-drop and no ECS Exec. Native metadata can report task/image identity; it is not a signed whole-process grant. Keep external control-plane matching and the actual protected runtime requirement.

Do not implement a standalone bare-Node probe as the next deliverable. It would not be the actual compiled consumer; a later runtime-image change would require repeating qualification. Build one coherent current-source image/initializer/private executor and exercise protection observations inside its finite qualification plan, initially without effect credentials. Full DB/target/identity/source integration remains in that same completion plan. The alternative is retained in ROLE-FREE-NATIVE-PROBE-PROPOSAL.md as not selected, not as an approved smaller replacement.

The actual trusted-time source is the remaining concrete design question. A candidate is a fixed direct TLS-authenticated AWS service response Date observation, bracketed by monotonic request/receipt timing and checked against the protected process clock; this would not be hardware timestamp attestation. Before proposing that source, verify the exact HTTP Date semantics, origin/intermediary and approximation limits from the official HTTP standard. Do not assume an exact provider clock error bound or instantiate a permissive clock callback. A public documentation read does not authorize a native clock request or adopting this candidate.

## HTTP Date result

The single approved RFC9110 read is consumed. HTTP-DATE-SOURCE-DECISION.md rejects the header-only candidate for bounded clock authority: the standard does not provide a numerical maximum UTC error, and round-trip timing cannot supply that missing bound. No native clock request or code was run. BOUNDED-TIME-RESEARCH-SCOPE.md proposes verifying an existing authenticated bounded-time implementation instead of inventing an interval. This preserves the original clock/expiry requirements and full connected runtime goal.


## November13 — bounded-time research consumed; native Fargate candidate identified

The owner-approved six public reads are complete; findings and exact sources are in `docs/recovery/2026-11-13/real-governance-qualification/design/BOUNDED-TIME-SOURCE-ASSESSMENT.md`. The Fargate-specific metadata page documents ClockDrift/error/synchronization fields missed by the earlier generic-page review. Prefer qualifying that native source in the actual compiled executor. Do not infer a trusted current interval from those fields alone: sample freshness/growth, protected origin and runtime-time composition remain unresolved. Cloudflare's inspected Roughtime implementation warns against production use and reports older draft compatibility; no automatic adoption. ClockBound is an alternate EC2 candidate, not proven Fargate/macOS support.

This supersedes the earlier pending six-page request only. No new dependency, trusted key, clock query, code/default supplier, cloud resource, credential, native experiment or spending. Full Governance remains incomplete and disabled; production schema/target/recovery and all existing genuine-review/runtime/closure/coverage/owner gates remain. The next research should resolve native Fargate sample/freshness semantics, not implement a fake bounded-clock callback. No repeated suites/builds or production operations occurred.


### Two additional AWS clock reads completed
Owner-approved Fargate on-demand clock-check walkthrough and EC2 time overview are now recorded in BOUNDED-TIME-SOURCE-ASSESSMENT.md under the November13 qualification design. AWS supports consulting the native error bound before critical work, but the inspected pages do not specify maximum sample age/growth; leap handling and ReferenceTime/ReferenceTimestamp semantics remain profile-review issues. Stop this documentation-search sequence rather than request repeated pages or run unapproved probes. Review the native-provider trust decision as part of the full connected runtime; if insufficient, present the EC2/ClockBound topology/cost alternative. No code, new trusted source, endpoint query, runtime/resource/credential, production action or spending; full Governance remains incomplete.
