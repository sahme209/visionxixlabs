# Axiom remaining work

Master execution plan: [application + website action plan](axiom-master-action-plan.md). Authorized local execution has resumed; the [current execution board](current-execution-board.md) holds the prioritized A1–A9/B1–B6 status and evidence. All 15 parent requirements remain open. Specific pending operational, security-boundary and genuine human approvals remain required. The ecosystem roadmap below is retained; it is not a completion claim.

Status pointer corrected November 4, 2026; ecosystem entries retain their recorded planning scope. This is the implementation roadmap, not a claim that planned integrations have been accepted live.

## Status snapshot — 2026-11-09 (what changed this session, and what is left)

This snapshot complements the detailed index (master-plan-requirements-index.md, not re-scored item by item). Everything below is merged on main unless marked otherwise. Historical snapshot: build 4 at `a344f4f6` is now production (verified November 11); see `CODEX_HANDOFF.md` for the current deployment receipt.

**Done in code (merged)**
- **A7 security:** workspace-authority fixes on /api/axiom/*; starter-token expiry; consolidated threat model; tamper-evident audit seals; AI context secret redaction in the governed AI path; invite revocation; self-service API keys (scoped, expiring); Dependabot (grouped) plus a weekly dependency audit; the non-breaking vulnerability fix (13 → 6, one high left: @azure/msal-node needs a major upgrade).
- **A10–A14 agent governance (new):** MCP and REST gateway for any agent; policy replay; change impact preview (also inside gateway decisions); agent scorecards; `vxl ask` / `vxl outcome`; webhook events.
- **A8 Batches:** read-only Prefect, Dagster and Argo clients, connection route, Agent tools, desktop connect form.
- **B2 website:** balanced layout, wording pass, full-page design screenshots in CI, logic-audit fixes (dead links, duplicate FAQ, stale pages, legal dates).
- **B4 docs:** Agent gateway, Trust tools and API keys guides.
- **B5/C2 Ask Axiom:** grounded cited answers (FAQ, docs headings, 86 docs sections), guardrails, account-aware read-only help, AI answers through the governed path, a 38-case eval in CI (95%).
- **CI:** parallel jobs (~6 min); build memory fixed by retiring 41 unreachable dashboard pages.

**Waiting on the owner (decisions or clicks)** — updated 2026-11-09
1. A production build to ship what merged after build 3 (dependency updates, Ask Axiom governed actions, audit seal anchors). Builds 1–3 and both production migrations are done; #271 legal additions and the msal-node major upgrade are merged.
2. A9 on-prem decisions (ADR 2026-11-09): KMS/HSM key custody (8), offline sign-in (9), offline licence (11), audit retention default (7, suggested 400 days).
3. Earlier holds: Vercel secret fallbacks, Neon preview integration, Agent seed, Lead.phone, admin MFA, API key expiry policy for admin-minted keys, coding-run budget design (A7.18).

**Needs real-world steps (not code)**
Signed installer (A1); live Governance trials (A2); ServiceNow closure (A3); real-app walkthroughs (A4); Store/Windows (A5, deferred); independent security assessment (A7.14); live provider acceptance (A8); recorded demos (B3).

**Code still open (next candidates)**
Support agent governed actions (roadmap step 4: five actions done — support hand-off, access request, diagnostic, governed seal/verify, expiring-key list); remaining A2 enforcement composition (readiness read done; enrolled refusal done for notifications, webhooks, membership increases (incl. invite acceptance), new API keys/webhook endpoints, new Airflow/batch connections and autonomy loosening; M02 and M03 complete; P01 platform families remain incomplete after the owner included all three families in scope); A9 orchestrator/on-prem foundations (seal anchors done; offline local-model governed v1 source merged in PR #325 after accepted ADR/settings; protected OS/model and production qualification remain open); B4 coverage of the remaining screens; C1–C6 (not authorized yet).

## Platform migrations (held out of Dependabot major batches)

Each needs its own planned PR; Dependabot ignores their major versions until then.

- TypeScript 7 (web + desktop): 7.0.2 native checks merged green in PR #320, with exact 5.9.3 compiler API retained for valid ESLint peers and reviewed tools. Not deployed; this does not remove every older compiler.
- Tailwind 4.3.5 (web + desktop): merged green in PR #319; source bounds, shared diff and browser dark/light spacing checked. Not deployed or customer-qualified. See `../recovery/2026-11-11/tailwind4-upgrade/README.md`.
- Prisma 7.10.1: merged green in PR #321 (`54c0f1c5`), including owned SQL/HTTP and website/macOS acceptance. Not deployed; the live target/schema discrepancy and adapter pool/TLS compatibility still block publication. Historical issuer qualification is not renewed. See `../recovery/2026-11-11/prisma7-preflight/MERGED-RESULT.md`.
- ESLint 10: held at 9 by owner decision November 11; three current plugins reject version 10. No forced peers or disabled rules. Vitest 5.1.0 source has since merged green in #322.
- Next.js 16.4.5: done 2026-11-09. All 20 release-closure files, the three owned-website internals and `writeAppTypeDeclarations.js` are byte-identical to 16.4.2; only `package.json` changed and was re-pinned.
- AWS SDK: 3.1166.0 merged green in PR #315; ECS model and S3 collector behavior reviewed. Not deployed. Evidence: `docs/recovery/2026-11-11/aws-sdk-upgrade/README.md`.
- Stripe (any bump; 20.4.1 already moves the pinned API version to `2026-02-25.clover`). Stripe 23: new API version (`2026-10-28.endive`) and non-generic `HttpClient` types; re-review the owned Stripe TEST transport and settlement code.
- ai 7.0.170: merged green in PR #317 after Gateway v4 and explicit text-only dispatch review. Not deployed; production Node >=22 still needs confirmation.
- Vitest 5.1.0: PR #322 merged green as `a10730ca`; reviewed preload hash `3f415a8b…` differs from 4.1.12 only in a lint comment. All applicable CI passed; no assertion/default/skip relaxation. Future bumps still require source review and exact version/hash pin. Not deployed.

## Current completion work

1. **ServiceNow:** the exact deployment-evidence note exists in CHG0030002 and matches the reviewed payload. Preserve its one consumed, unknown Axiom attempt; narrow OAuth proof-reader presence was verified; complete independently reviewed read-only outcome reconciliation, then follow the native approval lifecycle and exact closure approval. Never resend the note.
2. **Governance Intelligence MVP:** approved for local implementation. Source-bound evidence/baseline contracts, strict admission kernel, bounded collectors/document parsing and immutable revision/activation foundations exist with local/isolated database tests. Finish current-authority/source composition, enforcement coverage across the named executors, drift and integrated native/web workflow, then full review/acceptance. Not enabled in production.
3. **Customer installation:** finish factual Store listing/age rating, real product screenshots, Microsoft certification/signing and clean-Windows installation/sign-in/session persistence. No Windows host is currently available; website MSI signing warnings remain unresolved.
4. **Ship newer desktop repairs:** preserve a source backup and publish a fresh protected installer version containing the newer repairs, canonical logo and interface cleanup. Published immutable v0.1.21 downloads remain unchanged. Do not overwrite them.
5. **Guided customer journey:** existing clarity changes are implemented; complete whole-flow usability acceptance of readiness, independent approvals, verified outcomes and recovery in the actual app.

## Next interface and account work requested by the user

- **Releases first:** replace the crowded, unclear presentation with one obvious current step and owner, a readable progression from scope through review/execution/evidence/tickets, and supporting technical details on demand. Keep exact human review controls, uncertain outcomes, deadlines and recovery visible. Preserve existing dirty-form/session/one-attempt guards. Then apply the same spacing, hierarchy, navigation and status language across the app; Shared local layout, navigation, typography, warm light mode and Bot canvas refinements are now delivered in the signed Local Preview. Remaining work is whole-flow usability/accessibility acceptance and shipping the newer installer. Cursor, Claude, Codex, ChatGPT, Grok and Apple are interaction references, not copied branding.
- **Outlook discoverability:** existing implementation remains in Settings → Integration Center. Local Apps & skills now also offers a searchable Outlook entry opening those same controls, with no automatic consent, mailbox read or send from merely viewing the catalog. Thirty-one catalog/Outlook-recovery tests and desktop types pass. Not yet in a newly shipped installer.
- **GitLab integration and GitLab sign-in:** two distinct planned capabilities. Inspect existing connector inventory/auth before building. Define a reviewed design for account login/linking separately from workspace repository/merge-request/CI access, with independent consent and safe account-linking rules. No provider registration, new grant, credential, customer read or authentication deployment has occurred.

## Product-wide priorities to retain for later

User priorities recorded October 31, 2026. These apply across the whole product and do not replace the current completion work. They are planned quality goals, not claims that Axiom is certified or invulnerable.

1. **Security as a core product investment.** Aim for independently verifiable enterprise security for AI-assisted releases and every connected action. Translate the requested “military-level” ambition into a threat model, tenant isolation, least privilege, secure identity/session/account linking, secret protection, encryption, safe AI/tool boundaries, current policy and approval enforcement, dependency/build/update integrity, and tamper-evident audit. Include negative tests for cross-tenant access, prompt injection, authorization bypass and data leakage; independent penetration testing and remediation; incident response and recovery exercises. Track findings and supporting evidence. Do not promise zero vulnerabilities or use unsupported security/certification claims in marketing. Any assurance page must distinguish implemented, tested, independently assessed and planned controls.
2. **Premium, consistent visual design across the app.** Use Cursor, Claude, ChatGPT and Codex as references for focus, restraint, clarity and perceived capability while preserving Axiom's identity. Audit every screen, not just Releases: navigation, typography, spacing, density, empty/loading/error states, accessible contrast, keyboard operation and responsive layouts. Prefer a clear primary work surface and supporting details on demand over nested, crowded panels. Keep all necessary evidence, warnings and exact review controls available.
3. **Intuitive operation in a sensible order.** A new user should understand what the screen is for, where to start, what happens next and who must act without reading a manual. Connect readiness → preparation → independent review → execution → verified outcome → recovery as the task requires. Preserve task context and form state across navigation; use consistent labels/statuses, contextual next actions and progressive disclosure. Validate with first-time-user task walkthroughs and observable success criteria, not appearance alone.
4. **Broader ecosystem and workflow coverage.** Expand Apps & skills, reusable workflows, batch/orchestration providers beyond Airflow, and release/ticket/deployment providers beyond the current Jira/ServiceNow paths. Retain the integration list below. Choose additions by customer demand, safety and reuse of existing adapters; do not create a second approval or credential system. Each provider needs clear supported operations, readiness, permissions, failure/recovery behavior and acceptance evidence. A catalog entry is not a completed integration.

Additional recommendations to review alongside those priorities:

- **Reliability and recoverability:** explicit uncertain outcomes, durable history, idempotency where providers support it, no blind resends, tested rollback/reconciliation and backup restoration. Measure task completion and recovery success.
- **Customer onboarding and trust:** a short path from install/sign-in to a useful verified task, clear consent and data handling, understandable support and incident reporting, and factual security documentation.
- **Performance and accessibility:** responsive interactions, useful progress, efficient resource use, keyboard/screen-reader access and consistent platform behavior. Judge capability by user outcomes rather than installer size.
- **Maintainability and cost control:** shared components and workflow contracts, reproducible releases, compatibility checks, bounded provider/AI usage and visible operational budgets. Prefer a few complete, dependable workflows over unsupported catalog breadth.

Suggested sequence after current completion: security/threat-model assessment and highest-risk repairs first; app-wide usability/design work in parallel with measurable onboarding; then expand integrations in customer-priority order. New provider grants, spending, live actions and publication retain their existing authorization requirements.

## Subsequent integration and plugin roadmap

Inspect and reuse existing adapters, identity, approvals, policy and audit systems before adding each capability. Inventory and live acceptance are required before marking an integration complete.

| Order | Integration / plugin | Requested capability | Roadmap treatment |
|---|---|---|---|
| 1 | HashiCorp Terraform / HCP Terraform | Infrastructure plans, approval gates and drift detection | Planned capability; inspect existing infrastructure/deployment adapters first |
| 2 | HashiCorp Vault | Secure enterprise secrets management | Planned enterprise secrets integration; preserve existing credential boundaries |
| 3 | Open Policy Agent (OPA) | Automatically enforce company guardrails | Planned policy-engine integration; extend Governance Intelligence rather than create competing approval logic |
| 4 | Microsoft Entra ID | Enterprise SSO, identity and permissions | Planned enterprise identity capability; reuse existing Microsoft/identity configuration where applicable |
| 5 | Okta | Enterprise identity integration | Planned enterprise identity capability; inspect existing IdP support |
| 6 | Datadog | Verify deployment health and detect failures | Planned health/evidence integration; connect verified observations to release outcomes |
| 7 | Confluence | Import security policies and operating procedures | Planned governance-document source; read-only discovery and traceable evidence |
| 8 | SharePoint | Read enterprise governance documents | Planned governance-document source; tenant-scoped read access |
| 9 | Kubernetes | Cluster governance and deployment control | Planned cluster integration; separate read-only discovery from governed changes |
| 10 | Slack | Approvals, notifications and incident alerts | Extend existing integration. Governed notification/task-linked live tests already passed; broader approval/incident workflows require separate verification |
| 11 | Backstage | Service ownership and developer catalog | Planned catalog/ownership source; reuse discovered ownership in governance workflows |
| 12 | Apache Airflow | Workflow orchestration and pipeline governance | Extend existing integration. Hosted trial execution passed; broader pipeline governance, scheduling/recovery and customer-hosted acceptance remain distinct |
| 13 | GitLab | Source-control/CI integration plus a separate GitLab sign-in option | Newly requested; design and provider setup pending, not enabled |
| 14 | Prefect | Python workflow scheduling, run monitoring and governed recovery | Planned Batches extension; first priority. **2026-11-08:** read-only inventory client implemented and unit-tested (`lib/integrations/prefect/prefectClient.ts`: flows, flow runs, task runs; no mutation methods). Not yet wired to connection storage, UI or the Agent; no live acceptance |
| 15 | Dagster | Data-pipeline orchestration, asset checks and freshness monitoring | Planned Batches extension; second priority. **2026-11-08:** read-only inventory client implemented and unit-tested (`lib/integrations/dagster/dagsterClient.ts`: jobs and runs via fixed GraphQL queries; no mutations). Asset checks/freshness, wiring, UI and live acceptance still open |
| 16 | Argo Workflows | Kubernetes-native container batch workflows | Planned Batches extension; third priority. **2026-11-08:** namespace-scoped read-only inventory client implemented and unit-tested (`lib/integrations/argo/argoWorkflowsClient.ts`: templates and workflows, GET only). Wiring, UI and live acceptance open |

New Batches sequence: Prefect → Dagster → Argo Workflows. Airflow remains the existing provider. As of 2026-11-08 all three have read-only, unit-tested inventory clients, a shared desktop connection route (`/api/desktop/batch/{prefect|dagster|argo_workflows}/connection`: validate with one bounded read, encrypted context-bound credential, revoke) and a read-only observation executor (`lib/axiom/agentRuntime/batchObservation.ts`). The seven read-only observation tools are registered (tool registry, executor dispatch, decision-loop recheck set, Automation Agent allowlist, "Batches diagnostics" skill, activity labels), and the desktop Batches → Connection tab has a read-only connect form for each provider. Still open: live acceptance with real Prefect, Dagster and Argo accounts.

These backlog additions do not themselves create accounts, grant provider access, buy services, enable production policies or authorize outbound changes. Each implementation retains existing least-privilege, exact-action approval, audit and cost controls.


## Expanded ecosystem discovery backlog

Added October 31, 2026 at the user's request. These are candidate integrations to evaluate, not implemented connectors or verified API/plan compatibility. Product names indicate potential sources; the roles below are proposed Axiom uses. Reuse existing adapters when present. Validate demand, supported APIs, licensing, least-privilege scopes and acceptance cost before selecting implementation.

| Category | Additional candidates | Proposed Axiom role |
|---|---|---|
| Observability and release health | Grafana / Grafana Cloud, Prometheus, Dynatrace, New Relic, Elastic Observability, Splunk Observability, Sentry, OpenTelemetry collectors | Read health, errors, alerts and SLO evidence against an exact release/environment. Telemetry is evidence, not independent approval or proof of causation. |
| Incident response | PagerDuty, incident.io, Rootly, FireHydrant | Resolve ownership/on-call context; prepare separately approved incident creation, updates and escalation. Never auto-resolve an incident from a green dashboard alone. |
| Application and supply-chain security | Snyk, SonarQube, Semgrep, GitHub Advanced Security, Trivy, JFrog Xray, Sigstore/Cosign | Import traceable findings, code-quality results and artifact provenance; evaluate existing policy. Do not equate a passing scan with absence of vulnerabilities. |
| Cloud posture and enterprise security | Wiz, Prisma Cloud, Microsoft Defender for Cloud, AWS Security Hub, Microsoft Sentinel | Read scoped posture/security findings and connect affected resources to proposed changes; keep remediation separate from discovery. |
| Build, deployment and artifact systems | Jenkins, Azure DevOps, CircleCI, Buildkite, Argo CD, Flux, Harness, Spinnaker, JFrog Artifactory, Sonatype Nexus | Exact build/run/artifact evidence and separately governed deployment operations. Distinguish Argo CD deployment reconciliation from Argo Workflows batch orchestration. |
| Secrets and privileged access | AWS Secrets Manager, Azure Key Vault, Google Secret Manager, CyberArk, 1Password Secrets Automation | References, readiness and approved brokered use; never copy secret values into prompts, logs or general evidence stores. Extend rather than duplicate Vault roadmap. |
| Governance, risk and compliance | ServiceNow GRC, Vanta, Drata, Secureframe, AuditBoard | Map controls to source-backed evidence and export reviewed records. No implied certification or automatic auditor approval. |
| Service catalog and ownership | Cortex, OpsLevel, Port, Atlassian Compass | Service/team ownership, dependencies and escalation context, complementing Backstage. |
| Data and batch platforms | dbt Cloud, Databricks Workflows, Azure Data Factory, AWS Step Functions, AWS Batch, Google Cloud Workflows, Temporal | Evaluate distinct job/orchestration models after Prefect, Dagster and Argo Workflows; exact run identity, approvals and outcome recovery remain required. |
| Enterprise content and collaboration | Google Drive, Notion, Box, Google Workspace identity, Zoom Team Chat | Traceable approved document sources and bounded notifications where customers request them; documents never become execution authority merely by being imported. |
| Cloud and infrastructure coverage | Microsoft Azure, Google Cloud, Pulumi, Ansible Automation Platform, OpenShift | Broaden inventory, plan and governed-change coverage after auditing existing AWS/Kubernetes/infrastructure adapters. |

Suggested next shortlist after current completion: **Grafana/Prometheus, Dynatrace, PagerDuty, Sentry, Snyk/SonarQube, Azure DevOps and Argo CD**. Choose the first implementation based on actual design-partner demand; this is a proposed priority, not a market-share claim.

### Ecosystem product rules

- Keep the customer catalog searchable by outcome/category and show **Connected**, **Available to connect**, **Needs attention** or **Planned** truthfully. Do not ship placeholders as working integrations.
- Prefer one shared adapter contract for identity, capability discovery, read evidence, exact action plans, approval, execution, outcome observation and recovery.
- Separate read-only evidence, notifications and mutations. Version provider APIs/capabilities; test tenant boundaries, revocation, rate limits, pagination and uncertain outcomes.
- Customer-managed connections remain customer-owned. No new paid accounts, grants, installations or live tests are authorized merely by adding roadmap entries.
- Broader catalog breadth comes after dependable supported workflows. Document each connector's supported operations and exclusions.

Reference checks for initial observability/incident/security candidates: [Grafana Cloud](https://grafana.com/products/cloud/), [Dynatrace overview](https://docs.dynatrace.com/docs/discover-dynatrace/what-is-dynatrace), [PagerDuty incident lifecycle](https://docs.pagerduty.com/incident-management), [Wiz platform](https://www.wiz.io/platform). Remaining names require discovery before implementation.

## Secure and efficient cloud AI

User priority: make cloud-AI data handling verifiably secure and token spending transparent. Planned work: context minimization, authorized redaction/secret protection, provider retention/data-boundary review, scoped tools, safe caching with tenant isolation and invalidation, task budgets and suitable model selection. Benchmark tokens and cost per successfully completed equivalent task, including retries and quality; do not claim competitor savings without reproducible evidence. Review dependency security, licensing and maintenance before adopting optimization libraries.

Small implemented local improvement: Agent usage receipts retain provider-reported total-only counts, label missing breakdowns explicitly and never estimate usage or cost. This is transparency, not a token-reduction feature or completed security assessment.

Local security hardening (9c51fe0c): AI invocation metadata uses canonical known-credential redaction; contaminated correlation IDs are omitted, normal IDs retained. Five synthetic/mock-store regression tests and focused strict types passed; the clean-source production build and production TypeScript also passed. Activation remains pending. This does not establish general PII detection, outbound prompt filtering or production activation.

Local token-evidence integrity (a1a054bb): invocation logs preserve valid counts/zero and omit negative, fractional, non-finite or storage-overflow counts. Twelve synthetic/mock-store tests, focused strict types and clean production build/types pass. This changes neither billing nor token consumption; production activation is still pending.

Local call-log API privacy repair (9ad8c3fc): redact known credentials in persisted/returned log text and use a fixed read-failure hint; legacy rows stay unchanged. Twenty mock-repository tests and focused strict types pass. The file-read blocker was isolated and resolved for the clean build using exact lockfile SDK copies in a temporary overlay; full production build/types now pass. Production activation remains pending.

Local tenant-isolation repair (65a794ac): customer AI call-log JSON, CSV and engine-detail paths no longer permit cross-organization global scope. Global requests refuse/redirect before log queries; default reads force the authenticated workspace and UI global controls are removed. Three previously failing boundary tests now pass;25 route/responder tests and exact production build/types pass. No live cross-tenant test or production activation performed.

Narrow AI security activation candidatebf5dbd65 is prepared from recorded production3b596291, separately backed up, with56 exact-candidate tests and full production build/types passing. Reconcile live base, finish final review and obtain the specific rollout exception before activation. Unfinished Governance and newer desktop polish are excluded from this candidate.

## November 11 dependency sequence

AWS 3.1166.0 merged as PR #315 with every CI check green; production remains build 4. AI 7.0.170 merged green in PR #317 after review of Vercel Gateway v4 and explicit text-only tool choice, preserving admission, routing, caps, redaction and one-attempt guards. Tailwind 4 PR #319 merged green; TypeScript 7 side-by-side tooling merged green as PR #320. Prisma 7 is next, pending the owner-approved production schema check. Not deployed. Evidence: `../recovery/2026-11-11/ai7-upgrade/README.md`. Platform migrations remain next, each in its own green PR.

## November 11 live schema discrepancy

The approved, explicitly agent-delegated read-only Prisma preflight ran once on the recorded production branch/compute. Both November 9 tables (`AuditSeal`, `AgentGatewayRequest`) and ledger entries are absent; reservation columns match and unfinished migrations are zero. Historical build-3 receipt differs. Reconcile before production changes; no automatic apply, rollback or target-cause claim. [Actual result](../recovery/2026-11-11/prisma7-preflight/OBSERVED-RESULT.json).

## Supplemental future-technology assessment (planned research)

[Full supplied brief and owner timing clarification](future-technology-deployment-assessment.md): run during genuine gaps without delaying current priorities. Evaluate all eight areas against actual implementation and the existing integration/plugin roadmap; preserve factual/partial/planned/unsupported distinctions, costs/security/UX and current-source citations. Deliver recommendations for review, not automatic features/tickets or production actions. Not started.

## Token efficiency and useful tools (planned)

[Assessment and initial repository shortlist](token-efficiency-and-tooling-assessment.md): baseline/measure runtime token cost and development-assistant efficiency separately; evaluate bounded retrieval, compression, safe caching, code-aware context, evaluation, observability and source/security tooling. Reuse existing code first. Candidates are not installed or savings-qualified; preserve quality, exact approvals, isolation, gateway policy and spending/production gates.


## November 11 — Prisma 7 application compatibility progress (not merged/deployed)

The modern generated client, explicit PostgreSQL adapter factory and application constructor/import migration are implemented locally. Root native types pass; full first migration suite observed 17,803 passing tests, 30 failures across six files, 893 skipped and one expected failure. Generated-model guards retain full required-field checks and reject stale generation. The old datasource/cache/proxy assertions and reviewed framework source pin were subsequently repaired; 95 tests across those ten focused files now pass in the recorded split runs. Two old synthetic recipe tests remain incompatible with the Prisma 5 schema/engine profile; they are not skipped or declared qualified. Ordinary script sources retain exact targets and operations through the adapter, but were not executed. Historical issuer/recipe authority is not renewed. Full rerun, production/desktop builds, remaining recipe compatibility, independent final review and mandatory green PR CI remain. No production change or deployment. See [metadata evidence](../recovery/2026-11-11/prisma7-preflight/GENERATED-METADATA-PROGRESS.md) and [Node/driver review](../recovery/2026-11-11/prisma7-preflight/NODE-SOURCE-COMPATIBILITY.md). The live schema discrepancy and unverified Vercel target remain deployment blockers.


### Subsequent Prisma 7 validation — local candidate ready for mandatory PR CI

The two recipe failures above are resolved by the reviewed current-source `/2` helper and mocked tests, with old-driver refusal retained. Full rerun: 17,835 passed, 893 skipped, one expected failure; no unexpected failures. Three additional actual fresh isolated-PG tests passed (P2002, atomic workflow/event rollback, Serializable P2034); server stopped. Production build/299 pages, desktop types/frontend build and Python 36 tests pass; independent source review found no important issues. [Full evidence and explicit limits](../recovery/2026-11-11/prisma7-preflight/README.md). Not merged, deployed or historically issuer-qualified. Live target/schema reconciliation and driver compatibility remain deployment gates.


### PR #321 — deeper CI compatibility repair, not merged

Required Typecheck + Vitest, production/offline build, desktop/macOS, audit and auth recovery passed on the prior head; actual opt-in AWS/PG and HTTP/website acceptance found remaining failures. Raw-SQL conflict compatibility is now repaired locally with exact own-data driver evidence; transaction scopes/retry caps/authority are unchanged. Full local suite 17,850 pass / 897 skip / one expected failure, four actual fresh PG tests and complete AWS enrollment/revocation rehearsal pass; owned servers stopped. Bounded secret-free startup categories are prepared for the still-unconfirmed HTTP/website startup failures. [Evidence and limits](../recovery/2026-11-11/prisma7-preflight/CI-SECOND-ROUND.md). Do not merge pending/failing checks, deploy or equate this with live Governance acceptance.

### Observed dependency-security follow-up

Web CI on the Prisma candidate reports three moderate archiver/readdir-glob/minimatch findings (GHSA-g3hv-75wg-m249); high/critical threshold passes, desktop audit is clean. Versions match current main, so no new version change in this chain is attributed to Prisma. Compatible repair and actual exposure need targeted review; do not run the suggested force downgrade or weaken audit checks. [Exact observation](../recovery/2026-11-11/prisma7-preflight/AUDIT-OBSERVATION.md).


### Prisma startup compiler boundary — source correction, CI pending

Actual Next Webpack compilation of the real instrumentation hook reproduced 17 Edge errors with the early-return form. The Node store-factory import is now enclosed in a positive Node-only condition: Edge excludes the real PostgreSQL adapter graph, Node retains it, and the original Node store/logging/error behavior is unchanged. Implemented source review passes; no emitted application was executed by this regression. [Evidence](../recovery/2026-11-11/prisma7-preflight/INSTRUMENTATION-COMPILER-BOUNDARY.md). Actual HTTP/website CI success remains mandatory; no startup/deployment acceptance is claimed yet. No Next config/hash, authority, timeout, flag, credentials or native dependency changed.


## November 11 — Prisma source merged; Vitest next

Prisma 7.10.1 PR #321 merged normally as `54c0f1c5ab7cfa033ad2e8c2a75166ac63228b68` after all applicable checks passed on exact head `6a4fdb59`. This includes required Typecheck + Vitest, production/offline build, actual owned authentication/billing HTTP and PG accounting, AWS schema/recovery, website and desktop/macOS checks. Screenshot job intentionally skipped by its existing condition. [Merge evidence](../recovery/2026-11-11/prisma7-preflight/MERGED-RESULT.md). Earlier failed/pending checkpoints are historical and preserved. Production remains unchanged; target/schema discrepancy and pool/TLS compatibility still gate deployment. No canonical issuer, live provider or Governance acceptance is inferred.

Vitest 5.1.0 is the next separate source batch, generated by free standard-runner workflow `43129017665` from this merged main. Initial 17,845 tests passed, six failed: three exact old preload-version refusals, three missing local cached-engine fixture reads after ignore-scripts install. Reviewed preload change is comment-only; cached matching engine is restored without execution. Final validation and CI are pending; no test skip, lowered assertion, disabled stricter default or production change. [Candidate evidence](../recovery/2026-11-11/vitest5-upgrade/README.md).

### Vitest final local candidate

Vitest 5.1.0 now passes the unchanged full suite (17,851 tests; existing 897 skips/one expected failure), strict root/production/desktop types, desktop build, Python 36 tests and production build/299 pages. First default-heap Next build failed OOM; the justified rerun used CI's existing 8 GiB allowance and passed. Independent source review has no actionable findings. No test default/assertion/skip relaxation or runtime authority change. [Exact evidence and limits](../recovery/2026-11-11/vitest5-upgrade/README.md). PR CI and merge remain pending, production unchanged.


## November 11 — workspace guides and completed test-runner migration

Vitest PR #322 merged normally as `a10730ca` after all applicable checks passed on `2ecb082f`, including all shards, strict types, production/offline build, owned PG/HTTP acceptance, website and security audit threshold. No deployment or historical qualification renewal. [Merge evidence](../recovery/2026-11-11/vitest5-upgrade/MERGED-RESULT.md).

Four source-grounded guides now describe Apps and skills, Workspaces, Microsoft Learn MCP documentation tools, and browser Settings/sessions. Navigation is 35 guides; heading index and Ask Axiom corpus regenerated (117 sections). Four new questions must each cite their exact guide; the existing 90% support-eval bar remains. The initial missing-guide evaluation failed as expected; focused 81 checks pass after content/navigation changes. Full tests/build/review and mandatory PR CI remain pending. [Scope and source evidence](../recovery/2026-11-11/workspace-guides/README.md). Existing screens, APIs, privileges, ModuleIntro/demo flows and SDKs are unchanged. These guides do not establish native/live/media/full B4 acceptance. Production target/schema discrepancy, genuine human reviews, owner ADR/scope decisions and real-world gates remain open. No repeated flaky-test run without a captured failure.

### Workspace-guide candidate validation

Final local full suite17,855passes, existing897skips/one expected failure; root/production/desktop strict types, production build303pages, desktop frontend build and Python36tests pass. Independent source review has no important findings; heading index/corpus are current. Exact citations to each new guide pass independently. Mandatory PR CI/merge and rendered/media/customer acceptance remain separate. No deployment or runtime/authority change.


## November 11 — workspace guides merged; assessment drafts for review

Source guides PR #323 merged normally as `9decdb2891e89d1fa802cf325a45bd1e0c1e568f` after every applicable check passed on `29989733`: all Vitest shards, strict types, production/offline build, isolated website and required gate. Design screenshots intentionally skipped by existing branch condition.17,855local tests pass;303static pages. No deployment or rendered/live/media acceptance inferred. Original parent requirements remain open.

Authorized gap-time [technology assessment](../research/2026-11-11/future-technology-assessment.md) covers all eight requested areas and named groups; [tooling assessment](../research/2026-11-11/token-efficiency-assessment.md) provides an existing-source baseline and candidate triage. Findings are owner-review drafts, not new implementation tickets, roadmap expansion, installed dependencies or production authority. Exact source and public repository snapshots retained. No inference, SQL/provider mutation, credentials, native qualification or deployment. Baseline source agreement39/42, not token/cost savings. Offline-AI ADR choices remain requested and unanswered; other owner/live gates remain.

### Offline-AI v1 owner choices accepted November11

The owner accepted the ADR and explicitly chose OpenAI-compatible vLLM/Ollama/LM Studio only; operator-configured workspace token caps with no default (missing/unreadable refuses), operator-only cap changes, and customer-hosted models disabled online. Local implementation is next after the current research PR; no production settings/schema/enablement, real model/provider action or spending is authorized. Historical pending-decision snapshots above are superseded only for these three choices.

## November11 — offline-AI local candidate, not merged or deployed

Accepted offline-AI v1 is now composed in the default Agent path with explicit workspace opt-in, deployment-operator configuration/caps, durable token accounting and private one-attempt transport. The owner also approved the protected acceptance-file supplier design. Actual owned PostgreSQL/default Prisma/Agent journeys pass with simulated model and protected evidence; real server/OS qualification remains outstanding. Web and desktop controls expose only accepted model IDs, never endpoint/cap edits. No cloud fallback or automatic token allowance. The current protected-file profile supports macOS only; other hosts refuse pending qualification.

Independent review found two important boundary gaps; reproduced corrections now preserve isolated-provider refusal and propagate/drain terminal cancellation through admission/transaction rollback. Final broad checks, re-review, one fully green PR and normal merge remain. Public docs are36guides/123sections with an honest offline preview/operation matrix. This does not complete A9, enable offline AI, activate Governance, provision credentials/resources, resolve the production target/schema discrepancy, or waive any existing owner/live gate. [Current evidence](../recovery/2026-11-11/offline-ai-v1/README.md).

## Offline-AI v1 source merged — PR #325

PR #325 merged normally at 2026-11-12T03:28:08Z as `0caaaaab6c809f2188d1a4c8fdd64980e6ef35f0`. Exact head `4845eda54b26599b299fdf1557e599561a71883b` passed every applicable check: required Typecheck + Vitest, all three shards, types, production/offline build, frontend/native security, macOS transport/policy, owned PG accounting, owned HTTP authentication/billing and isolated website. Screenshot job skipped by its existing branch condition.

This supersedes prior pending source/CI statements only. Local full suite17,966pass/914skip/one expected failure; actual isolated PG17journeys used simulated model/evidence/audit. No real inference, protected OS qualification, Linux/Windows supplier, installed-native UI or production acceptance. No deployment/settings/schema/credentials/provider action. Existing production target/schema/TLS and all full-master owner/live gates remain.

## November12 — P01 scope decision recorded

Owner selected **include Axiom production deployments, template hosting and growth publishing in Governance**. Scope is resolved, enforcement is not complete. Source inspection found automatic S3 writes behind a GET and LinkedIn image uploads during draft generation; both belong in the coverage map. Proposed separate platform authority and staged enforcement are documented in `docs/recovery/2026-11-12/platform-governance-scope/PROPOSAL.md`. No product code, authority, flag, credentials, schema or external action changed. P01 stays a readiness blocker; owner production-click and spending rules remain.

## November12 — platform Governance initial local implementation

Owner approved the platform design for local code/schema definitions/isolated tests. Exact effect contracts and pure plan/review/claim/terminal transitions now pass9tests; transactional action/child-effect service passes7in-memory checks. Three actual isolated PostgreSQL journeys prove one concurrent claim, event rollback and terminal unknown preservation; server stopped. Root strict types pass. Dedicated platform tables are proposed only; no production migration, current-auth default, provider transport, workflow/UI or full P01 coverage is complete. P01 remains blocked. Source plan: `docs/superpowers/plans/2026-11-12-platform-governance.md`.

### November12 local platform workflow checkpoint (not merged or activated)

Prepared growth UI now joins exact-source proposal saving, original-reference read-only recovery, paginated saved history, independent review and separate original-requester confirmation.38focused panel/demo checks and root/desktop types pass with simulated clients. Backend isolated PostgreSQL receipts remain separately scoped; this does not establish installed/customer/live acceptance. Source catalog/usability, deployment/template/image and operational authority, all-family coverage, whole-batch validation/review/CI and activation remain open. Never renew/resend an unknown record or impersonate a reviewer. See `docs/recovery/2026-11-12/platform-governance-scope/LOCAL-PROGRESS.md`.


Prepared platform source picker: authenticated metadata-only draft/account pages now feed the unregistered growth proposal panel, with no automatic selection, save or provider call. Catalog labels are not source validation or execution authority.29focused checks, strict root/desktop types and the desktop shell/client build pass;32actual isolated PostgreSQL cases use synthetic identities/provider delivery. No live read, credential access, route activation or completed-P01 claim. Detailed evidence: `docs/recovery/2026-11-12/platform-governance-scope/LOCAL-PROGRESS.md`.


Prepared generated-site deployment source: the local backend derives exact files from an existing Lead package and binds its revision/project/team/environment through independent review and final-send checks.35actual isolated PostgreSQL cases pass with simulated provider delivery. HTTP/client/UI, durable result/reference recovery, cross-action uncertainty policy, actual provider/READY acceptance and the separate owner-click Axiom production release remain incomplete. P01 stays blocked.


Prepared deployment reference/preview transport: local authenticated HTTP and a paired desktop factory now connect the existing Lead-derived source service. Save, original-reference lookup and matching bounded file-text preview only; no decision or execution command/route activation.13focused HTTP/real-transport checks, types and desktop shell build pass;35actual isolated SQL cases include the joined default HMAC/prepared HTTP/client source journey with in-process delivery. Deployment UI/result recovery/all-family acceptance remain incomplete.


Local deployment source review now renders exact files as escaped text in the prepared independent-review panel. It performs no execution and explicitly labels deployment execution unavailable.27focused checks and root/desktop types pass; no native visual, live-provider, route activation or completed-P01 acceptance.


Unregistered generated-site proposal form now keeps exact Lead/project/environment/expiry and original reference before its single save, with lookup-only recovery after uncertainty.14focused preparation/coordinator/review checks and root/desktop types pass (simulated clients). It cannot approve or deploy; Lead catalog selection and full provider recovery remain open. The separately builder-checked deployment recovery contract requires a new owner decision before implementation.


Prepared Lead catalog supersedes the earlier manual-ID-only limitation: bounded current-admin metadata pages now feed the unregistered generated-site form, without selecting personal email, full payload or package content. Presence is explicitly not validation; the server still derives/reviews exact files.24focused checks, root/desktop types and desktop shell/client build pass;35actual isolated SQL cases include Lead metadata pagination/private-field exclusion and the actual client/prepared HTTP/current HMAC/SQL path. No live/provider/native acceptance, execution enablement or new recovery authority.

November12 platform broad local validation:18,151ordinary tests pass/949pending; root types pass after reviewed schema-helper/generated-client freshness correction. Full P01 and all production/native gates remain open; see `docs/recovery/2026-11-12/platform-governance-scope/BROAD-VALIDATION.md`. No PR/deployment acceptance is implied.

Platform local production compilation now passes on9ee99682 with the existing CI8GiB memory setting (304pages), no source/CI change or deployment. Earlier default-heap failure is preserved; evidence in `docs/recovery/2026-11-12/platform-governance-scope/PRODUCTION-COMPILATION.json`. This does not complete P01 or native/live acceptance.

Local template upload/access review now refuses changed/missing current template bytes and missing source supplier.34focused checks/types and36isolated SQL cases pass with simulated provider/source-change evidence; all template workflow/production/live acceptance remains open. Detailed receipts: platform-governance-scope/LOCAL-PROGRESS.md.

Prepared template source review is locally connected through server/paired transport/optional reviewer UI with escaped exact YAML and stale-preview clearing. No template execution, route activation or provider acceptance. Evidence/remaining full-family gates: platform-governance-scope/LOCAL-PROGRESS.md.

Template source preparation/reference recovery now connects local server→prepared HTTP→paired client, with server-derived content and no expiry renewal on reuse. Proposal UI, execution/result/grant delivery and full template/P01 acceptance remain open.49focused checks/types and36isolated SQL cases pass within platform-governance-scope/LOCAL-PROGRESS.md scopes. No route/production activation.

Optional local template proposal form now joins saved history/review with separate bucket/upload/access selections, original-reference recovery and no automatic action.26focused UI checks/types/shell build pass; shipping registration/native visual acceptance, bucket review and all template execution/result/grant delivery remain open. Details: platform-governance-scope/LOCAL-PROGRESS.md.

Prepared canonical bucket creation review now shows exact target metadata with ownership/absence explicitly not observed.43focused checks/types/shell build and37isolated SQL cases pass, with zero AWS calls in the new review case. No template execution/result/grant delivery or P01 completion; see platform-governance-scope/LOCAL-PROGRESS.md.

P01 requirement/source audit: platform-governance-scope/COVERAGE-ACCEPTANCE-MATRIX.md records every family and completion gate. New template receipt/reservation/recipient-delivery design is independently builder-checked, not implementation-approved. Source comment correction only; legacy Quick-Create GET still returns review-required without AWS access. Full P01/native/live/PR gates remain.

Platform broad checkpoint80a8dfee:18,179ordinary tests pass/951pending; production build/types/304pages pass with CI8GiB heap and no network/database URL. Evidence: platform-governance-scope/TEMPLATE-BATCH-VALIDATION.json. Pending execution/custody designs, full P01, final review/green PR and owner/native/live requirements are unchanged.

Operational release scope now has an independently builder-checked local design (platform-governance-scope/OPERATIONAL-RELEASE-DESIGN-PROPOSAL.md). Original P01 grant excluded changing these scripts/workflow; local implementation needs a new owner decision. No actual workflow, settings, provider or deployment action is authorized/performed.

November12: operational-release design now approved for LOCAL implementation and isolated tests. Initial strict release/ECS/settings metadata contracts and structural rollback matching pass5focused checks/root types; no execution authority, entrypoint replacement or real operation yet. Continue full operational plan; other pending designs and full P01/native/live/PR gates remain open.


### Operational manual-release notice store — local unit

Separate manual-release records now support original-session preparation/reference lookup, distinct-user exact-manifest review, current-reader historical inspection and one-use requester notice recording. A notice explicitly leaves owner authorization external/unverified and never executes a deployment. State and event writes share transactions; uncertain claim acknowledgement leaves the consumed claim intact with no public finish/reset/retry API. Stored manifests are re-parsed and digest-checked.

Validation: five initial store tests plus five metadata-contract tests passed; root strict types passed. An additional lost-commit-acknowledgement regression then passed in the complete six-test store file. These use an in-memory serialized repository and simulated authority/source checks, not actual SQL or qualified CI/artifact evidence. No schema, production, workflow, credential or provider operation ran. Task2 remains incomplete: durable SQL/default paired identity/source qualification must be connected before this can be presented as a usable release workflow. Existing broad suite/build receipts predate this unit.


### Manual-release durable storage/current possession — local continuation

Dedicated PlatformManualRelease/Event definitions and raw SQL storage now keep owner-click notices separate from executable platform actions. Advisory locks, version/digest checks and atomic nonsecret events preserve one-use state. Both stores share the same real identity/session/membership SQL and current admin rule; the private manual request factory verifies the existing paired-token signature and rechecks possession/current authority. No caller actor, admin-as-owner shortcut or credential/provider path is accepted. Default composition permits current-reader history but explicitly refuses new preparation/review/notice until actual CI/artifact/schema/recovery sources qualify. It is not route-registered.

Evidence:27focused checks across8files and final root strict types PASS. Actual fresh isolated PostgreSQL39non-skipped journeys PASS, including two new notice cases: concurrent source-save/requester notice, genuine paired HMAC+SQL composition with synthetic key, default unqualified-source refusal, atomic event rollback and actual reviewer revocation/history. Latest fixture `/private/tmp/axiom-platform-pg-ey9e24a2` stopped; earlier39case fixture `/private/tmp/axiom-platform-pg-91j59agc` is preserved and stopped. Release source/CI/build evidence and provider delivery remain simulated, not qualified/live.

The two appended local schema models leave all178prior model bytes unchanged. The stale generated-client guard and current recipe pin first refused (5tests); after exact delta review, only the current mock-helper pin changed and cached generation/compilation refreshed ignored metadata with networking denied/no database URL. Generated-model and complete-model omission guards pass; historical packets remain closed. See MANUAL-RELEASE-SCHEMA-REVIEW.md. No production migration, provider/workflow action, credentials, installation, deployment or spending occurred. Operational Task2 and full P01 remain incomplete: qualified source/result suppliers, workload/settings workflow and all-family acceptance still required; no broad exact-head acceptance/CI/merge claim.
