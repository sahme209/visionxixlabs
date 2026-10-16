# Axiom Agent complete mission tracker

Audit: 2026-10-15. Baseline: main `6eb90680815a7c235e7d31ece1c6638dfa44708d`.
Owner: Codex for engineering, design, architecture, governance, product quality,
documentation, QA and launch coordination. Founder retains external accounts,
customer commitments, financial/production approvals and final acceptance.
The current workstream matrix and latest checkpoints supersede earlier historical
checkpoint status; previous observations are retained as evidence history.

## Current authentication checkpoint — preflight #3 and access readiness

Protected read-only preflight #3 identifies a configured Neon endpoint. Founder
canonical account and accepted personal membership passed; seven migrations remain
pending, the unfinished Agent migration references absent Organization, and auth
email-verification schema is missing. This does not prove actual login, desktop
pairing, administrator authority or the serving Vercel deployment's database binding.
See `docs/mission/auth-preflight-run-3.json` and the auth-only recovery plan.

Neon tools are now connected. Read-only control-plane and schema/history checks
confirm the reported project/default main branch/database, PostgreSQL 17, six-hour
retention and matching preflight fingerprint: 99 completed migrations, no active
source checksum mismatches, same seven pending migrations and absent auth schema.
The active failed Agent attempt began October 14, outside the configured window.
No saved snapshots or snapshot schedule entries were returned. Ten branches meet
the reported ten-branch limit; nine are Vercel-created previews. This blocks new
branch creation and the planned isolated restore copy. No branch was deleted,
plan/retention changed, credentials retrieved or production data/history modified.

Serving deployment/preflight resource bindings, a usable fresh pre-repair recovery
point and isolated restore remain unverified. Metadata access is not permission
for Time Travel resource provisioning, restore, migration or routing changes.
See `docs/mission/neon-readiness-inspection.json`. Earlier tool-unavailable
checkpoints below are historical. Independent workstreams continue.

## Scope coverage — explicit answer

**Every responsibility in the available original Codex project handoff and the
former Claude design/architecture/governance scope is represented.** The
[original uploaded handoff](AXIOM_ORIGINAL_PROJECT_HANDOFF.md) is now preserved
alongside the unchanged [unified mission](AXIOM_UNIFIED_MASTER_MISSION.md),
[latest scope supplement](AXIOM_SCOPE_AUDIT_REQUEST.md), and older decisions/plans.
The old ownership split is superseded: no work is reserved for Claude or Cursor.

**We cannot confirm every requirement of the older original 36-section build
specification.** Its expected verbatim file
`docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` is absent.
The supplied handoff refers to it but does not contain it. Exact section-27
scenarios A–L are also unavailable. There are explicit placeholders for all
36 sections and all twelve scenarios; the referenced file was also absent from
all fetched Git history in this non-shallow repository. Templates and inferred requirements are
not substituted for missing source. Recovering that text is a source blocker,
not a reason to stop independent engineering.

The [editable register](mission/requirements.json) and
[complete row table](AXIOM_MISSION_REQUIREMENTS.md) contain **1,745 source units
and placeholders across 15 available sources**. Each has a status, source
location, domain, scope, evidence, verification limit, owner and next action.
The register includes process controls and historical proposals as well as
product requirements. Related source files are **not** acceptance proof.
Coverage is complete for the extractor's prose/list/table units; individual
acceptance review remains explicitly pending on many rows. Code examples are
reference artifacts, not separately inferred acceptance requirements.

Source verification: the uploaded unified prompt (28,298 bytes, 24 sections)
is byte-for-byte identical to `docs/AXIOM_UNIFIED_MASTER_MISSION.md`
(SHA-256 `f1dc19f102970688b068458854fcde787ad4aab3a19b17886a8622fbf513727f`). The older missing 36-section specification
is a separate referenced source; it is not silently substituted by this file.

Run `python3 scripts/axiom-mission-tracker.py --check` to detect dropped source
units, changed source text, invalid states, missing evidence paths or stale
rendered tables. Edit assessments in JSON, then run without `--check` to render.
Do not regenerate assessments from test counts or automatically promote states.

## Completion estimate and evidence rules

There is **no defensible whole-product percentage yet**. The earlier ~85% was
not audited, original scope is missing, and no exact-current full customer
journey has passed live acceptance. Reporting a new percentage would imply
evidence we do not have. The row distribution is a coverage/review inventory,
not a weighted readiness score: historical plans and repeated directives must
not inflate a completion denominator.

Use the five requested states:

| State | Meaning |
| --- | --- |
| Implemented and verified | The precise stated assertion has executable evidence; record whether automated, provider or exact-package evidence. Never generalize it. |
| Implemented but not validated | A current implementation is located, but required acceptance is not established. |
| Partially implemented | Subcomponents exist; the full behavior, integration or individual acceptance review remains incomplete. |
| Missing | A specific implementation gap was found; cite the search/boundary and avoid treating a historical TODO as proof. |
| Blocked by external access | Exact source, account, device, credential, service diagnosis or approval is unavailable. Independent subwork remains eligible. |

Baseline evidence: PR #116 exact head `93d5c70b` passed GitHub run
`38762756384`; 537 files / 5,291 tests, web TypeScript, desktop frontend
TypeScript/build and 30 Python CLI tests passed locally. Native tests/clippy
last passed in PR #112; this does not validate current macOS packaging.

## Current incident, repository and deployment evidence

Full detail: [repository snapshot](mission/repository-snapshot.json).

| Item | Observed evidence | Next action / gate |
| --- | --- | --- |
| Production login | Current deployment has one credentials and one Google callback P2022 log in the latest one-hour grouped query. Sign-in and providers return HTTP 200; credentials/Google/GitHub/Cognito are registered. | Active incident. Read-only schema/ledger/founder preflight, then a concrete approved repair and real browser round trips. Provider registration is not login success. |
| Production database | Runtime has no DATABASE_URL; authenticated CLI dispatch of the protected preflight returned Forbidden before starting a run. Earlier isolated replay fails at workspace-agent migration's Organization reference. | Inspect actual applied/failed ledger and schema; never blanket `migrate deploy` or rewrite historical SQL speculatively. |
| Founder account | Existing identity/membership/plan mapping remains unverified. | Use founder-confirmed email only in protected configuration; never publish it, bootstrap privileges or equate commit authorship with app identity. |
| Main deployment | `dpl_3bPWbdEvNzys5iuArS9cHH6r5DgF` READY at `6eb90680`. | Continue exact-build health and authenticated checks. |
| Public routing | Fresh alias read now points visionxixlabs.com to the same current-main deployment. Earlier #106 routing snapshot is historical. No routing change was made by this audit. | Verify future aliases independently; routing is no longer the currently observed mismatch. |
| Preview provisioning | #116 preview `dpl_5N3hAckrtd6VJQktPAR5tNYo6tdQ` fails before build with Resource provisioning failed. | Platform diagnosis/support evidence needed; do not disable checks, reconnect integrations or change credentials speculatively. |
| GitHub/Vercel account mapping | Future author email was corrected to account-specific no-reply; GitHub and Vercel author evidence resolves sahme209, documented in VERCEL_GITHUB_AUTHOR_DIAGNOSIS.md. | Preserve correction; old history is not rewritten. Provisioning failure is independent. |
| Open PRs | Only unrelated Analytics draft #1 is open at baseline. #103–#116 are merged. | Review relevant new PRs fully; do not merge this old draft merely because it exists. |
| Branches | 96 live remote heads: 87 ancestor heads, nine divergent; one additional stale local tracking ref. | Divergent does not mean unfinished: inspect unique diffs/PRs and current implementation before reusing anything. No branches deleted or force-pushed. |

Nine divergent heads: `ai-website-build`, `codex/airflow-governed-automation`,
`codex/ecs-deploy-concurrency-guard`, `codex/governance-control-plane`,
`codex/governed-environment-rbac`, `codex/product-led-website`,
`codex/push-all-changes-20260930`, `marketing/advertise-ai-governance-integrations`,
and `vercel/install-vercel-web-analytics-f-r822hb`. Prior squash/alternate
integration can explain divergence. The complete SHA inventory is preserved.

Branch-to-PR search found merged work for Airflow (#52/#53), ECS concurrency
(#82), governance (#65), environment RBAC (#51), product-led website (#63/#64)
and marketing (#30). Direct checks show the Airflow cron restoration matches
current main, the ECS workflow parity test is already present, and governance
routes/identity policy already exist with subsequent hardening. These heads
must not be cherry-picked again merely because they diverge. The old website
builder and broad September push require a scoped diff review if a current
requirement points to them; neither is permission to restore obsolete UI.

## Detailed capability audit

These assessments summarize the source/test audit and point into the complete
register. A row can have tested kernels while the overall journey is partial.

| Capability / requirement | State | Evidence and limitation | Next engineering action |
| --- | --- | --- | --- |
| AWS connection, inventory and ECS | Partially implemented | `lib/axiom/provider/awsAdapter.ts`, AWS connector/scanners, `.github/workflows/axiom-deploy-aws-ecs.yml`, read-only validation workflow #99. Founder-reported ECS evidence is retained. | Exact tenant/account/OIDC target, rollout health, permissions and rollback on an approved nonproduction account. |
| Azure selection/auth/inventory | Partially implemented | `azureAdapter.ts` and SDK validation/preview code exist; not merely a provider dropdown. | Verify subscription inventory/permission errors and safe tenant contracts. |
| Azure deployment and rollback | Missing | Adapter applyAction/rollbackAction explicitly return notImplemented. | Design governed operation contracts; implement supported operations without claiming mutation from inventory. |
| GCP selection/auth/inventory | Partially implemented | `gcpAdapter.ts` and SDK validation/preview code exist. | Verify project inventory and permission/failure contracts. |
| GCP deployment and rollback | Missing | Adapter applyAction/rollbackAction explicitly return notImplemented. | Governed operation design and targeted implementation, then approved test-project validation. |
| GitHub discovery/branches/PRs/checks | Implemented but not validated | Tenant token resolver, githubWriteClient, release evidence and review-SHA checks; #108/#109 protections. | Real selected-repo install, revocation, expiry and minimum-permission test-org journey. |
| Terraform plan/apply/state/recovery | Partially implemented | Existing runner/planning plus default-deny legacy apply and governed contract. Plan generation is not execution. | Trace every reachable apply path, plan integrity, state lock and provider reconciliation; retain the kill switch. |
| Airflow 3 discovery/dependencies/scheduling | Partially implemented | Client, scheduler, executor and durable models. #107–#110 fix claims, stale approvers, uncertain outcomes and scheduled run identities. | Real endpoint contract, timeout/cancel behavior, receipt lookup and governed operator recovery. |
| AI Inspect/Engineer/DeepOps effort | Implemented and verified | `decisionLoop.ts` and tests verify 2/4/6 decision limits. | Preserve limits; verify real task/context/tool behavior separately. |
| AI SDK/Gateway/models/routing | Partially implemented | Gateway-only production manager, workspace policy, approved catalog/model selection, generation receipts. | Authorized provider journey, cancellation, policy revocation and usage attribution. |
| AI context/tool/proposal boundaries | Partially implemented | Repository evidence filters, captured review snapshots, tool allowlists and separate approval execution; #108/#109/#116. | Continue prompt-injection/context and lifecycle negative testing; no claim of universal prompt-injection prevention. |
| Prompt/system sensitive-data protection | Implemented and verified | #116's six failing-before/passing-after regressions cover final known-pattern redaction for composed instructions and direct calls. | Review remaining metadata/free-text/history retention separately; known-pattern matching is not universal secret detection. |
| Request intake and playbook generation | Implemented but not validated | Reachable DeploymentRequestsView → desktop API → request/playbook repositories; immutable snapshots, hashes, ten templates. | Exact safe-tenant UI/API/database journey. |
| Request revision, diffs/history, supersession | Implemented but not validated | Current reviseDeploymentRequest, expected-version CAS, history route/UI and regression tests already exist. Older missing-work lists are stale. | Validate existing behavior; do not build another revision subsystem. |
| Readiness/risk/approval/role separation | Partially implemented | Readiness/policy kernels, proposal approval, release gates and distinct capabilities. | Trace every operational adapter's current authority and immutable approved input. |
| Immediate/scheduled/conditional execution | Partially implemented | ECS workflow and Airflow orchestration exist; generic playbook lifecycle is broader. | One exact request-to-provider-to-validation journey before expanding provider write support. |
| Retry/concurrency/unknown outcomes | Partially implemented | Durable operation and quota ledgers, #107–#115 safeguards, no age-based release of unknown deployments. | Governed receipt reconciliation; distinguish safe retry from unknown acceptance. |
| Cancellation/emergency stop | Partially implemented | Local state/policy concepts exist; already-dispatched work cannot be assumed cancelled. | Trace queued versus in-flight authority, provider cancellation and startup observation. |
| Rollback/validation/evidence/closure | Partially implemented | Conditional rollback instructions, technical/functional owners and evidence-backed close handler exist. AWS rollback adapter can generate a plan, not prove executed recovery. | Validate real health/rollback evidence; complete full adapter-to-closure behavior. |
| Deferred validation | Partially implemented | Intake ownership/date/trigger/monitoring and explicit deferred state exist. | Durable follow-up/reminders and closure policy; do not label deferred completion fully validated. |
| KT/shadow workflow | Missing | Legacy KT-01 requires consent, sessions, evidence, questions and readiness; no first-class journey found. Consulting copy is not an implementation. | Design with existing tenant/permission/audit models, then implement focused lifecycle. |
| Word/PDF/Confluence exports | Partially implemented | Export-related modules and original requirement exist; exact format/open/versioned acceptance is not established. | Trace actual exporters and open generated files; verify provenance/version and tenant access. |
| Auth/session/pairing | Partially implemented | Credentials/OAuth, accepted-membership parity #105, one-time pairing, native return, secure storage and scoped transport. Login is currently broken by schema drift. | P0 preflight/repair; exact packaged start/approve/consume/replay/revoke/return tests. |
| RBAC/capabilities/tenant isolation | Partially implemented | Current-context, desktop resolver and permission/tenant kernels with negative regressions. | Complete caller-by-caller boundary audit, including revoked/pending membership and cross-workspace reads. |
| Credentials/SSRF/log minimization | Partially implemented | Context-bound vault, native fixed-origin transport, canonical redaction and explicit provider connection boundaries. | Remaining external-request, error/log, token rotation and restore-path reviews. |
| Enterprise identity/MFA/SCIM | Partially implemented | Historical Cognito evidence; designs/contracts and current schema/routes must be reconciled. Never infer tenant SAML/SCIM from a fixed OIDC provider. | Trace current implementation and actual IdP assertions; retain least-role and tenant binding. |
| Retention, backup and disaster recovery | Partially implemented | Policies/records are present in parts; no exact deployed restore exercise is established. | Map stores/retention/deletion and run an authorized isolated restore/incident exercise. |
| Gateway actual cost / 1.5× arithmetic | Partially implemented | Cost lookup and generation identity #113, pending ledger and margin kernel; 1.5× arithmetic separately tested. | Actual capped provider receipt reconciliation; disclose cent rounding, reserved caps and platform overhead. |
| Spending reservations / ledger replay | Partially implemented | Serializable AI/deployment/seat claims; #114 bounds uncertain Stripe retries, #115 excludes completed batch work. | Remaining concurrent failure/refund/reconciliation tests and authorized financial test-mode journeys. |
| Persisted invoice reservation binding | Implemented and verified | Four failing-before/passing-after worker cases enforce exact organization, usage event and billed amount before submission; valid retries keep their key and amount. | Validate actual test-tenant ledger evidence; contradictory records stay held for reviewed reconciliation. |
| Stripe subscription/webhook/refunds | Partially implemented | Canonical organization webhook, signature/idempotency/ownership controls and credit fulfillment exist. | Reconcile immutable customers, seats, refunds, renewals and invoices on isolated test customers. No live activation. |
| Public catalog / legacy plan policy | Blocked by external access | Unified source mentions Starter/Growth/Scale; newer catalog proposes Free/Pro/Enterprise; ADR-021 paid wall conflicts with current always-allowed pilot kernel. | Concrete founder product decision before access, prices or subscription migration changes. |
| Desktop reachable information architecture | Partially implemented | Seven customer destinations in App; dormant modules are not automatically navigable features. Native Settings/Models/shortcuts exist. | Measured reachable-view keyboard, back/focus, resize and error-state audit. |
| Chat/editor/diff/progress/recovery | Partially implemented | AgentChatView, RepositoryWorkspaceView, reviewed file proposals, usage receipt and deployment status observation. | Real context/proposal/resume/cancel journey; ensure no discarded or stale operator state. |
| Click-first selections and integration management | Partially implemented | Existing repository/environment selectors and service-mediated integration/skill controls. | Trace each selector through real inventory; preserve advanced controls and browser consent boundary. |
| Desktop typography/spacing/icons/animation | Implemented but not validated | Existing styles/tokens, icons and native shell; reduced-motion and focus styling already exist. | Real rendered screenshots/keyboard/contrast and exact-native acceptance; preserve established brand. |
| Desktop status truthfulness | Implemented but not validated | Follow-up changes the authenticated sidebar to Workspace connected; it does not assert paid/production authority from the current pilot kernel. | Verify actual rendered/native status; entitlement policy remains a separate founder decision. |
| Native install/menu/keychain/window/notifications | Implemented but not validated | Native modules and release CI, historical signed/notarized 0.1.11 evidence; source currently 0.1.20. | Exact current package and macOS ARM/Intel/Windows/Linux clean-host acceptance, not reused old-release claims. |
| Native automatic signed update/install/recovery journey | Missing | Pure autoUpdaterManifest/version-decision kernels and tests already exist. No active check/install/recovery wiring located in native main/config/Cargo or customer UI. README roadmap is not runtime evidence. | Reuse existing kernels for signed native update/recovery; publication/configuration remains gated. |
| Website brand, messaging, demo and screenshots | Partially implemented | Public route/components, scripted labeled demo and existing dark/orange tokens; prior claims audit. | Real current product imagery and route-wide screenshot/copy audit; no fabricated product operations. |
| Website account/team/integration/billing/governance | Partially implemented | Browser companion and service handlers exist; website is not a second operational control plane. Auth incident blocks the journey. | After login, trace each real companion action/permission and reconcile desktop/web ownership. |
| Website onboarding/pricing/download/support/legal | Partially implemented | Current routes, manifest, contact persistence and published docs; old plan/README claims conflict. | Exact current manifest/artifacts, email delivery, onboarding links and commercial terms acceptance. |
| Website SEO/responsive/accessibility/performance | Implemented but not validated | Layout metadata, robots/sitemap, mobile nav focus trap, reduced-motion provider, announced errors. | Render and keyboard-test representative widths, audit contrast/performance and actual public link/canonical behavior. |
| System design / contracts / durable scheduling | Partially implemented | Tauri/React/Next/Prisma split, pure kernels, IO boundaries, durable ledgers and existing ADRs. | Reconcile stale ADRs; complete durable observer/reconciliation and scalability evidence without selecting speculative infrastructure. |
| Former Claude journeys/IA/policies/risk/trust | Partially implemented | Unified mission sections 4–8, 13–18; current source, decisions, claim map and complete register. | Own incremental design plus policy/role and architecture review; never defer this to another assistant. |
| CI and release signing/SBOM | Implemented but not validated | Current web checks pass, historical native/security CI; desktop-release workflow already has SBOM, signing/notarization and publication gates. | Inspect exact release artifacts/provenance and native acceptance; do not add duplicate SBOM/signing systems. |
| Monitoring/incidents/support/customer feedback | Partially implemented | Runtime logs, incident kernels, support/contact and historical monitoring modules. | Real incident/restore/support-delivery drill, actionable alerts and privacy-reviewed feedback/activation metrics. |
| Self-service adoption/design partners/launch | Blocked by external access | Five-partner goal and onboarding/pricing strategy are documented; no invented commitments. | Login + one verified governed journey per partner, approved terms and operational support; founder owns commitments and launch. |

## Decision conflicts and preservation rules

- Older refactor plans propose deleting routes/models and introducing networking,
  orchestration or pricing changes. They are historical proposals, not permission
  to delete working systems or provision infrastructure.
- Product Vision's desktop operations/browser companion boundary is preserved.
  Older no-browser-auth statements and newer account-companion requirements need
  reconciliation against current routes; do not build a duplicate web console.
- ADR-021 paid access, current pilot behavior, public/legacy catalogs and old
  signup assumptions conflict. Record actual behavior; do not silently lock out
  accounts, activate checkout or grant production authority.
- Source version, published installer, native acceptance, READY deployment,
  public alias and authenticated operation are six different evidence claims.
- No certification, universal security guarantee, guaranteed profit, general
  exactly-once effect, customer logo or product metric without exact evidence.

## Execution queue and external acceptance

Priority update (2026-10-15): maintain all fourteen product workstreams in parallel.
Production login is the highest acceptance priority; its external gates do not stop
independent engineering. The canonical [register workstream matrix](AXIOM_MISSION_REQUIREMENTS.md#active-product-workstreams)
records active milestones, evidence scope, dependencies, blockers and next actions.
The six parallel implementation reviews cover desktop cancellation, signup proof
handoff, Agent revocation, monotonic credit refunds, ECS shell handling and Airflow
dependency dates. None establishes a complete real customer journey. Combined regression passed 549 files / 5,439 tests, web and desktop TypeScript,
desktop production build, Python 30 tests and changed-source lint. A recursive
test-fixture annotation caught by TypeScript was corrected and its focused tests
rerun successfully. Exact-head CI remains required before merge.
Fresh read-only domain inspection serves READY #134 main `153bacd4`; the prior
older-deployment observation is superseded without a routing change by this work. Major visual redesign
remains deferred. Recovery and release approval gates remain in
`CRITICAL_RECOVERY_AND_CUSTOMER_ACCEPTANCE.md`.

| Priority | Next concrete work | Independent work / external gate |
| --- | --- | --- |
| P0 | Production schema/ledger/founder preflight, proven repair and password/Google/GitHub login | Secure production runtime or protected workflow execution; any migration/data repair needs separate approval. No credential values in chat. |
| P1 | Desktop authentication startup/focus failure audit and truthful workspace status | Source/tests/UI work can proceed; actual native login requires recovered service and clean host. |
| P1 | Governed reconciliation of unknown deployment/Stripe outcomes | Design/read-only diagnosis can proceed; no provider replay, hold release or financial mutation without reviewed authority. |
| P1 | Remaining tenant/RBAC/request-boundary and financial concurrency review | Independent source/negative tests; real credentials/records needed for acceptance. |
| P2 | One complete AWS/GitHub/Airflow vertical journey, then Azure/GCP missing write contracts | Safe account/provider configuration and approved nonproduction operations. |
| P2 | Incremental desktop/web usability, keyboard/focus, first-run/error recovery and screenshots | Source/UI work independent; exact packaged/macOS and physical-device QA external. |
| P2 | Exact signed updater, export formats, deferred validation and KT gaps | Reuse existing models; prove need and contracts before migrations or new infrastructure. |
| P3 | Route-wide design/claims/performance and launch evidence | User/device/partner acceptance and commercial decisions remain founder-owned. |

Personal laptop is required for native macOS menu/focus/keychain/deep-link,
installer/updater/sleep/wake and clean-host acceptance. Cloud/Stripe tests can
also run in an approved isolated secure runtime; they do not inherently require
Mac storage. Missing credentials are access blockers, not requests to paste them.

## Audit execution notes

The first independent follow-up hardens the desktop startup response boundary:
HTTP failures cannot become success from a JSON flag, and malformed identity,
organization, roles, capabilities or access booleans return a structured failure
instead of throwing or passing truthy values into the shell. Credential kind
must match the verified response. Valid denied access remains distinct from
invalid identity; absent optional capabilities preserve backward compatibility.
The sidebar describes verified connection rather than claiming production
entitlement. This is a source/test repair, not production login recovery or a
change to pilot/paid policy.

Local Chromium was found, but two attempts with isolated writable profiles
timed out before producing a screenshot. No screenshot or visual-pass claim is
made. The Vite-rendered app would be frontend evidence only, not native macOS
acceptance. Repeat only after diagnosing the browser harness or using a working
authorized device. Current styles/native shortcuts were inspected in source.

Keep this document and per-row register current after each milestone. Mark the
specific assertion verified, record the exact candidate and test/live scope,
and continue the first independent priority instead of replaying stale plans.

## Dependency security follow-up

The [dependency audit](DEPENDENCY_SECURITY_AUDIT.md) records compatible framework
and image/source-map patches. Clean-install production audit findings fall from
six high/six moderate to zero high/two moderate. Remaining Google uuid/gaxios
findings stay open; zero registry findings would not certify application security.
Exact-head build/test and merge evidence are recorded in the focused PR.

Google follow-up: Storage 8.4.0 removes the remaining uuid/gaxios advisory
chain without a direct forced override. Web CI matches the existing Node 24
production runtime. GCP snapshot access-token handling now follows the SDK's
string contract; seven focused cases cover that boundary. Actual GCP IAM and
inventory acceptance remains open. See the dependency report for checkpoint
counts and the final zero-advisory scope.

Execution checkpoint: #117 (permanent register), #118 (desktop identity) and
#119 (framework patches) are merged. #118 and #119 automatic main deployments
are READY; the public alias was last read on #116. Main build readiness is not
public promotion or login acceptance. No manual alias change or SQL mutation
was performed. CLI workflow-dispatch access remains blocked by GitHub Forbidden;
no public-input or push-triggered bypass was introduced.

## Public route and metadata audit follow-up

Nine sampled routes (`/`, `/plans`, `/download`, `/docs`, `/support`, `/security`,
`/privacy`, `/terms`, `/auth/signin`) returned HTTP 200. The live docs HTML
repeats the brand title and incorrectly canonicalizes to the home page.
Metadata corrections cover docs, pricing, downloads, security and terms without
changing UI layout, legal text or billing gates. The [route evidence](mission/public-route-audit.json)
separates public observations from local build checks. HTTP/head checks are not
screenshots, browser interaction, installer or successful-login acceptance.
Cloud Chromium times out even on a blank-page capture; visual acceptance stays
unverified rather than being labeled a pass or a MacBook-only dependency.

Additional governance finding: `app/terms/page.tsx` derives “Last Updated” from
`new Date()` during rendering. That is not evidence of a policy revision or
approval. The metadata fix leaves legal text unchanged. Next action: establish
the approved policy version/effective date, then replace the moving date in a
focused legal-content review; do not invent an approval date from Git history.

## Billing reservation integrity follow-up

The [settlement binding review](BILLING_SETTLEMENT_BINDING.md) reproduces a
persisted reservation reaching invoice submission with the wrong tenant,
usage event, or amount. A pure predicate now blocks those four cases while
retaining existing reservations. Worker tests verify zero Stripe calls and
zero settlement/budget mutations for mismatches. Test-mode gates, valid retries,
unknown-outcome holds, pricing and the 1.5x calculation stay intact. Actual
provider/customer billing acceptance and held-row queue fairness remain open.

## Privacy-choice and development-tool audit follow-up

The existing reopening control remains. [Real DOM regressions](PRIVACY_CONSENT_VALIDATION.md)
cover blocked storage, cookie fallback, unsaved current-tab choices, cross-tab
withdrawal and retained SDK callbacks. An explicit refusal wins over an older
conflicting saved grant; actual browser/network privacy acceptance remains open.
Development-only DOM test tools leave production dependencies unchanged.

The [full dependency audit](mission/development-dependency-audit.json) records
nine existing development-tool package findings: seven high/two moderate,
unchanged before/after the DOM tools. Production-only findings remain zero.
Review compatible upstream fixes and separately validate any CSS/lint framework
migration; a zero production-only audit never closes the wider security scope.

Execution checkpoint: #117–#122 are merged with READY main builds. Public
routing last advanced automatically to #120; no manual promotion occurred.
The old Analytics draft #1 was closed as superseded after confirming current
main mounts Analytics through the existing consent condition. SQL preflight,
founder identity and successful account login remain unverified.

## Held billing candidate selection follow-up

Following merged #122 (reservation binding) and #123 (privacy resilience), the
billing selector also applies the existing bounded retry policy before LIMIT.
Submitted, held, stale, future-dated or contradictory reservations cannot crowd
out newer eligible usage. Shared retry-age constant and final per-row authority
checks preserve the existing security boundary. No holds or quota are released.
See `docs/BILLING_SETTLEMENT_BINDING.md` and executable candidate SQL tests.
Disabled-account, exhausted-budget and repeated eligible failure fairness remain
partially implemented; real Stripe test-tenant acceptance is still blocked by
external access. Production login/founder preflight remains independently blocked.

## Production-login priority and budget selection checkpoint

Production authentication is the highest priority. Fresh 24-hour production log
counts: credentials 6 / Google 5 / GitHub 2 P2022 errors, with missing
`User.emailVerifiedAt` confirmed. This identifies the observed failure but does
not replace inspection of the actual migration ledger and founder mapping.
The protected preflight dispatch returns Forbidden before run creation; secure
runtime database access is absent. Required external action is documented in
`docs/AUTH_LOGIN_RECOVERY_2026-10-15.md`. No migration is proposed for approval
before that report. Real founder password/OAuth sessions and desktop pairing
remain unverified. The domain still selects READY #123; #124's main build is also
READY. Provider registration/callback-host checks pass; login acceptance does not.

Independent billing work extends #124 to exclude disabled accounts, missing
customers and fresh events without current-month capacity before LIMIT. Exact
capacity and previously reserved retries at a spent cap pass SQLite/PostgreSQL
fixtures. Serializability, per-row configuration and fresh retry-time checks
remain authoritative. Repeated eligible provider failure scheduling and actual
Stripe test-tenant invoice/refund journeys remain open. All available Codex and
former Claude responsibilities remain represented; the absent older 36-section
source remains explicitly blocked rather than reconstructed.

## Durable billing retry rotation

#125 is merged after exact-head CI run 38790618715 passed. A separate retry
follow-up persists attempt metadata before provider IO and orders candidates by
last attempt/update, so repeated eligible failures rotate behind waiting work.
Five regressions failed before and pass after; SQLite/PostgreSQL one-row fixtures
show the next waiting event is selected after a failed retry's timestamp moves.
No new columns or migration, financial hold release, key reset or retry-window
extension. Missing/concurrent attempt-marker writes forbid Stripe submission.
Actual Stripe test-customer/refund/replay acceptance remains externally blocked;
full live billing and provider exactly-once guarantees are not claimed.

Desktop source audit also identifies overlapping focus verification requests and
automatic vault deletion on verification failure as a remaining recovery risk.
This has not yet been repaired or validated; preserve authenticated access gates
and add deferred-response regression evidence before changing that lifecycle.

## Desktop saved-credential lifecycle follow-up

The identified startup/focus verification race is addressed in a dedicated
coordinator: newest request and current immutable credential context only,
explicit transition invalidation and disposal. Current failures lock the active
transport without automatic vault deletion; accepted workspace access remains
server-verified. Eight deferred-response tests and first-run wiring checks cover
the scoped lifecycle. See `docs/DESKTOP_AUTH_VERIFICATION_LIFECYCLE.md`.
Actual macOS/keychain/deep-link and founder production pairing remain unverified;
manual sign-in submission lifecycle is not claimed repaired by this change.
#125 is merged with READY automatic main build; #126 exact-head CI passed and
merged, with its automatic build tracked separately. No production DB mutation,
OAuth credential change, live billing or manual domain promotion occurred.

## Database-hosting discovery follow-up

#128's recovery proposal is merged after both exact-head CI jobs passed and has
a READY automatic main build; no production recovery SQL was executed. Current
non-sensitive integration/project metadata cannot establish the database host.
The existing protected preflight now classifies only its configured endpoint
inside the secure runtime, without returning any connection identifier or secret.
Backup, restore and website/maintenance target binding remain explicitly
unverified. A provider name alone cannot satisfy the restore-readiness gate.
The proposed restore procedure is documented, but no provider-specific procedure
or real production-data restore is claimed verified. No provisioning or database
mutation is part of discovery. All original mission scope and open tasks remain.

## Follow-up authentication and deployment authority checkpoint

Independent source review found two admin website deployment APIs lacked their
existing API-level admin guard, and explicitly unsupported cloud selections could
silently deploy to Vercel. The focused correction preserves public signed-token
lead flows and the existing admin allowlist. Email-proof consumption and identity
verification now share one transaction, preserving the link on modeled identity
write failure. See `LEGACY_WEBSITE_DEPLOYMENT_BOUNDARIES.md` and
`EMAIL_PROOF_ATOMIC_RECOVERY.md`. Integrated checks passed 552 files / 5,487 tests, web/desktop TypeScript, desktop
build, Python 30 tests, mission checks and changed-source lint (pre-existing unused
placeholder warnings only). Exact-head CI remains required before merge; no
production/provider actions were performed. Actual customer login,
PITR/binding verification, provider readiness and resend/callback UX remain open.

## Durable desktop credentials and subscription replay checkpoint

PRs #135 and #136 are merged with applicable exact-head CI passed. PR135 main
build is READY; preview builds still fail resource provisioning before compilation.
No preview protection or provisioning configuration was bypassed.

The exact keyring 3.6.3 source confirms that the previous bare dependency selected
a mock backend, so earlier compile/tests did not prove persistent credentials.
Explicit native backends and a fail-closed mock guard are now implemented, with
no-vault builder tests. Prior mock migration may have removed a legacy value;
recovery must use authorized pairing, never fabricated tokens or privilege grants.
Actual installed-package/native-vault acceptance remains open.

Subscription-event replay now uses the existing durable ledger and plan write in
one Serializable transaction, preserving current policy. Distinct-event ordering,
actual provider collection and inconsistent entitlement policy remain open. See
`DESKTOP_NATIVE_CREDENTIAL_BACKENDS.md` and `SUBSCRIPTION_EVENT_CONSUMPTION.md`.
Combined regression passed 553 files / 5,497 tests, web/desktop TypeScript, desktop
build, Python 30 tests, lint and tracker checks. Two isolated Rust backend-selection
tests passed without vault access. Exact-head full native CI remains required
before merge; actual platform acceptance is still open. No vault, production
database, secret, infrastructure, routing or live-billing action occurred.

## Website verification recovery and deployment readiness checkpoint

PRs #135–138 are merged after applicable exact-head CI, including full native
tests and Clippy for the credential-backend fix. The recovery milestone reuses
the existing resend API through shared website controls, preserves only strict
navigation context through email proof, and keeps account-specific delivery
failures publicly neutral. It does not establish a session or authorize pairing.

Legacy preview/publication now uses exact provider-reported readiness and saved
receipts; bounded authorized observation and conditional local commits preserve
working previews and reject stale results. The internal admin workflow exposes
pending state and refreshes through its existing authority. No major redesign,
new schema, infrastructure, deployment dispatch or production record operation
is performed by this work. See `EMAIL_VERIFICATION_CUSTOMER_RECOVERY.md` and
`WEBSITE_DEPLOYMENT_READINESS.md`. Combined checks passed 560 files / 5,595 tests, web/desktop TypeScript, desktop
build, 30 Python tests, lint and mission checks. Full optimized web production
build compiled and generated 293 pages successfully. Exact-head Test run
38814815293 passed for da163066; PR #138 merged as
3df6d03f92d2eaa198ba021adfda86825c2c1a32. The preview failed before compilation
with Resource provisioning failed; no check or infrastructure protection was bypassed.
Its automatic main production build dpl_DdQu4nKjbsETe61AwFPPwMwfvacH is READY
for merge commit 3df6d03f92d2eaa198ba021adfda86825c2c1a32. The last custom-domain
inspection still resolves to #134; READY is not proof of serving identity or login. Actual email/provider/customer acceptance, background notification,
provider-create crash recovery and concurrent submission serialization remain
open; production binding, usable PITR and restore gates remain unchanged.

The same website checkpoint closes missing admin API authority on legacy lead
regeneration and tier mutation, using the existing administrator guard before AI
or data access. Public selected-tier capture remains intact and is not treated as
verified paid entitlement; see `LEAD_ADMIN_GENERATION_AUTHORITY.md`.

## Customer recovery continuity and authority checkpoint

The next integrated milestone closes reachable customer recovery failures:

- Verified desktop browser/key recovery now persists credential and active choice
  in one vault envelope. Restart cannot silently restore an inactive key; selected
  missing/corrupt credentials fail closed. Explicit sign-out writes a tombstone
  before legacy cleanup. Pre-commit cancellation and stale callbacks are guarded;
  already-started native writes are not promised cancelable. Actual OS-vault and
  signed-package acceptance remain unverified.
- Credit Checkout now sends the required workspace/SKU intent key and consumes
  the actual redirect field. Lost provider responses retain pending intent for
  late signed fulfillment; only the uniquely created intent dispatches. Existing
  uncertain intents are held for reconciliation because original request parameters
  are not fully stored. Tab/reload intent storage is not global duplicate prevention.
  Composed mocked provider tests are not actual Stripe acceptance.
- Signed handoff issuance refuses caller-asserted plan/approval/checksum authority
  until a server-owned artifact can be resolved. Approved tenant HCL downloads and
  unsigned remediation previews remain functional; no local execution is enabled.

See `DESKTOP_DURABLE_CREDENTIAL_RECOVERY.md`,
`CREDIT_CHECKOUT_UNKNOWN_OUTCOME_RECOVERY.md` and
`TERRAFORM_AIRFLOW_CUSTOMER_ACCEPTANCE.md`. Integrated validation and exact-head
CI must pass before merge; customer acceptance remains explicitly unverified.
Combined local validation passed 565 files / 5,652 Vitest tests, web/desktop
TypeScript, desktop production build, 30 Python CLI tests, lint and tracker checks.
The first sandboxed run could not collect local Python SQL-fixture children
(EPERM); the unchanged fixtures and full suite passed with process permission.
No tests were excluded and no production runtime was accessed.

The cloud audit in `CLOUD_CUSTOMER_ENROLLMENT_ACCEPTANCE.md` distinguishes
existing website token enrollment and real SDK reads from blocked desktop
connection and simulated/missing execution. Follow-up SELECT-only catalog checks
confirm CloudAccount/CloudProvider absent and connector lifecycle tables present
on the inspected Neon target. This does not prove the serving application binding
or authorize cloud schema changes. Keep that storage proposal separate from the
narrow authentication repair. Capacity resolution, isolated restore verification,
auth DDL/ledger, provider acceptance, native publication and routing each retain
separate approval boundaries. All fourteen mission workstreams remain represented;
no major visual redesign or production mutation is included.


## Recovery continuity merged checkpoint

PR #139 merged as 699d0197a347b6ca8408c5fa57bdf9433d57e2a8 after exact-head
Test run 38816816547 and Desktop CI run 38816816536 passed for c7697044,
including native command tests and Clippy. The Vercel preview again failed
before compilation with Resource provisioning failed; no check protection or
infrastructure setting changed. Actual production/native/Stripe acceptance
remains open. The owner confirms serving/preflight binding is not yet verified;
this blocks production recovery execution, not independent engineering.

A parallel AWS enrollment milestone is in progress across scoped server IO,
additive isolated schema fixtures and the reachable desktop Settings integration
UI. Identity verification, bounded single-region inventory and generic Agent
execution are distinct. New accounts must not enter the legacy unscoped Lead
credential path. Cloud schema is a separate reviewed proposal, never an implicit
addition to authentication-only SQL approval. No production migration, IAM change
or actual cloud API call is authorized or performed by this development work.


Latest read-only alias observation supersedes the earlier #134 serving checkpoint:
visionxixlabs.com now points to READY #138 deployment
dpl_DdQu4nKjbsETe61AwFPPwMwfvacH (main 3df6d03f). The #139 main build
dpl_CChjdeohkNxhkBmYXMTmzBBKiTvr is also READY. No Vercel promotion/routing
tool was invoked. The actor and automatic-assignment policy remain unverified;
READY/source merges must not be represented as approved production acceptance.
Pin the then-serving revision again before private binding verification and any
reviewed release. Further integration must respect the explicit production release
boundary if automatic assignment cannot be excluded.


Read-only deployment events now explain the custom-domain source lag: a manual
promotion to #138 occurred at 22:27:11 UTC; per-deployment alias lists confirm
visionxixlabs.com stays on #138 while READY #139 owns two other aliases. No
rolling release/config is returned. This supersedes unknown-actor/source-lag
hypotheses above, without attributing the operator or guaranteeing future auto
assignment. Source integration continues through the existing Git pipeline;
deliberate custom-domain promotion still requires explicit approval. Sanitized
evidence: `docs/mission/vercel-release-inspection.json`.


## Scoped AWS desktop enrollment and inventory checkpoint

The reachable Settings integration now composes paired tenant authority, an
existing-role challenge, broker-only bounded STS identity validation, scoped AEAD
storage and a separate one-region EC2 page. It returns at most five instances,
labels incomplete/truncated scope and withholds stale results after account,
credential, session or membership changes. No IAM writes or simulated connected
state is introduced. Generic Agent scans remain disabled for these accounts;
legacy Lead-backed credentials are not adopted. Disconnect and the secure Agent
snapshot bridge remain separate engineering milestones; Azure/GCP remain unavailable.

New-account count is enforced against the canonical plan inside the same
Serializable transaction as challenge consumption and creation. Revalidation
does not allocate a slot. Storage errors fail closed. A real PostgreSQL 17.11
last-slot experiment with two distinct account inserts committed one transaction,
rejected the other with P2034 and left one account. This proves database predicate
behavior, not live customer/provider acceptance. The existing desktop commercial
policy remains deliberately identity-only; resource limits are not a claim that
paid subscription gating is enforced.

The additive cloud storage proposal passed isolated PostgreSQL 16/17 fixtures
and the full-history auth rehearsal. Original auth and failed Agent SQL hashes
are unchanged; new source pending counts include the unapplied cloud proposal.
No production schema or migration history changed. CI now has separate PostgreSQL
17 auth and enrollment fixture jobs, without production secrets/environments.
See `AWS_ENROLLMENT_SCHEMA_PROPOSAL.md`, `DESKTOP_AWS_READONLY_ENROLLMENT.md`,
`lib/cloud/aws/enrollment/README.md` and the sanitized fixture evidence.


Legacy boundary review also closed an existing autopilot tenant-authorization
gap: current accepted membership now gates mode/event reads, and accepted
owner/admin plus same origin gates mutation. Client organization IDs do not
grant authority. Scoped cloud credentials cannot be enabled/escalated through
legacy controls or scanned through direct/queued paths, even if a stored flag
is forced on. See `LEGACY_CLOUD_CONTROL_AUTHORITY.md`. New source tests do not
prove the pinned serving build contains this security fix.

Integrated validation for the AWS enrollment and legacy authority milestone:
573 test files / 5,798 tests passed; web and desktop TypeScript, optimized web
build, desktop build and 30 Python checks passed. New feature/API/test lint is
clean. The two touched legacy scanner files retain exactly their existing
26 lint errors and eight warnings; `mission/aws-legacy-lint-baseline.json`
records the comparison. Isolated PostgreSQL evidence is separate from production
restore readiness. Production binding remains explicitly unverified by the owner;
no migration, routing, credential or live-billing change is authorized.

## PR #140 integrated — scoped cloud connection milestone

PR #140 merged as `1cb21007e6f88d353a2f24a2938a246a6e42cbc2` after exact-head
`21540bf9154e2ca837796df41073f44cf371d339` passed Test run 38820824242,
Desktop CI run 38820824224 (native tests/Clippy), and isolated auth recovery
run 38820824270 (both PostgreSQL 17 jobs). Local evidence remains 573 files /
5,798 tests plus web/desktop builds and 30 Python checks. Preview provisioning
failed before compilation; no protection, capacity or deployment configuration
was changed. The automatic main deployment `dpl_DcKZ4QJGUQNoAHNcXCR3zBshyGJQ` subsequently
reached READY; the custom domain still mapped to #138 at the post-merge check. Source integration is not deployed acceptance.

Active independent work: version-bound local credential disconnect/reconnect;
wrong-browser-account desktop pairing recovery; coverage-aware Agent read-tool
planning; and actual Stripe test acceptance preparation. The bounded EC2 sample
must not enter the legacy full-account snapshot/drift/cost analyzers: unknown
metrics, incomplete coverage and missing samples cannot establish absence,
savings, backup state or deployment readiness. Existing scanner guards remain.
See `STRIPE_TEST_CUSTOMER_ACCEPTANCE.md` for proposed isolated actions and gates;
no provider-backed billing exercise is authorized or completed.

The owner reports the production binding is still not verified. The existing
read-only finding is preserved; production repair, recovery resources and domain
promotion remain separate approval gates. No repeat access request was issued.


## Active customer recovery integration after #140

Paired owner/admin disconnect now atomically wipes locally saved AWS configuration,
advances the credential version, records revocation and expires tenant/account
challenges while retaining the account/quota/history. It does not revoke provider
roles, trust or issued STS sessions. Fresh STS verification is required to reconnect;
late inventory and pending/precommit UI refreshes cannot restore old access. The
separate nullable revocation-column proposal is not part of auth-only recovery.

Browser pairing now provides an explicit account switch preserving the strict
pending callback. It signs out the browser only and still requires fresh identity
and explicit device consent. Google selection is requested in this flow; GitHub
SSO remains separate and is explained. Real cross-account/provider/native acceptance
is outstanding. Full integrated checks are underway; focused tests and disposable
PostgreSQL 17 revocation evidence passed, without production/provider actions.

Integrated local validation: 576 files / 5,849 tests, web and desktop TypeScript,
desktop build, targeted lint and 30 Python checks passed. The final optimized web
build is running at this source snapshot; its result and exact-head web/native/
isolated PostgreSQL CI must be checked in the focused PR before source merge.
This evidence does not establish production recovery or provider/native acceptance.

## PR #141 integrated — connection and pairing recovery

PR #141 merged as `99abab9faf99b0ae91a283db2f86721535187468`, after exact-head
`5a7a93a7db6e510fab1220789afa0a676fa1cc00` passed Test 38822320124,
Desktop CI 38822320133 (native tests/Clippy) and both isolated PostgreSQL 17
jobs in 38822320202. Final optimized web build passed with 293 generated pages;
local regression was 576 files / 5,849 tests. This supersedes the prior pending
build note. Preview provisioning again failed before compilation; no capacity,
protection or routing setting changed. Actual provider/native acceptance remains
outstanding.

Next cross-workstream integration: governed incomplete AWS observations, guarded
current-subscription reconciliation and native version-alignment checks. Never
cast a bounded EC2 sample into a complete snapshot or permanently disable a
conversation's independently authorized later deployment flow. Subscription
reconciliation must fence stale provider responses against current tenant binding,
validate the exact supported seat price and never infer event ordering from
second-resolution timestamps. New native publication remains unauthorized; review
candidate-only builds and immutable, separately approved publication before
replacing any existing release asset.

A further real customer-journey gap was identified: existing ECS force-new-deployment
restarts the current task definition rather than binding an approved new artifact.
An immutable source/image/task-definition/target receipt and demonstrable rollback
contract must precede claiming an end-to-end release. No workflow was dispatched.

## Governed observations, subscription freshness and native identity integration

The allowlisted paired Agent now reads scoped AWS observations through the actual
inventory service, retaining connection version, incomplete coverage and unknown
costs/metrics/backups. The current bounded-read request cannot propose a write;
later operational requests retain their independent authority checks. Historical
tool facts are explicitly not snapshots, approvals or deployment evidence.

Subscription events now trigger exact current-provider retrieval with canonical
configured per-seat price validation. A final Serializable binding/token/existence
fence prevents stale responses from overwriting newer local state. Failures remain
unconsumed; unexpected replacement needs reconciliation. No timestamp ordering,
new schema, billing opt-in or commercial-policy change was introduced.

Release source preflight now checks npm, Tauri, Cargo and lock identities through
actual negative command fixtures. This does not validate installed bundles or
publish a release. The native candidate/publication plan and immutable ECS release
plan record the outstanding launch and deployment prerequisites.

Local integration: 579 files / 5,938 tests passed, plus 36 final route/demo checks,
desktop TypeScript/build, targeted lint without errors and 30 Python checks.
Four existing unused-argument warnings remain in decision-loop tests. Full web
TypeScript will be rechecked after the optimized build regenerates its type tree;
required exact-head CI and the optimized build remain gates before source merge.
The #141 automatic main deployment reached READY; deliberate custom-domain
promotion and actual customer authentication are still unapproved/unverified.

## PR #142 integrated — governed observations and subscription freshness

PR #142 merged as `823f5df13fd25ca8b3df46fc8d237f98612e122f` after exact-head
`2e43b5b49b93a3b84075b146c336bf998a3f2202` passed Test 38823359304 and
Desktop CI 38823359318, including native tests and Clippy. Optimized web build,
full web TypeScript after generated files stabilized, desktop TypeScript/build,
30 Python checks and 5,938 tests passed. This supersedes the prior pending build
note. Four pre-existing test lint warnings remain, with no new lint errors.
Preview provisioning failed before compilation; no protection/capacity setting
was changed. Merged source is not real customer/provider/native acceptance.

The two original user-uploaded handoff/unified mission documents were retrieved
and re-read. They exactly match the repository copies after outer-whitespace
normalization: 192-line original handoff and 829-line unified mission. Their
existing requirement coverage remains intact; no duplicate source was added.
The separately referenced older 36-section specification and A–L scenario text
are not contained in either upload and remain explicit unavailable-source gaps.
See `mission/mission-upload-revalidation.json` for non-sensitive source hashes.

## Immutable native candidate guard — source review complete

Tags and ordinary manual release runs now default to candidate-only output.
Publication additionally requires explicit opt-in, an external readiness
attestation and the release environment; actual reviewer protection, key setup
and publication authority remain unverified. Exact source, clean tracked lock
inputs, platform/SBOM manifests, hashes, intended public signing key and remote
asset digests are checked. Only a newly claimed public tag/new draft may proceed;
existing releases/assets and unknown API outcomes fail closed. No overwrite,
version bump, tag, signing credential change, dispatch or publication occurred.

Build-app checks are not shipped-installer proof: artifact-level macOS trust
stays false, with separate build-app evidence. The actual website manifest
consumer test refuses the notarized/fully-ready claim. Packaged-app, vault,
clean-host installation, update/upgrade and real release acceptance remain open.
Independent review accepted the final source with these limits. Root checks:
32 files / 326 relevant tests, including 33 workflow guard cases with fake GitHub
responses and disposable synthetic GPG keys; full web TypeScript, targeted lint,
YAML parsing and release alignment passed. Exact-head full/native CI remains
required before merge; no unchanged web build was repeated for workflow/docs.

The refreshed existing priority matrix fulfills the specific planning deliverable
with separate value/effort/risk/differentiation/readiness; it does not establish
competitive superiority or customer acceptance. The read-only Neon capacity
inventory found retained Vercel aliases for every preview, including archived
branches: zero verified-unused branches and no deletion/upgrade authorization.

Final dependency-default correction: the upstream SBOM action enables release
asset uploads by default. The candidate job now explicitly disables that path,
and its repository contents token is read-only. An additional actual-YAML
contract test covers both restrictions and absence of Tauri release inputs.
The updated 34 guard tests and lint passed; exact new-head CI must replace the
prior-head result before merge. No release workflow was dispatched.


## PR #143 integrated — native candidate publication safeguards

PR #143 merged as `fef79a0eed15c8251dd46560e2e42f140b8c7177`.
Exact-head Test run 38825492060 passed 580 files / 5,972 tests, and Desktop CI
38825492086 passed native tests and Clippy. This supersedes the pending-CI
notes above. The final 34 workflow guard cases explicitly cover disabling
the SBOM action's default release upload and candidate read-only permissions.
Preview provisioning failed before compilation; capacity and routing were unchanged.
Actual packaged installer trust, OS vault/upgrade behavior, configured release
reviewers and publication approval remain open. No release was dispatched.

## ECS customer evidence correction — integration underway

Existing four-input workflow dispatch requests an ECS service restart; an installed
workflow filename does not attest actual behavior. Responses and desktop/web views
separate requested intent and raw workflow outcomes from unknown source artifact,
application health and recovered-image proof. Historical receipt rows carry no
verified artifact contract. Completed prior runs cannot authorize ECS artifact
promotion. Independent review found and then confirmed closure of emergency and legacy-dashboard
promotion-policy gaps. Focused regressions assert zero reservation/dispatch on denial.
Broader dashboard branch/CI/approval/quota parity and post-dispatch lifecycle
ordering remain separate unresolved legacy dependencies. The versioned immutable artifact release remains an engineering milestone,
not completed by receipt wording or mocked tests.

The operator's latest serving-database comparison is explicitly **not yet verified**.
No new access question or production approval is inferred. Neon metadata/schema
equality cannot establish the serving deployment's binding. Fresh usable recovery
point, approved isolated restore and exact auth-only execution approval remain
required. All independent workstreams and unavailable-source placeholders remain
in the canonical register; no real end-to-end customer journey is yet verified.

Integration validation so far: 582 files / 5,985 tests passed, followed by
68 focused final promotion/demo tests and 54 final rendered UI/Agent tests.
Web/desktop TypeScript, desktop optimized build and 30 Python tests passed.
Changed source lint excluding the existing releases page has zero errors and
four pre-existing mock-argument warnings. The releases page retains its baseline
three set-state-in-effect errors and one unused-import warning; no suppression
was added. Optimized website build passed with 293 generated pages. Exact-head CI remains required before merge.


## Additional workstream — Vercel cost optimization (2026-10-16)

Owner requests a manual-only deployment strategy without changing GitHub pushes,
PRs, required CI or normal verified source integration. Investigation runs in
parallel with existing priorities; the serving website and login recovery gates
remain intact. No executable Vercel configuration, settings, routing or integration
change is authorized. The plan must verify manual builds/deployment of an exact
approved commit, resource/environment effects, separate routing approval and a
reversible trigger-control change before owner approval.


## PR #144 and #145 integrated — ECS limits and manual Git deployment control

PR #145 merged as `275eec9aef910193cec32dadc9ceb445393d2219`, after
exact-head run 38828352714 passed web types, 5,972 tests and the new GitHub
production build (293 pages). The only Vercel configuration change is
`git.deploymentEnabled: false`; all 29 crons and other fields are unchanged.
No Actions workflow dispatches Vercel. The owner confirms no deploy hooks.
PR SHA and both subsequent main merge SHAs returned zero Vercel deployments;
the first post-merge observation at 00:22:37 UTC retains domain deployment
`dpl_6cv75StHTFg1enN1xPYRuLEcXzoX` (#143), superseding older #138 observations.
Covered revision suppression is observed, not a guarantee about old branches,
external callers or zero runtime cost. See the sanitized trigger audit.

PR #144 merged afterward as `364b048d5b13d762170c7e86882f0cfacc1e847c`;
its exact-head web CI passed 582 files / 5,988 tests, with native tests/Clippy
passing. Unsupported ECS artifact promotion is denied across the corrected
paths; existing workflow outcomes remain distinct from artifact/health proof.
No provider workflow or production database operation was executed.

An optional project-level Ignored Build Step `exit 0` and explicit per-deployment
manual override are prepared in `VERCEL_IGNORED_BUILD_APPROVAL.md`. That setting
remains unapplied and requires owner approval plus the current saved-value
record. The documented bypass is not real deployment acceptance. Direct Git
connection, production credentials, callbacks, domain and existing integrations
remain intact; production binding/PITR/restore and actual login remain unverified.

## ECS v2 first implementation slice — pure evidence, no authority

The next contract validates detached structural candidates and compares them to
independent trusted boundary inputs. It binds repository/build/executor identity,
immutable container images, proposed/baseline task definitions, target, policy,
approval expiry and exact run/attempt receipts. Independent review caught missing
prior-repository promotion binding; wrong-repository/fork regressions now pass.
Root full regression: 583 files / 6,051 tests, including 63 contract tests.
Final web TypeScript, desktop TypeScript/build, 30 Python tests and focused lint passed. The unchanged application build is covered by the new GitHub production-build gate; exact-head CI remains pending.

This does not enable ECS v2 or verify cryptographic provenance. Durable storage,
approvals/claims, exact-task health observation, trusted OIDC workflow distribution,
common dispatch service and actual sandbox rollout/recovery remain unfinished.
All fifteen workstreams stay represented; no end-to-end customer journey or
overall production-readiness percentage is asserted.


## Current integrated customer-governance milestone (2026-10-16)

PR #146 merged as `f22006e09a7110d3859cbec9beb5d56ce658c8d7` after
exact-head CI passed 583 files / 6,051 tests and the production build. GitHub's
required-check status briefly lagged completed runs; normal merge succeeded
only after the gate cleared. No bypass or Vercel deployment was performed.
Owner chose **repository control only**: the unused ignored-build proposal is
reference material, with no provider setting change authorized. Vercel work is
secondary and does not block product engineering.

The next integrated source milestone closes concrete public execution/approval
bypasses: dashboard restart now uses current accepted admin authority, exact
tag/source policy checks, scoped GitHub installation and policy snapshots, shared
quota/idempotency and a serializable release claim before provider invocation.
Unknown acceptance, commit and receipt outcomes retain claims/holds; original
accepted-action auditing remains best effort. Readiness freshness is not artifact
or durable approval proof; required approvals/windows unavailable to this legacy
path fail closed. ECS v2 storage/trusted ingestion/execution remains unfinished.

Approval form, JSON, bulk and snooze mutations consume only actionable tenant-
scoped revisions atomically, record actor/time, require current role and same
origin, and cannot resurrect terminal decisions through a sibling endpoint.
Concurrent losers do not emit success audits. JSON list/history reads are tenant
scoped; ordinary accepted members retain read access. Failed execution recovery
requires a separately reviewed workflow instead of replacing terminal approval.

Actual integrated synthetic local HTTP acceptance passed on committed source
`f7de88f0c0d5cffe0d15234534453c4068e41d9c`: eleven signup/proof/password/session/
workspace assertions, ten desktop protocol assertions (device binding, explicit
approval, cookie-free single consumption, replay denial, membership, listing and
revocation), and four approval decision assertions (foreign-origin denial,
competing 303/409, persisted actor/time and terminal retention). It used real
Next routes, PostgreSQL17, CSRF/cookies and loopback SDK mail capture; owned
fixtures and servers were removed. Approval headers use actual Next loopback
normalization, explicitly synthetic HTTP metadata rather than browser evidence.
See `docs/mission/local-auth-http-acceptance.json`. Production migrations/login,
external mail, Google/GitHub OAuth, browser/native/vault, real cloud deployment/
rollback and Stripe acceptance remain unverified. The existing desktop response
allowed identity access with no billing plan; paid-entitlement enforcement is
NOT verified and its policy decision remains separate.

Airflow's existing latest-success dependency policy is preserved. Strict business-
partition correlation needs an explicit per-rule policy and compatible, separately
reviewed storage/configuration rollout; no hidden policy or unused strict kernel
was added. The concrete next design is recorded in the Airflow proposal.
Production database target binding, usable PITR and isolated restore remain
unverified; no production recovery, secrets, routing or live billing action
is authorized by this milestone. All fifteen workstreams and unavailable
original-source placeholders remain represented.


### Parallel customer-boundary work prepared for the next integration

The `codex/customer-boundary-integrity` candidate assembles four independent
changes for integrated review; it is not merged:

- Authentication/desktop: consent links must match the configured service origin,
  exact challenge and intent; changing origin aborts the attempt. Evidence:
  `docs/DESKTOP_BROWSER_PAIRING_CANCELLATION.md` and
  `lib/desktop/__tests__/desktopPairingCancellation.test.ts`. Actual OS browser,
  signed-package vault recovery and production authentication remain unverified.
- Agent/governance: ECS restart approval binds a server-observed environment and
  target revision, with pre-dispatch revalidation and visible target review.
  Evidence: `docs/AGENT_ECS_RESTART_APPROVAL_BINDING.md` and
  `lib/axiom/agentRuntime/__tests__/restartTargetPreview.test.ts`. This is current
  service restart intent, not immutable artifact release or verified rollback;
  final provider races and credential attestation remain separate gaps.
- Airflow/automation: list and trigger receipts require exact DAG/run identity;
  malformed successful POST responses remain unknown. Scheduled reconciliation
  preserves the occurrence identity; manual unknown outcomes require inspection.
  Evidence: `docs/AIRFLOW_PROVIDER_RUN_IDENTITY.md` and
  `lib/integrations/airflow/__tests__/providerRunIdentity.test.ts`. Live provider
  acceptance and explicit business-partition policy remain outstanding.
- Billing/website: unavailable evidence is distinguished from genuine zero/empty
  values, while independently available usage and quota remain visible. Evidence:
  `docs/BILLING_EVIDENCE_AVAILABILITY.md` and
  `app/control/usage-billing/__tests__/page.test.ts`. This does not settle allowance
  policy or prove Stripe acceptance. Durable recurring Checkout intent/recovery
  remains a substantive separate blocker; prepaid-credit recovery is not a
  substitute.

Matching demo scenarios document these boundaries without changing their audience
or granting authority. Integrated local verification passed 594 test files /
6,234 tests, web and desktop TypeScript, desktop build, scoped lint, 30 Python
CLI tests, tracker consistency and whitespace checks. The isolated local
production build passed, generating 293 static/SSG pages with no production
database or provider credentials. This candidate still requires exact-head
required CI before merge. Initial PR #148 web CI exposed a missing root Tauri
notification test dependency masked by local desktop installation. The exact
`2.4.0` dev dependency and lock entry correct that clean-install boundary; a fresh
isolated locked three-package install typechecked the actual notification source,
and 24 focused approval/pairing tests passed. No runtime, schema or production
change is involved; corrected-head CI remains required.
PR #147 merged normally after both push and PR Test checks passed on exact head
`79686649b5640593ed90aacbb07a1d42d1cb22e0` (merge
`cca52dfb61534b8d96ac8a602d604b49c376fc66`; PR run `38833921557`,
job `116758638103`). That dependency verified 591 test files / 6,176 tests and
a 293-page local/CI build. Its local HTTP evidence remains attributed to source
`f7de88f0c0d5cffe0d15234534453c4068e41d9c`, not this candidate. Source-level and simulated IO regressions are
not browser, native, provider, financial or production customer acceptance. No
production database, secrets, infrastructure, routing or live billing changes are
included or authorized.

A read-only Vercel exact-head listing at `2026-10-16T01:17:20.158Z` returned
zero deployments for PR #147 head `79686649b5640593ed90aacbb07a1d42d1cb22e0`.
This is an exact-head observation, not a global deployment guarantee. No provider
deployment action was requested; repository-only controls remain intact.

The next ECS review-only core has a separate additive schema proposal and an
isolated PostgreSQL17 service/store rehearsal covering approval revisions,
revocation, tenant constraints and competing decisions. Execution stays explicitly
disabled, independently verified ingestion remains unavailable by default, and no
live quota is consumed. This is not executable release or rollback authority.
Production installation of that schema is not authorized.


## Deferred independent website task: supporter and partnership story

Owner requested 2026-10-16; **planned, not implemented; resume only after critical
engineering is stable and owner approves the content changes**. Existing page:
`app/(marketing)/support/page.tsx` (`/support`), with `SupporterCheckout`,
`SponsorInquiryForm` and the existing scripted `CinematicAxiomDemo`. No active
engineering agent was reassigned. This is a source-only content/security audit;
production payment delivery, legal eligibility and browser accessibility were not
validated. Existing dark/orange long-form storytelling and page structure remain.

Read-only findings: the page already distinguishes implemented/planned work, labels
scripted demonstrations, explains the for-profit company and explicitly disclaims
charitable tax deductions, equity and returns. It already separates one-time
supporter checkout from a no-payment sponsorship inquiry, but the latter combines
individual and corporate audiences; funding categories lack approved amounts,
budget periods or measurable milestones. Founder identity is intentionally withheld
until verified and approved. No verified sponsor, research partnership, security
certification, fundraising total or production-readiness claim may be invented.

Deferred content plan:

- Preserve the story; connect the founder motivation and independent-development
  thesis to dated, linked product evidence, separating local verification from
  production/provider acceptance. Use real approved screenshots only.
- Offer private individuals/philanthropic supporters a clear personal-impact story,
  milestone-based use of funds and an optional private substantial-support inquiry;
  retain the existing legally accurate supporter-purchase language and checkout.
- Give AI companies/technology partners a separate narrative and inquiry CTA for
  sponsorship, infrastructure/model credits and research collaboration. State
  proposed scope and evaluation criteria without promising access, endorsement,
  deployment authority, exclusive rights or commercial benefits.
- Publish only owner-approved funding objectives, time horizon, allocation ranges,
  progress cadence, delivery risks and accountability contacts. Recognition must
  remain consent-based; no funding-progress meter without an auditable source.

Security boundaries observed: same-origin and rate checks on inquiry/checkout;
length limits, honeypot and message secret redaction on inquiry; server-normalized
checkout inputs and Stripe idempotency; signed webhook verification and event
ledger; signed badge access with XML escaping and private/no-store headers. These
are inspected controls, not proof of complete payment security. Follow-up review
items: rate limiting is process-local; inquiry logs may contain provider errors;
checkout generates a fresh key on each submission; signed financial events need
explicit amount/session/currency and out-of-order-state regression evidence.
Updates are preselected despite opt-in wording; review consent/privacy copy later.
Do not change these payment/backend paths as part of the deferred content task.

Approval/validation gate: approve the content and legal/funding facts first; later
verify audience CTAs, accessible keyboard/mobile reading and truthful evidence.
Any payment-security remediation needs a separate focused review and existing
regression gates. **No Stripe checkout/webhook/billing changes, tax-deductibility
claims, major redesign, Vercel deployment or production changes are authorized.**

### PR #147 integrated milestone local validation

Final serialized regression passed **591 files / 6,176 tests**. Web TypeScript,
293-page optimized production build, desktop TypeScript/build, 30 Python tests,
tracker consistency and scoped lint passed (zero lint errors, two existing unused
imports). An initial unchanged native shell fixture exceeded five seconds under
compiler load and passed its isolated 34-test rerun. A concurrent Prisma generation
race invalidated a later test import; the final full run was serialized after the
build and passed with a bounded 20-second per-test allowance. These local validation
incidents are not suppressed application failures. Subsequent exact-head GitHub CI
passed and PR #147 merged, as recorded above. Real HTTP evidence remains attributed
to `f7de88f0`; later commits
only record documentation and results. No deployment or production change occurred.


## Pricing-to-application audit and safe wiring candidate

The existing `/pricing` route redirects to canonical `/plans`. Read-only source
audit covered the public catalog, legacy pricing/entitlement registries, Checkout,
signed subscription events, usage/credit reservations, refunds, quota/status gates,
portal management and desktop DTO/UI. Existing billing evidence and the full
commercial decision packet are in `BILLING_CUSTOMER_JOURNEY_ACCEPTANCE.md`;
uncertain recurring purchase recovery is designed in
`RECURRING_SUBSCRIPTION_INTENT_DESIGN.md`, with no schema/financial change enabled.

Safe source candidate restores Pricing in shared desktop/mobile navigation and
footer, preserves validated plan/interval through sign-in, requires a fresh
purchase click and binds the displayed workspace to fresh server authority before
seat counts or Stripe IO. Desktop billing management now requires current
owner/admin authority consistently with the browser; no-plan identity access is
no longer presented as an approved commercial trial. Existing billing activation,
prices, commercial access and support payment paths are unchanged. Integrated
validation passed 599 files / 6,307 tests, web/desktop TypeScript, desktop build,
30 Python tests, scoped lint and a 293-page local production build. Exact-head
CI remains pending; provider responses in component/route tests are mocked.

Important unresolved commercial disconnections:

- Public proposed Free/Pro/Enterprise allowances ($2 per organization/$10 per paid
  seat/$30 per paid seat) differ from enforced legacy $25/$200/$5,000 flat pools;
  inactive-status behavior and overage rules also differ. No policy was silently
  selected or existing customer reinterpreted. Owner approved the public catalog
  for newly created TEST subscriptions only on 2026-10-16, preserving existing
  customers unchanged; live activation and production migrations remain unapproved.
- Organization webhook updates `TenantBillingPlan`; older feature paths still
  authorize against `User.plan`. Desktop commercial policy remains deliberately
  identity-only. These are not verified purchased-feature provisioning.
- Recurring checkout lacks durable immutable intent/unknown-outcome recovery;
  portal price-only changes without matching metadata fail closed. Current
  subscription snapshots are not invoice-finalization/payment reconciliation.

Runtime presence-only inspection confirms no Stripe key, webhook secret or
DATABASE_URL; no Stripe connector is exposed. No credentials were retrieved.
Hosted Stripe TEST checkout, signed test delivery, current account provisioning,
renewal/failure/cancel/upgrade/downgrade and credit exhaustion remain **unverified**.
Public catalog selection for new test subscriptions is approved. Next gates are
reviewed version/status/overage/legacy compatibility and securely configured
isolated Stripe test prices/webhook/database. Test prices
must privately attest currency, quantity basis and actual amount, not merely IDs.
No live billing, production price, database, Vercel or support-payment change is
authorized. Deferred support storytelling remains independent and unimplemented.


The pricing candidate also corrects current-account credit reporting: read-only
RepeatableRead evidence matches the existing reservation engine's raw plan tier,
net eligible current/permanent add-ons, usage and all unresolved linked/pending
holds. It reports included allowance remaining, not spending permission or new
public-catalog entitlements. No legacy pool/status/charging policy is changed.
Known customer or subscription history (including canceled/past-due) is refused before a new
Checkout request, because replacement IDs are not yet a supported lifecycle. Five
regressions failed on the previous route; unknown concurrent initial purchase
recovery still needs durable intent. Support payment routes remain untouched.

## Durable ECS review storage candidate — no execution authority

PR #147 is merged as `cca52dfb61534b8d96ac8a602d604b49c376fc66` after both
exact-head Test runs passed; actual CI included 591 files and the 293-page build.
The next review-only core adds immutable application packets, append-only voter
revisions and recomputed checkpoints through parameterized Serializable storage.
Missing independent verification fails before persistence; current management
authority and selected policy are checked before provider-boundary IO and again
afterward. Execution is literally disabled, with no route, dispatcher or quota use.

Integrated contract/service tests pass 80 cases, TypeScript and Prisma validation
pass; the producer's real PostgreSQL17 lifecycle/revision-race rehearsal passed and
its owned fixture was removed. Independent source review found no material blocker
within this limited boundary. After merging main #148, final local regression passed 595 files / 6,251
tests, desktop TypeScript/build, 30 Python tests, lint and tracker checks. Exact-head
CI/build passed in PR #149; this source adds no runtime route.
Stored facts and checkpoints do not establish fresh provider readiness or atomic
execution/revocation authority. Trusted provenance ingestion, full policy handling,
execution claims and actual rollout/health/rollback remain unfinished.

The new additive SQL is a separate unapproved proposal. Relative to the original
observed ledger and this source set, expected pending proposals become 10 before
and 9 after auth-only repair; those are source expectations, not new production
observations. Generic `migrate deploy` can apply all eligible proposals: do not use
it for auth-only repair. Exact recovery SQL and checksums are unchanged.


PR #148 merged as `96fdef14e211a566242d31a5a18c5a1894b9b8d4` after exact-head
push/PR Test and Desktop CI passed, including 594 files / 6,234 tests and the
293-page production build. CI exposed a missing root notification SDK for actual
desktop preview tests; the explicit locked dev dependency and clean-install type
resolution fix passed on head `524cd566`. No Vercel deployment, installer
publication or production change occurred.


## Public catalog: bounded new TEST subscription integration

Owner approved the public catalog for NEW TEST subscriptions only, preserving
existing customer terms. The internal service uses immutable purchase intents,
unknown-outcome fences, exact account/mode/request provenance, and atomic applied-only
event consumption with actual application billing/usage/reservation models.
Independent read-only review resolved five material constraints before integration.
The coordinator reran 51 focused tests including four owned PostgreSQL17 journeys;
provider facts are synthetic, not Stripe signature/payment acceptance.
No runtime route, provider adapter, production schema or live billing is activated.

The existing reservation and subscription consumers preserve their default legacy
behavior. The new resolver runs before reservation replay and missing proposal
tables deny only the explicitly selected isolated lane. Exposing compatibility
rows to unmodified application endpoints would select legacy allowances; this is
not safe application activation. `NEW_TEST_APPLICATION_BRIDGE_AUDIT.md` records
concrete AI, feature, cloud, background, settlement and read-surface dependencies.
Actual Next/browser and hosted Stripe TEST journeys remain unverified.
Integrated validation passed 6,282 tests (four owned-PG tests skipped in the default
suite and passed separately), web/desktop types, desktop build, 30 Python tests
and lint on new code. The reservation file retains five pre-existing explicit-any
lint errors; the new callback is typed with Prisma types and introduces none.
Combined integration with main #150 and pricing #151 passed 6,353 tests
(four owned PostgreSQL tests skipped by default and passed separately), final web
and desktop TypeScript, desktop build and tracker checks. Exact-head CI/build
remains pending. No support payment path changed.
PR #149 merged as `7fd354e1d2a0fc0d2ec8fb3ccc9bd86566a00010` after exact-head
Test (push and PR), Desktop CI and isolated auth-recovery rehearsal passed. Actual
CI ran 595 files / 6,251 tests and built all 293 pages. The source-only review
migration is still unapproved for production; no provider or database authority
was enabled.


Pricing integration local application check (2026-10-16): the built Next server
was started only on loopback with checkout disabled. Actual HTTP `/plans` returned
200 with Pricing navigation and the no-charge preview; `/pricing` redirected to
`/plans`. The owned server was stopped afterward. This verifies rendered application
routing, not hosted checkout, OAuth, payment or paid entitlement provisioning.
The production build caught an optional page-props signature incompatible with
Next-generated types; corrected required props passed the focused tests and build.
No production deployment, provider call or support checkout change was made.
## Airflow current-condition dispatch candidate

PR #149 merged as `7fd354e1d2a0fc0d2ec8fb3ccc9bd86566a00010`; its ECS review
storage proposal remains disabled and unapplied. This candidate adds no schema.
The existing documented Airflow latest-run freshness contract now gates actual
write dispatch as well as proposal. Exact source identity/original terminal state,
configured success/failed/any condition and current latest dependency freshness
are reread before claim, GitHub token resolution or deployment allowance.
Unavailable/changed evidence leaves the execution unclaimed. Current connection
binding is reread after remote checks; the rule revision/connection are fenced in
the atomic claim. These checks do not atomically lock provider state or establish
immutable preproposal dependency/rerun evidence.

Evidence: `docs/TERRAFORM_AIRFLOW_CUSTOMER_ACCEPTANCE.md`, shared
`lib/integrations/airflow/dependencyReadiness.ts`, and executor claim regressions.
Three tests failed against the former executor because it still opened a PR after
source failure, dependency failure or unavailable Airflow; 81 Airflow regressions
and web TypeScript passed in isolation. Merged-main local gates passed 595 files / 6,265 tests, web/desktop TypeScript,
desktop build, 30 Python CLI tests, scoped lint and tracker consistency. The first
restricted-sandbox run blocked loopback sockets and native Git/GPG fixtures; the
final full run with normal local fixture permissions passed without source or test
changes (bounded 20-second test allowance). Exact-head push/PR CI and production
compilation remain pending. Live provider/customer acceptance remains unverified.
The optional strict-policy sidecar/readiness plan is documentation only; there is
no hidden configuration, schema activation, provider dispatch or production change.

Independent review identified approver revocation during the newly added remote
reads. Initial authority checks remain, and accepted membership/capability is
rechecked immediately before the claim. The new mid-read revocation regression
failed before this correction; the subsequent full local suite passed 595 files /
6,265 tests, web TypeScript and scoped lint. Prior unchanged desktop build/types
and 30 Python results remain applicable. The final post-read authority race is
documented; exact-head CI remains required before merging PR #150.


PR #150 merged as `0e383a44d8e5e5eab91febdd0135d9a96db3166f` after both
exact-head CI runs passed TypeScript, 6,265 tests and production compilation.
The pricing branch integrates those changes without replacing either tracker
section; provider/customer acceptance remains unverified.

Independent pricing review also identified customer-only Stripe bindings: starting
a new customer checkout would conflict with existing webhook ownership and risk
payment without activation. The new regression failed before correction. Checkout
now refuses either customer or subscription history before seat/provider IO;
existing customer terms and support payments are unchanged.

After integrating main #150, the combined local suite passed 599 files / 6,321
tests. The additional customer-only regression then passed with all 17 Checkout
route tests; final web TypeScript and scoped lint passed. The final exact-head
CI will validate the combined source and production compilation before merge.


## ECS v2 cryptographic build provenance — source candidate

Main #151 merged as `f3fb123a` after final head `a7521098`: PR CI
[38840040891](https://github.com/sahme209/visionxixlabs/actions/runs/38840040891),
push CI [38840037945](https://github.com/sahme209/visionxixlabs/actions/runs/38840037945)
and native CI [38840040894](https://github.com/sahme209/visionxixlabs/actions/runs/38840040894)
all passed. Exact-head CI verified 599 test files / 6,322 tests and the 293-page
production compilation. This branch preserves those
billing, website and Airflow improvements and adds a narrow internal offline
provenance boundary, not an enabled ECS release lane.

Official pinned `@sigstore/verify` 4.1.2, `@sigstore/bundle` 5.0.0 and
`@sigstore/protobuf-specs` 0.5.0 verify actual DSSE signatures, certificate/CT/log
evidence and signed SLSA v1 bindings. Checks include numeric repository identity,
source SHA/ref, caller workflow commit, separately pinned reusable signer,
run/attempt and complete subject digests, with tenant authority checked before
and after verification. Unsupported Node runtimes fail closed before verifier
imports; private trust remains unavailable. Runtime code imports no fixture or
default root. Reviewed public trust configuration is still required.

Evidence: `docs/ECS_PROVENANCE_INGESTION.md`, `sigstoreBuildVerifier.ts`, 39 new
regressions including a genuine upstream signed wheel fixture and an actual
unsupported-runtime import trap; the existing 80 ECS contract/review tests remain
applicable. Independent review found no material crypto/authority bypass. These
fixtures prove offline software behavior, not Axiom image provenance or a real
customer deployment. No route, full `VerifiedReviewBoundary`, provider read/write,
workflow dispatch, schema change, live quota or execution authority is enabled.
The production database binding, recovery readiness and login acceptance gates
remain unchanged. Full merged-main local checks and exact-head CI are required
before merge; results are recorded below when complete.


Local integration on main #151 passed 601 files / 6,361 tests, web and desktop
TypeScript, desktop build, 30 Python CLI tests, scoped lint, tracker consistency
and a 293-page optimized website build. The local website build invoked Next.js
directly without Prisma generation; no shared client or database was modified.
Main #152 (`8c997184`) was then integrated after its four CI jobs passed; its
separate inactive billing fixture/contract changes are preserved. Focused combined
ECS/billing/demo checks passed 165 tests (four existing PostgreSQL-only tests were
skipped without an explicit disposable fixture URL); final TypeScript validates
this merge. Final PR CI must
still verify the exact combined head before merge. Production acceptance remains
unverified, and no source-only pass authorizes production activation.


PR #152 merged as `8c997184` after final head `94108b93`: PR CI
[38840350263](https://github.com/sahme209/visionxixlabs/actions/runs/38840350263),
push CI [38840298650](https://github.com/sahme209/visionxixlabs/actions/runs/38840298650)
and native runs [38840350249](https://github.com/sahme209/visionxixlabs/actions/runs/38840350249)
/ [38840298654](https://github.com/sahme209/visionxixlabs/actions/runs/38840298654)
all passed. Its isolated new-test subscription lane remains unactivated; no route,
existing customer terms, live Stripe billing or production schema was changed.

### Owned local authentication rehearsal evidence — 2026-10-16 UTC

The committed launcher candidate `15f6131928f2816b6add50b66b60b6ff22d7d225`
reused the existing Next.js/PostgreSQL HTTP harness and passed 25 actual local
protocol checks: eleven signup/email-proof/password/session checks, ten desktop
pairing/consume/replay/revocation checks, and four approval-decision checks.
The new opt-in launcher used the cached PostgreSQL 17 image, an independently
owned synthetic database, literal-loopback binding, and verified exact-container
cleanup. The default inherited runtime binding was refused before container IO;
the accepted run used an explicit OS/proxy/CA-only environment. Sixty-three
focused safety/protocol tests across four files passed. Evidence and rerun
instructions: `docs/LOCAL_AUTH_HTTP_ACCEPTANCE.md` and
`docs/mission/local-auth-http-owned-launcher-acceptance.json`.

This verifies reusable local backend acceptance only. It does not verify
production login or migration recovery, native/browser/vault behavior, OAuth,
external mail delivery, paid entitlement policy, Stripe, or provider execution.
The observed identity-only `allowed: true` / `no_plan` remains a policy observation.
No existing mission scope or external approval gate is removed by this milestone.

Required local integration gates passed for this source branch: web TypeScript,
600 test files / 6,341 tests (local `--testTimeout=20000` runner bound),
desktop TypeScript and production frontend build,
and 30 Python CLI tests. These checks complement the source-pinned HTTP result;
they do not expand its production/native/paid-policy acceptance scope.

After normal integration of main through PR #151, the first combined suite hit
the existing native publication fixture's default five-second timeout under
concurrent compiler load; no assertion failed. Its unchanged focused file then
passed 34/34 tests at the default bound (the named case took 3.222 seconds), and
the complete combined suite passed with the explicit local 20-second bound.
No source test, native publication guard or CI timeout was weakened.


PR #153 merged normally as `a4baa514` after final head `91e8b29c`: Test
push [38841446680](https://github.com/sahme209/visionxixlabs/actions/runs/38841446680),
Test PR [38841452287](https://github.com/sahme209/visionxixlabs/actions/runs/38841452287)
and Desktop [38841446648](https://github.com/sahme209/visionxixlabs/actions/runs/38841446648)
all passed, including production builds, native compilation and Clippy. Its actual
local HTTP acceptance remains pinned to `15f61319`; this merge preserves that
qualification and does not convert it to production/native acceptance.


The provenance branch then merged main #153 normally, preserving both tracker
sections and the source-pinned HTTP evidence. Combined launcher/ECS/demo checks
passed 153 tests across six files; final web TypeScript, scoped lint and tracker
consistency passed. This does not rerun or expand the actual HTTP acceptance;
exact final-head PR CI is still the merge gate.


### Combined-source actual HTTP acceptance

The existing owned launcher then passed once on clean committed
`d4688abe5bd73fccd37c30ff7740406b7848baed` (main #153 plus inactive provenance
source): 11 actual authentication, 10 pairing and four approval protocol checks.
`docs/mission/local-auth-http-owned-launcher-acceptance.json` preserves the original
`15f61319` report and adds this source-bound run. An explicit OS/proxy/CA-only
environment excluded inherited application credentials; the cached PostgreSQL17
fixture was newly owned, loopback-only and removed only after exact ownership
verification. The source remained clean; no concurrent compiler or shared-client
generation ran. This is real local Next.js/PostgreSQL acceptance, not production
login, native/browser/vault, OAuth, paid policy, Stripe, cloud or provenance-runtime
acceptance. Existing production binding/recovery approvals remain unchanged.

## Isolated public TEST application bridge · 2026-10-16

**Implemented locally; production/hosted-provider acceptance not verified.**
The default-off owned-loopback lane reuses actual NextAuth/currentContext, billing
page/current allowance, credit preflight and Serializable reservations with one
verified version resolver. No missing new proof can become the legacy Growth pool.
Exact HTTP/method/server-action restrictions and shared provider/background denial
preserve the bounded scope; external IO and invoicing remain disabled. Actual
local HTTP proves synthetic credentials/session, public per-seat read/cap, pending
holds, missing-provenance unavailability, current-role denial and provider-disabled
hold release; this is not Stripe checkout/payment, AI generation or cloud workflow
acceptance. Existing customers, support source and User.plan remain unchanged.
See [ISOLATED_PUBLIC_TEST_APPLICATION_BRIDGE.md](ISOLATED_PUBLIC_TEST_APPLICATION_BRIDGE.md)
and [sanitized evidence](mission/isolated-public-test-http.json). Local full Vitest
passed 6447 tests/606 files (5 skipped), web TypeScript and desktop build/type checks
passed, Python passed 30 tests, and the direct optimized Next build passed
with offline fixture fonts (no Prisma generation). Exact-head CI and real provider-attempt
proof/access remain integration/acceptance gates.
