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


### Manual release evidence/result composition — local, unqualified defaults

New releasePreparation joins a private immutable bundle/current-profile supplier to the actual notice store. It requires exact current main source, complete unique applicable successful CI references (including Typecheck + Vitest), artifact source/target/build/config/lock/schema agreement, and compatible current database/recovery identities/schema/deadlines. Selected expiry can only shorten those deadlines. Independent review and notice re-read the original evidence selection and reconstruct the saved manifest exactly. Caller JSON/booleans/screenshots never qualify a supplier. The default remains explicitly unavailable because no actual CI/artifact/schema/recovery profile has qualified.

The exact-deployment result inspector is read-only, ten-second bounded, aborting and never retrying. It reauthenticates the current paired reader after awaited observations, checks project/team/production/source/deployment identity and receipt lifetime, keeps ACCEPTED/BUILDING pending, and requires additional exact smoke/artifact/compatibility qualification for verified_ready. UNKNOWN and terminal_failure provide no replay, rollback, handoff or provider authority. Owner reports are not provider proof; owner authorization stays external_not_verified. Private errors normalize to a fixed refusal (a dedicated synthetic RED reproduced leakage before the correction). Result reads do not dispatch or mutate notice history. Default qualified result supplier is absent, so default inspection refuses.

Validation:23focused checks across6operational files passed, then17checks across4affected files passed after private request/result joining; strict root types PASS.39actual isolated PostgreSQL journeys PASS with the strict bundle adapter, actual paired HMAC/SQL and read-only pending-result path, with immutable-profile/provider/smoke evidence still SIMULATED. Latest owned fixture `/private/tmp/axiom-platform-pg-n5tw1f8r` stopped. Prior source-only fixture `/private/tmp/axiom-platform-pg-qfvhq4io` preserved/stopped. See MANUAL-RELEASE-EVIDENCE-PG-RECEIPT.json. No production/workflow/provider action, credential access, deployment or spending. Task2 actual supplier qualification/owner attestation and full P01 remain open; no full branch/CI/merge/live claim.


### Operational workload identity candidate — local, no qualified default

Actual installed JOSE now verifies synthetic signed tokens against a private exact source/key/profile, then issues an opaque uncloneable identity-only proof. Exact already-selected run/attempt/action/manifest, stable repository/owner identities, manual branch event, workflow source, current profile/time and replay reservation are required. Human/static tokens, altered signatures, remote key hints, serialized proofs and expired/changed bindings refuse; unknown reservation never restores the consumed proof. Raw tokens/claims are never returned or recorded. This does not delegate, mint credentials or send a provider action.

The owner-approved three public GitHub documentation reads are consumed. WORKLOAD-IDENTITY-SOURCE-REVIEW.md records the exact pages and documented caller-versus-called workflow, immutable subject and header distinctions. Source-backed local regressions pass32checks with strict root types; actual cryptography runs locally, but profile currentness and replay storage remain simulated. No SQL fixture rerun was warranted for this unattached identity unit. Actual key/configuration/run/IAM qualification, durable delegation/replay/credential leases and all remaining Task3/P01 requirements remain open. No default source, workflow, provider, credentials, installation, deployment or spending was enabled.


### Durable operational delegation and credential liability — local unit

The original requester/session can now explicitly delegate an exact independently reviewed platform ECS parent/manifest/run. A distinct workload claim uses the signed identity component and a global SQL replay reservation. Parent claim, delegation state, replay reservation and metadata-only events commit atomically; a lost commit acknowledgement emits no phase proof and cannot re-claim. Actual executor is recorded as workload in the delegation/event, never by calling the human claim method with a borrowed requester. Generic human ECS claim/child-effect paths now refuse; actual operational dispatch remains unavailable.

Private uncloneable one-use phase proofs enforce a durable credential-pending record before a later private issuer could run. Issued or unknown outcomes are recorded without raw tokens/values and never clear liabilities or authorize a provider send. Credential observation can preserve truth after reviewer revocation/expiry; current-reader history remains separately protected. Current human authority is checked before later profile/credential-stage reads. No mint, SDK/provider transport or public default workload source exists in this unit.

Validation:72focused checks across6files and strict root types PASS.44actual fresh isolated PostgreSQL journeys PASS, including five new cases: actual HMAC parent proposal/scripted review + current SQL delegation/synthetic signed workload claim/credential metadata, global cross-action replay exclusion, atomic event/replay rollback, lost committed-claim acknowledgement, and actual reviewer revocation before profile reads. Source/profile/issuance/provider authority remains SIMULATED; requester delegation receives the injected fixture actor, not a registered requester HTTP flow. Latest `/private/tmp/axiom-platform-pg-kadp2cj0` stopped; earlier44case fixtures lthdzkwy/x4riyvh1 preserved/stopped. See OPERATIONAL-DELEGATION-PG-RECEIPT.json.

Schema review compared all180existing models against182current: only the optional parent inverse relation changes existing metadata, plus two proposed delegation/replay models. No existing data column/enum/migration changed. Current mock-helper schema pin and ignored generated client refreshed after semantic review; historical packets remain closed. See OPERATIONAL-DELEGATION-SCHEMA-REVIEW.md/json. Full Task3 native reservations/protected settings artifacts/default requester/workload/credential qualification, Task4 dispatch/legacy replacement, Task5 UI and all-family final acceptance remain open. No production schema/flags, actual credentials/workflow/provider operation, deployment, grants, installation or spending.


### Operational target generations joined before credentials — local unit

Physical ECS service reservations now join the actual workload/delegation/replay transaction. Supported full/short ARN forms share one account/region/cluster/service key, independent of task revision, role, action or workflow. Held/unknown attempts cannot be bypassed by a new action/reference. Credential staging rechecks the exact held generation/source. Immutable native snapshot/outcome metadata is retained; acceptance stays nonterminal, missing operation identity cannot be invented, and a separate rollback must match actual saved failure generation/action/prior receipt/task.

New generations additionally require the original immutable terminal receipt and current private qualification, not just a terminal string in a row. Prior credential state is read under a shared SQL lock: pending/unknown blocks; issued requires qualified permanent closure/custody evidence, never an expiry timestamp alone. Closure reference is preserved in immutable receipts. Actual source/protocol/credential closure profiles have no qualified default; all provider observations/closure in these tests are SIMULATED. No claim of cloud CAS or prevention of external admin changes.

Validation:116focused checks across15files and strict root types PASS.51actual isolated PostgreSQL journeys PASS, including seven new target/credential-lifetime cases with actual SQL + paired/synthetic signed workload composition, but simulated native/provider/closure qualification. Latest owned `/private/tmp/axiom-platform-pg-wveb21sd` stopped; prior51case fixture afqn7lgr and49case fixtures xtetnc0n/hdp1xet_ preserved/stopped. Native transaction/schema/receipt scope: OPERATIONAL-TARGET-PG-RECEIPT.json. Two new local target/receipt models and two inverse relations reviewed across182prior/184current metadata; current mock-helper pin/generated client refreshed, historical issuer packets unchanged.

Task3 remains open for protected settings artifacts and complete qualified/default composition. Actual native/provider/workload/credential/custody qualification, Task4 sends/legacy entrypoint replacement, Task5 UI, final full-source tests/build/review/green PR and full P01/live acceptance are not complete. No production schema/flag, provider/credential/workflow action, signing, installation, deployment or spending. The pending generated-site recovery design is neither reused nor implicitly approved.


### Protected settings codec — local unit, not execution authority

Settings manifests now require an explicit nonsecret artifact profile. The private codec reuses the existing AES-GCM kernel, binding each value to the exact parent action/plan/manifest, effect, original creator/session, target and profile. Public plans and metadata contain no value, ciphertext or secret-dependent hash. Wrong bindings/keys, malformed envelopes and oversized/invalid values refuse with a fixed error; supplied key buffers remain unchanged. The 64 KiB bound is local memory protection, not provider qualification.

Validation:10focused checks across2files and strict root types PASS. Tests use synthetic values and random local keys; no actual secret, key supplier, provider or database was accessed. Durable immutable artifact storage, current-authority/clock checks around custody, settings reservations, final transport, qualified default composition and Task3/P01 completion remain open. No HTTP route, default key lookup, production schema, deployment or spending.


### Protected settings transactional intake — local injected unit

The private intake service locks the original proposed parent, derives the exact artifact binding, checks current original requester authority/source/DB time around awaited custody and insert, and returns metadata only. Duplicate artifacts and any save after review refuse before key access. No replacement, deletion, renewal, decrypt/export or provider operation is exposed. Errors normalize to a fixed refusal. Transactional rollback is required of the repository.

Validation: missing-module RED, then10focused codec/intake tests PASS (5intake cases); strict root types PASS. Tests use an explicitly simulated transactional repository, source, authority and synthetic random keys. They verify key preservation, duplicate nonreplacement, post-review/identity refusal, revocation/expiry/source changes after custody, unavailable custody and rollback after a final authority failure. Actual SQL adapter/schema/uniqueness/isolated-PG composition and qualified custody remain REQUIRED next steps; this is not durable database acceptance or Task3 completion. No production/schema/provider action, real credential or spending.


### Private settings actual SQL — fixture acceptance, local only

The shared platform SQL repository now provides private insert/read operations under the original parent lock, with canonical binding/parent checks and insert-only uniqueness on artifact ID and parent/effect. The fresh isolated fixture adds a dedicated encrypted-envelope table; no public history/export endpoint or mutable artifact operation exists. The current Prisma production schema/model and migration are NOT yet added, so this is not a deployable schema claim.

Strict root types PASS.53actual isolated PostgreSQL cases PASS, including two new cases: competing saves yield one exact decryptable synthetic envelope; reviewed parents refuse replacement; final authority loss rolls back the actual inserted envelope. Existing51cases also pass. Source/custody remain SIMULATED, real current identity SQL is used, and no paired HTTP/real-key/provider acceptance is claimed. Latest `/private/tmp/axiom-platform-pg-95iuomy1` stopped; earlier52case fixture z8t_9jqo preserved/stopped. See SETTINGS-ARTIFACT-PG-RECEIPT.json for enumerated source hashes/limits. Next: proposed Prisma model and semantic review/current-helper regeneration, private preparation/review composition and settings execution/reservation qualification. Task3/P01 remain open. No production/provider/spending action.


### Private settings proposed Prisma schema/client — local only

Added PlatformSettingsArtifact and its parent inverse relation. Actual Prisma DMMF comparison verifies all184prior models/enums: only the inverse relation changes existing metadata; no existing data field/default/enum/migration changed. Current185-model mock-helper schema pin updated AFTER semantic review; historical packets and engine/CLI/seed pins unchanged. The existing stale-schema guard first refused as expected;12mocked recipe checks now pass including omission of the new table. Cached client generation ran with network denied and no DATABASE_URL; client compilation, generated metadata guards and strict root types pass. Additional12focused generated-model/codec/intake checks pass.

See SETTINGS-ARTIFACT-SCHEMA-REVIEW.md/json. Prior53actual isolated SQL receipt remains accurately scoped to its earlier enumerated schema hashes, not relabeled as a new runtime attestation. SQL table behavior is unchanged by this source-model addition. Actual protected custody, registered request/reviewer workflow, current artifact presence at review and final execution/settings reservations remain open. No production migration/apply, key/provider action, deployment, spending or historical qualification.


### Dedicated private settings review — local only

Added exact original-plan/version independent review to settings intake. Every saved artifact must match the derived action/effect/creator/session/target/profile binding under the parent lock; current requester/reviewer/source and database deadlines are checked around all awaits and after the durable review event. Review reads metadata/envelopes only, never custody keys or plaintext, and returns review-only/executionAuthorized=false. This dedicated workflow is not registered publicly; the generic legacy review remains separate and must not be mistaken for usable settings execution.

Missing-method RED then8focused store tests PASS.53actual isolated SQL cases PASS, with the private-settings journey now using this exact dedicated independent review and self-review refusal. Latest `/private/tmp/axiom-platform-pg-5c4iuk1h` stopped; see SETTINGS-REVIEW-PG-RECEIPT.json. Strict root types initially found a closure-narrowing issue; fixed by capturing the already narrowed settings count, then types PASS. The SQL receipt predates only that type-preserving local count capture. Full registration/preparation/preview/default custody/reservations/final dispatch, Task3/P01/full validation remain open. No production/provider/key action or spending.


### Signed-session private settings composition — local only

Private request composition now derives the actor from verified existing desktop bearer possession plus current SQL session/user/membership and platform-admin authority. Save/review accept no caller identity. Bound possession is checked around awaited current-authority checks; missing/changed headers refuse before source/custody. There is no cookie/API-key/cron fallback, public route, export or execution method.

Missing-module RED then focused possession test PASS; strict root types PASS.54actual isolated PostgreSQL cases PASS, including a new actual synthetic-HMAC/current-identity/SQL save→self-review refusal→separate independent-review case and removed-possession refusal. Actual source/custody remain SIMULATED; no real keys/users/provider effects. Latest `/private/tmp/axiom-platform-pg-7gkw7xh3` stopped; see SETTINGS-REQUEST-PG-RECEIPT.json. Registered HTTP/preview/original-reference recovery, qualified default custody, settings reservation/final execution and complete Task3/P01 remain open. No production/schema/provider/credential action, deployment or spending.


### Exact settings review preview — local only

Private settings preview returns the exact project/team/profile, plan/version/deadline, physical environment/name/type/sensitivity/current-source reference and missing/saved artifact status. It exposes no values, envelopes, creator sessions or key-dependent hashes; reviewReady means only all exact records are present, never execution authority. Current source and reader/requester authority/deadline are required. Signed-session composition exposes this private method, not a registered public route/UI.

Missing-preview RED and a behavioral source-revocation-during-read RED were reproduced; preview and review now recheck source qualification after each awaited record read.11focused checks and strict root types PASS.54actual isolated SQL cases PASS, with actual HMAC/private request preview joined to save/independent review. Synthetic source/custody remain unqualified; fixture `/private/tmp/axiom-platform-pg-b1zgec53` stopped. See SETTINGS-PREVIEW-PG-RECEIPT.json. No full workflow/execution/Task3/P01 acceptance, production change or spending.


### Vercel settings provider contract — three public reads consumed

See SETTINGS-VERCEL-SOURCE-REVIEW.md: exact existing-ID PATCH and response updatedAt do not establish request-side compare-and-swap in the inspected docs; no safe default update profile is qualified. POST documents upsert/duplicate behavior but create-only still needs scoped qualification. Setting changes are separate from running deployment updates. No API/account/key/write access occurred. SETTINGS-CONCURRENCY-DECISION.md recommends a locally prepared create-only first stage with updates held and still unfinished, pending owner design choice. Continue independent reservations/workflow work; no invented CAS, provider allow path, retirement or completion.


### Create-only scope selected; native settings exclusion — local primitive

Owner approved local create-only settings preparation/implementation; existing-variable updates remain held and explicitly unfinished. Full settings coverage is not narrowed to the create-only stage. No real setting/key/provider authority is granted.

A physical setting key now includes exact project/team/name/environment and excludes action/artifact/profile/value metadata. Actual SQL reuses the existing unique child publicationKey storage for a permanent settings-creation reservation. It requires the locked claimed parent, exact saved artifact binding/plan/source/requester/effect and a claimed child. Unknown retains the key; a cloned action/reference cannot reserve it. There is no reset/release/retry API; even terminal records do not by themselves grant a fresh creation. This storage primitive does not establish current provider absence, custody qualification, claim/decrypt/final-send authority, CAS or prevention of external admin changes. Complete create-only execution composition still remains.

Missing-key-module RED;12focused checks/root strict types PASS.55actual isolated SQL cases PASS, including the new competing/cloned native-setting-after-unknown exclusion case; provider/source/custody remain simulated. Fixture `/private/tmp/axiom-platform-pg-f9b__nrd` stopped; see SETTINGS-RESERVATION-PG-RECEIPT.json. No new model/schema/migration, production/provider action or spending.


### Create-only original-requester claim — local only

Dedicated settings claim now revalidates exact parent version/digest, both current humans, every immutable artifact binding/presence, current source and DB deadline before and after its durable claim/event. Only the original requester/session may claim; missing artifacts, existing-setting updates, stale/expired/revoked source/people and duplicate claims refuse before custody. Private signed-session composition derives the requester; claim returns metadata only/executionAuthorized=false and opens no value. This is not final-send authority or complete create-only execution.

Missing-method RED then13focused store/request checks PASS; strict root types PASS.55actual isolated SQL cases PASS with the actual synthetic-HMAC request journey extended through reviewer-claim refusal, original requester claim and duplicate refusal. Source/custody remain SIMULATED. Fixture `/private/tmp/axiom-platform-pg-_ksjnub3` stopped; SETTINGS-CLAIM-PG-RECEIPT.json records source/limits. Next is joining native child reservation/private custody/final transport with qualified source and unknown-result semantics, then complete workflow/default coverage. Existing-setting updates remain held and unfinished. No production/provider/key action or spending.


### Joined private create-only execution candidate — local only

The private executor now joins actual platform child claim/proofs/outcome machinery to exact settings records. A repository wrapper validates the current create-only manifest/source/profile/humans/deadline and atomically claims the child AND reserves the native setting before commit. Only after confirmed reservation commit may a separate private transaction obtain the synthetic custody key and decrypt the exact context-bound value. Final send rechecks current humans/source/profile/child/held reservation and is one-use; failures/unknown recording halt later children, preserve native exclusion and never replay. No value/envelope/raw response is returned in the result. Known confirmation is separately labelled provider_confirmed/deploymentPerformed=false, not running-app or deployment acceptance.

Transport and source qualification are explicitly private injected ports; the exact default Vercel HTTP/credential/visibility profile is NOT implemented or qualified. This is not public registration, real provider acceptance, complete create-only workflow or P01 completion. Existing-setting updates remain held. Value strings cannot be guaranteed zeroized by JavaScript; no memory-erasure claim is made. No real values, keys or providers are accessed.

Missing-module RED preceded implementation; initial denial-test failure was a fixture bug sharing one spy across all ports, corrected to distinct spies (no assertion removed). Focused denial test/root strict types PASS.59actual isolated SQL cases PASS, including four new execution cases: two sequential exact simulated creates, unknown-first blocks later custody/send, unavailable profile refuses before custody/child, and final-profile revocation prevents simulated physical send while retaining unknown reservation. Latest fixture `/private/tmp/axiom-platform-pg-eqk50wp0` stopped; preceding57case z7301_a4 preserved/stopped. See SETTINGS-EXECUTION-PG-RECEIPT.json. No production/schema/provider action, deployment or spending.


### Bounded Vercel create-only transport candidate — local only

Private transport now constructs one fixed-origin POST for the exact project/team/name/type/single environment, with no upsert, branch/custom-scope expansion, delete, retry or deploy. Explicit private source qualification precedes credential lookup and repeats before the final one-use execution callback. One10second deadline covers private preparation/request/response; late supplier continuations check abort before network. Responses are bounded64KiB and parsed into exact nonsecret receipt identity; contradictory targets/types, partial failures, redirects/rejections/transport loss stay unknown, with no raw response/error/value exposure. A response visibility conflicting with secret sensitivity refuses.

Missing-module RED then8focused transport tests PASS, including fake-clock late-credential/no-send. Strict root types PASS.59actual isolated SQL journeys PASS with the positive two-child executor case now using this actual transport and synthetic fetch/credential/profile; other unknown/revocation cases remain. Fixture `/private/tmp/axiom-platform-pg-vols3jjq` stopped; see SETTINGS-TRANSPORT-PG-RECEIPT.json. The cached already-approved create reference was revisited to resolve its response shape; no fourth documentation page/account/API was read.

This is not a qualified default: actual credential custody, create-conflict/visibility/size profile, actual provider acceptance, registered workflow/default callers and complete Task3/4/P01 remain open. No API, real key, production schema, deployment or spending. Existing-setting updates stay held, not dropped from scope.


### Durable exact settings result metadata — local only

The executor now records a nonsecret typed settings result within the existing immutable effect.observed event transaction: exact action/plan/manifest/effect/native key, outcome, confirmed setting ID or null, database observation time and metadata integrity digest. SQL rejects event/action/source/index/outcome mismatches. This preserves the original result for later recovery rather than relying on the response reaching the caller. Unknown never fabricates a setting identity, clears reservation or permits replay. No value/session/envelope/credential/raw response is included. Digests are not signatures or provider qualification. No new table/migration is needed.

Actual SQL RED reproduced missing durable IDs; corrected59actual isolated SQL journeys PASS, with positive execution checking both saved result IDs. Initial strict types found the broad event status union; explicit claimed-status rejection fixed it.11focused result/executor/transport checks PASS; root strict types PASS. Fixture `/private/tmp/axiom-platform-pg-v5f6q7id` stopped; failed RED fixture _tl3w16j preserved/stopped. See SETTINGS-RESULT-PG-RECEIPT.json. Source/fetch/custody qualification remain synthetic, public history/UI/default mounting and full Task3/4/P01 remain open. No production/provider/key action or spending.


### Read-only settings recovery history — local only

Dedicated inspect returns bounded immutable result receipts and nonsecret parent status/version/attempt/source digest/user IDs with current-reader authority, history_only/sourceValidation=not_checked/executionAuthorized=false. SQL reads only settingsResult projections from exact effect.observed events, bounded32; malformed, duplicate, cross-action/plan/source/index receipts refuse. Historical access does not depend on expired source/custody or a former reviewer's current role and never changes state, opens values or authorizes replay. Private signed-session composition exposes inspect; no public registration/UI is claimed.

Missing-method RED then14focused store tests PASS (request test also passed with the new port before the final malformed-result case); strict root types PASS.59actual isolated SQL cases PASS, with positive execution now inspecting both exact saved result IDs after actual fixture reviewer-session revocation and unavailable old source, without a new key read. Fixture `/private/tmp/axiom-platform-pg-xu5m_t57` stopped; see SETTINGS-HISTORY-PG-RECEIPT.json. Source/transport/custody remain simulated; full default qualification/preparation/UI/Task3/4/P01 remain open. No production/provider action or spending.


### Durable settings preparation and original reference — local only

Exact create-only nonsecret selections now become a proposed parent plus immutable settingsManifest in the same existing proposed-event transaction, after private source/current-requester/deadline checks. No new table/column is added. SQL validates manifest/plan/event agreement when writing and reading. Deterministic original requester/session/request references recover the original record after a lost response; matching historic references do not renew expiry, re-review, create duplicate actions or revalidate old source. Changed selections under the same reference refuse. Signed-session private composition has optional explicitly qualified preparation/lookup; without that supplier it refuses. No raw secret is accepted in selection.

Missing-module RED then focused preparation/store/request checks PASS; strict root types PASS.60actual isolated PostgreSQL cases PASS: new concurrent/reference/changed-selection recovery case; all four private executor cases now prepare and read the actual saved manifest through SQL instead of closing over an injected manifest. Source/custody/provider qualification remains synthetic. Fixture `/private/tmp/axiom-platform-pg-rcueewfa` stopped; see SETTINGS-PREPARATION-PG-RECEIPT.json. Public workflow/UI, actual default supplier qualification, remaining ECS/default/legacy coverage and full Task3/4/P01 remain open. No production/schema/provider action, deployment or spending.


### Prepared settings HTTP/default composition and exact-child correction

Prepared strict POST command handling now joins authenticated preparation/lookup/save/preview/review/claim/inspect and one exact child execution. Request identities/outcomes/unknown fields are rejected; input is bounded, errors fixed and responses private/no-store. No implicit claim, child loop, retry or deploy. Private request composition checks request cancellation with possession and only constructs execution when explicit private qualified ports are supplied. The prepared actual default uses existing HMAC/admin/SQL history, saved manifests and unavailable preparation/source/custody, with no credential fallback or execution port. No route is registered.

A deliberate actual SQL regression reproduced that repeating a successful execute-next command could select the following child. Fixed by requiring the exact expected effect index in preflight AND the atomic child-claim wrapper; a repeat of index0 refuses before child1/key/send. This preserves one-command/one-physical-change semantics. Failed fixture dyqqvbls is preserved/stopped, not relabeled as acceptance.

Four focused handler/executor checks and strict root types PASS.61actual isolated SQL cases PASS, including new real in-process HTTP→synthetic HMAC/current SQL→private executor→actual HTTP transport with simulated fetch; repeated child and reviewer execution refuse, current-reader result history succeeds. Fixture `/private/tmp/axiom-platform-pg-b2wd2_8h` stopped; SETTINGS-HTTP-PG-RECEIPT.json records scope. The earlier60test executor repeat regression is superseded by corrected exact-index acceptance only. No public route/UI/provider/custody qualification or full Task3/4/P01 completion. No production/schema/provider action, deployment or spending.


### Operational ECS exact command and acceptance — local protocol unit

Three approved official AWS documentation reads consumed; ECS-EXECUTION-SOURCE-REVIEW.md records exact pages and source-backed credential/rolling-controller/image-tag/result limits. Added installed-SDK UpdateService command construction with explicit reviewed task definition and only selected force behavior. Strict response projection requires exact service/cluster/task, bounded request identity and unique new primary deployment distinct from the original captured ID; it always returns accepted/stable=false/rollbackAuthorized=false. No SDK send/client/credential call occurs.

Missing-module RED then3focused protocol checks/root strict types PASS. No SQL or existing store behavior changed, so no passing PG rerun. Actual private issuance/delegated child/final transport/immutable image and native result qualification remain open; this is not usable ECS workflow or Task4/P01 completion. No provider/account/key/workflow action, deployment or spending.


### Pending-bound private credential issuance — local only

The private delegation store now optionally accepts an explicit qualified issuer; no default exists. A committed pending proof is consumed once, then exact current humans/source/identity/held native generation and issuer qualification are checked before the bounded10second synthetic issuance. Only after actual issued metadata commits and current checks repeat may an opaque WeakMap handle be returned. Raw key/session values never enter history/events/results. Lost/invalid/timed-out issuance records unknown and yields no handle; recording failure preserves pending/issued uncertainty without replay. Reviewer revocation during issuance still permits truthful issued-liability recording but prevents the handle. Existing read-only observation remains non-authoritative and cannot manufacture this handle from JSON.

Missing-method RED then12focused delegation checks/root strict types PASS, including timeout, revoked reviewer, clone/replay and key exclusion.63actual isolated PostgreSQL cases PASS, adding real pending→synthetic issuance→issued-private-handle and issuer-loss→unknown/no-second-mint cases. Latest `/private/tmp/axiom-platform-pg-wop_n25z` stopped; see OPERATIONAL-ISSUANCE-PG-RECEIPT.json. No schema/model change or historical pin renewal. Actual STS/custody/profile, credential-handle child/final-send consumption, transport/result/default workflow and full P01 remain incomplete. Handles are not public send authority; no provider send exists here. No real key/token/issuer/provider action, deployment or spending.


### Private credential-handle ECS child execution — local only

Opaque issued handles are consumed once before child preparation. Actual SQL joins exact delegation/lease/current humans/source/workload/native held generation and transport qualification to the sole ECS child claim. A final one-use callback repeats those checks immediately before the private synthetic send. Credentials are passed only inside the fixed private transport callback, never through JSON/history. Original captured deployment identity is required by the exact acceptance parser. Ten-second timeout or malformed/contradictory/lost result stays unknown; there is no retry, waiter-based rollback or second use of the handle.

Immutable nonsecret operationalResult metadata now records action/manifest/native generation/lease/result identity and DB observation time in the same child outcome event transaction. SQL checks event/delegation/result agreement. Accepted child is command-confirmed but parent remains claimed/not-stable; target reservation stays held pending separately qualified observation. Unknown marks parent/child unknown and retains target/issued-credential liability. Metadata digests are not source/issuer proof.

Missing-module RED then focused result refusal/root strict types PASS.66actual isolated SQL journeys PASS, including3new private issued-handle execution cases: accepted-not-stable/no-reuse, uncertain-no-rollback/native hold, final native-profile revocation/no simulated physical send. Issuer/profile/transport remain SIMULATED; actual SQL and existing signed-workload crypto are exercised. Fixture `/private/tmp/axiom-platform-pg-gbb86u2z` stopped; preceding65case ll6fc9xk preserved/stopped. See OPERATIONAL-ECS-EXECUTION-PG-RECEIPT.json. No default SDK send, actual STS/custody/provider/native-result qualification, registered workflow/legacy replacement or full Task4/P01 completion. No production/schema/provider action, deployment or spending.


### Installed-SDK ECS network boundary — local candidate

Added the actual pinned ECSClient/UpdateService transport with explicit temporary credential inputs, exact fixed regional endpoint, ambient endpoint suppression, maxAttempts1 and no waiter/rollback. The signed HTTP handler validates method/origin/path/action header/exact serialized command/session identity, consumes one send slot and invokes current final authorization AFTER signing, immediately before native dispatch. Abort/expiry is checked again. Existing native bounded-response handler limits success/error streams64KiB and refuses redirects; fixed errors do not expose SDK/provider messages. No default qualified profile is supplied.

Initial actual-SDK tests refused before native dispatch: installed Smithy emits JsonBytesStringAdapter, a Uint8Array subclass rather than a primitive string. Reviewed its local installed source/types; request guard now decodes only bounded string/Uint8Array UTF-8 and still requires exact canonical payload equality. No SDK/schema/historical pin changed. Missing-module/protocol REDs preserved;7focused SDK/protocol checks and strict root types PASS, including real signing with synthetic credentials, ignored ambient endpoints, revoked final callback, cancellation, one-attempt errors, redirects/body overflow.

67actual isolated SQL cases PASS, adding actual private-issued-handle/current-authority/native-reservation→installed SDK→intercepted NodeHttpHandler→immutable acceptance. No socket/request reaches AWS. Synthetic issuer/profile/custody/native response remain explicit; this is not provider/live/default qualification. Fixture `/private/tmp/axiom-platform-pg-prsbefiy` stopped; see ECS-SDK-TRANSPORT-PG-RECEIPT.json. Native observation/stability/conditional rollback, default workflow/legacy replacement/full P01 remain open. No production/schema/real credential/provider action, deployment or spending.


### Original-operation ECS read-only outcome source — local candidate

Actual SQL now reads the sole immutable operational result under the original action lock. A request-scoped source requires that original accepted action/manifest/native generation before any describe; it never discovers a replacement deployment. The first reserved-target transition adopts qualified saved acceptance only. Subsequent bounded10second explicit reads require private current profile/evidence qualification before mapping exact original rollout/counts to accepted/stable/terminal failure/unknown. Missing evidence/read errors cannot establish stability or failure. Unknown-without-original-ID remains blocked. Qualification is repeated around immutable receipt writes; no default source, scan, polling, credentials or provider action is present.

The installed pinned SDK's Deployment field documentation describes supported rolling ECS/non-Classic-LB rollout states; this local source inspection adds no external page read and no source pin change. The structural observation projection is labelled qualificationRequired and grants no execution/rollback authority. Stable native evidence does not itself finalize the original parent, clear issued credential liabilities or execute rollback; those separate joins remain.

Missing-module RED then observation tests PASS; root strict types PASS.68actual isolated SQL cases PASS, adding original-acceptance-required/no-describe→accepted→unrelated completion unknown→exact qualified stable, preserving4immutable native receipts. Describe/profile/evidence remain SIMULATED. Fixture `/private/tmp/axiom-platform-pg-ubo2mk_m` stopped; see ECS-OBSERVATION-PG-RECEIPT.json. Actual SDK read-only supplier, current-reader workflow, terminal parent reconciliation, default/runtime/provider qualification and full Task4/P01 remain open. No production/schema/provider action or spending.


### Installed read-only ECS SDK path — local candidate

Extracted a private fixed-operation signed-request boundary shared by UpdateService and DescribeServices. Method/origin/action-header/exact serialized payload are still checked after signing; a describe request cannot become an update. The new reader requests only the selected cluster and one service, accepts no ambient endpoint/credential supplier, runs a separate final-read callback and retains maxAttempts1/native response limits/redirect refusal/abort handling. It does not reuse consumed write handles. Actual read-only credential/profile/current-reader custody remains a separate unqualified supplier, not an inferred permission.

Missing-reader RED then10focused SDK/protocol/observation checks/root strict types PASS.69actual isolated SQL journeys PASS, adding original SQL acceptance→installed DescribeServices→intercepted native response→qualified simulated exact native stability. First acceptance adoption performs no describe; one explicit read sends one synthetic request. Fixture `/private/tmp/axiom-platform-pg-8n7j_syu` stopped; see ECS-SDK-OBSERVATION-PG-RECEIPT.json. No network reaches AWS; all keys/profile/evidence remain synthetic. Current-reader HTTP/reconciliation, default source/issuer qualification, workflow/legacy replacement and full P01 remain open. No production/schema/provider action, deployment or spending.


### Current-human operational observation request — local only

Dedicated observation now binds an existing delegation/native generation to a CURRENT reader and repeats reader authority after awaited qualified observation. It neither checks old approval as new execution authority nor changes the parent claim/outcome. Stored terminal receipts are labelled historical_terminal_receipt_only, rather than falsely claiming a fresh provider read; nonterminal source observation is labelled checked_by_private_source. Issued credential liability and parentReconciliation=not_performed remain explicit.

Private request composition derives the real human from existing bearer HMAC/current SQL session/user/membership/admin checks, rechecks possession/cancellation around awaits, and exposes only delegate/inspect/observeTarget. It cannot claim as a workload, mint credentials, export handles, send a provider action or approve for someone else. Prepared unregistered default permits current SQL history but refuses missing source/target/profile qualification; no credential fallback or provider allow path.

Actual SQL missing-observe-method RED and missing-request-module RED preceded implementation.13focused request/delegation checks/root strict types PASS.69actual isolated SQL cases PASS: installed DescribeServices test now joins real synthetic HMAC/current-reader composition, observes after actual fixture reviewer revocation and refuses removed bearer possession before another native call. Fixture `/private/tmp/axiom-platform-pg-kky3284u` stopped; failed i9k64z8_ preserved/stopped. OPERATIONAL-READER-PG-RECEIPT.json notes the subsequent types-only unregistered default service addition. Source/custody/provider evidence remains synthetic; actual runtime/profile/credential/reader workflow/parent reconciliation and full P01 remain open. No production/schema/provider action or spending.


### Prepared human operational HTTP boundary — local only

Strict bounded POST commands now expose only exact delegation (action/version/digest), current-reader inspection and one explicit observation. Unknown fields, caller identities, workload claims, credential issuance and execution commands refuse. Authentication precedes parsing; cancellation is checked before dispatch and after awaited results. Errors are fixed, responses private/no-store, and uncertainty directs inspection of the same original action without automatic retry. No route is registered or new default supplier qualified.

Missing-module RED preceded implementation; seven focused HTTP/request checks PASS.69actual isolated PostgreSQL cases PASS: the existing original-acceptance/installed DescribeServices test now runs through in-process HTTP→real synthetic HMAC/current SQL→qualified synthetic observation, including former-reviewer revocation and missing bearer refusal. Fixture /private/tmp/axiom-platform-pg-0s1j39bl stopped. See OPERATIONAL-HTTP-PG-RECEIPT.json. This changes no SQL schema or credential/source qualification. Parent reconciliation, complete workflow/default integration, legacy retirement and full P01 remain open. No real provider call, credential, production action or spending.


### Original operational command recovery history — local only

Current-reader inspection now returns the original parent status/version, child status and immutable typed ECS command result. Delegation claimed, command accepted and native stability stay distinct. Terminal child receipts must match the saved action/manifest/native generation/issued lease, outcome and DB time; mismatched result lineage refuses. History performs no source/provider read, new approval, claim, credential mint, resend, reconciliation or liability release. Current reader authority repeats after storage awaits; historical reviewer/source expiry does not hide truthful recorded results.

Behavioral RED reproduced omitted parent/effect/result fields, then19focused history/HTTP checks and root strict types PASS.69actual isolated SQL cases PASS: current HTTP history returns the original accepted-not-stable command after reviewer revocation and native stability observation, without another intercepted request. Existing unknown execution history cases also pass. Fixture /private/tmp/axiom-platform-pg-p3nvi4oz stopped; OPERATIONAL-HISTORY-PG-RECEIPT.json records exact scope. No schema change, live credentials/provider access or production action. Full terminal reconciliation/default workflow/legacy retirement/source qualification/P01 remain incomplete.


### Durable original ECS proposal preparation — local only

Exact ECS selections now compile into a proposed platform parent and immutable ecsManifest in one existing event transaction, after private current-source/current-requester checks repeated around storage. SQL reconstructs and compares manifest/plan before later use. Original requester/session/reference deterministically recovers the same proposal; changed run/target/selection refuses and history does not renew expiry or source/approval. No new table or migration. Actual source/run/image/native/rollback qualification remains a private unavailable requirement, not client-supplied evidence authority.

Prepared human request/HTTP supports prepare and original-reference lookup; neither approves nor delegates automatically. Default new preparation refuses missing qualification. All operational SQL fixture journeys now prepare/read the actual saved manifest rather than injecting an unattached manifest. One additional concurrent in-process HTTP→real synthetic HMAC/current SQL case proves a single original proposal/event, changed-attempt refusal and historical recovery without calling an unavailable old source.

Missing-module and HTTP lookup REDs preceded implementation.12focused checks/root types PASS;70actual isolated SQL journeys PASS at /private/tmp/axiom-platform-pg-5ryhz4r6 (stopped). Earlier69case lzab2sfq and70case b_we9m5g are preserved/stopped. See ECS-PREPARATION-PG-RECEIPT.json. Independent source-qualified ECS review/preview, default qualification, registered workflow/legacy replacement/terminal reconciliation and complete P01 remain open. No real provider, credentials, schema apply, deployment or spending.


### Dedicated exact independent ECS review — local only

The generic platform review previously accepted an ECS parent without qualifying its saved operational source; behavioral RED reproduced that path. It now refuses ECS, whose dedicated preview/review loads the actual immutable ecsManifest and compares the complete plan. Genuine current reviewer, original current requester, exact version/digest, expiry and private source qualification are checked around storage and asynchronous work. Self-review, stale selection and changed source refuse. Approval writes only the approved parent/event—no delegation, credential, workload claim or provider action. Prepared signed-session HTTP exposes preview/review; no route or live supplier is registered.

34focused store/preview/review/HTTP checks and strict root types PASS.71actual isolated SQL journeys PASS: all operational fixtures now approve through real in-process HTTP/HMAC/current SQL/dedicated review with synthetic source qualification. A new case proves self-review refusal and actual parent/event rollback when source qualification changes after the approved event. Fixture /private/tmp/axiom-platform-pg-m_fesd6w stopped. The prior ui2bvry4 failed only because the fixture returned a removed independent-service variable; it is preserved/stopped, not accepted evidence. See ECS-REVIEW-PG-RECEIPT.json.

Actual account/workflow/image/native/custody qualification, registered end-user workflow, terminal reconciliation, legacy retirement and complete Task3/4/5/P01 remain open. No production schema, real credential/provider action, deployment or spending.


### Prepared operational desktop review client — local only

One shared strict operational command schema now drives server and paired transport allowlisting. Dedicated review client accepts only exact action/source/version-bound preview and approved-decision responses; browser WebCrypto recomputes both manifest and complete plan digests before displaying or submitting. Pure cross-surface plan inputs/DTOs avoid importing server hashing/custody into the desktop. Inspect/preview/lookup are read-classified; observation receipt writes and decisions retain unconfirmed-outcome semantics. No claim, issuance, execution, delegation or automatic retry is exposed by this review client.

A behavioral regression reproduced that account changes during asynchronous digest verification could return a stale usable preview; the client now captures and rechecks account revision/config/cancellation around that work and before transport. Four new client checks plus existing review/HTTP/transport checks24PASS; strict root types PASS. Desktop types/frontend build passed before the subsequent client-only context correction (unregistered client/panel not native accepted). Earlier desktop type failures exposed a server-type dependency path; shared browser metadata types remove it rather than changing aliases or suppressing checks.

71actual isolated SQL journeys PASS at /private/tmp/axiom-platform-pg-gwtedex2 (stopped), with the existing source-revocation review-rollback journey now using this actual client→intercepted fetch→in-process HTTP→synthetic HMAC/current SQL path. That receipt predates only the client currentness correction; final whole-branch validation remains mandatory. ECS-DESKTOP-REVIEW-RECEIPT.json records scope. Customer panel/mounting, actual suppliers/credentials/provider/live/native acceptance, legacy retirement and full P01 remain incomplete. No deployment or spending.


### Prepared ECS independent review panel/workflow — local only

The existing unregistered platform workflow can now use an explicit operational review client for proposed/approved ECS records. Exact account/service/task/run/attempt/expiry are primary; source/role/commit/recovery references sit in a disclosure. Loading is deliberate; genuine independent confirmation is required. Self-review, stale account/action/client context, failed reload and expiry keep approval unavailable. One attempted decision stays held; no delegation, execution or credential control exists. Successful approval reloads authoritative original history rather than inventing a reviewer identity. Consumed ECS attempts stay on history recovery and do not offer fresh proposal approval.

Missing-panel RED preceded implementation. Additional regressions reproduced a surrounding refresh exception overwriting known approval as unconfirmed, and consumed history incorrectly offering proposal loading; both corrected.19mocked React panel/workflow checks PASS. Root types and desktop types/frontend build passed before the noted final narrow UI-only corrections (receipt scopes retained). Native rendering/accessibility/visual acceptance, default supplier qualification, shipping mount, full workflow and P01 remain incomplete. No SQL/provider code changed, so prior71actual SQL evidence is preserved without a duplicate run. See ECS-REVIEW-PANEL-RECEIPT.json. No real approvals, credentials, deployment or spending.


### Private installed-SDK STS exchange and final issuance gate — local only

Pending-bound issuance now supplies a one-use final callback that repeats current original humans/source/workload/native reservation/issuer checks immediately before native credential exchange. A late issuer preparation cannot use earlier authority after revocation/abort. Missing callback never yields a handle; a syntactically known issued response is still recorded as issued liability before refusal, not misrepresented as no issuance. Unknown/lost/timeout remains consumed. Existing post-issuance currentness checks remain.

Added the actual installed STSClient/AssumeRoleWithWebIdentity path: exact regional HTTPS POST, fixed role/session,900second minimum request and generated service-scoped UpdateService session policy. No ambient credential/endpoint, caller policy, extra request fields, redirect or retry. Exact bounded form is checked at native dispatch, private original-token currentness precedes the final callback, native response is64KiB/6seconds and outer store retains10second budget. Issued role/session/account/expiry must match; values remain in the private store only. The900second credential may outlive the action; native liability is never cleared merely by action expiry. Role/trust/task-image/policy/custody qualification still has NO default supplier and provider capability is not inferred from the structural policy.

Missing-module/final-callback REDs preceded implementation.19focused issuer/delegation checks and strict root types PASS, including late revocation/no physical mint, canceled late token, lost response/no retry and missing-callback/known-issued liability.72actual isolated SQL journeys PASS at /private/tmp/axiom-platform-pg-5qocnsns (stopped): new real SQL pending→final gate→installed STS→intercepted XML response→issued metadata/private handle, using a genuinely signed synthetic workload token. Existing installed ECS send/readback journeys pass with the new final issuance gate. No network reaches AWS. See STS-ISSUANCE-PG-RECEIPT.json. No new public docs read, package/pin/schema change, actual token/IAM/grant/provider action, deployment or spending. Default/runtime/workflow/legacy/full P01 qualification remains open.


### Joined one-attempt workload execution — local only

Private runner now connects exact already-delegated action/version0 plus the actual workload JWT to atomic workload/native claim→pending liability→fixed STS issuance/final gate→private issued handle→one exact ECS command/result. All phase proofs, token and credentials remain lexical; public output is the typed nonsecret command receipt. There is no preparation/review, forwarded human session, arbitrary role/target/policy, automatic retry, resume or callback-based credential export. Reinvocation cannot replay the durable original claim. No HTTP/default/actual workflow registration exists.

Parent request cancellation is checked around awaited human/source/workload/native/issuer authorization and merged into STS/ECS request signals. Truthful credential/outcome recording remains available after cancellation; authority is not restored, and known/unknown liabilities are not discarded. Explicit private qualified ports remain required—no test profile is installed as a default.

Missing-module RED preceded implementation.2focused malformed-token/command/early-cancellation checks and strict root types PASS.74actual isolated SQL journeys PASS at /private/tmp/axiom-platform-pg-8z9qi0af (stopped), adding2joined paths: genuine synthetic signed workload/current SQL→installed STS→installed signed ECS→immutable accepted-not-stable history/no replay; and lost STS response→durable unknown issuance/no ECS/no second STS. Native NodeHttpHandler is intercepted, never connected. See WORKLOAD-RUNNER-PG-RECEIPT.json. Actual source/custody/IAM/provider/runtime qualification, workflow/default registration, terminal reconciliation, legacy replacement and complete P01 remain open. No real token/provider action, schema, deployment or spending.


### Fresh native stability finalizes only the original known action — local only

An actual SQL RED reproduced that qualified native stability left the original parent claimed (73other cases passed). Fresh observeTarget can now join the original issued lease, accepted command receipt, confirmed sole child and exact native generation/deployment/stability receipt to finish that original claimed parent as confirmed. Native evidence must follow the command observation time. Current observer authority and private terminal qualification repeat around the atomic parent/event write. The immutable event retains exact native receipt ID, original command digest and actual observer user ID; no token/session/credential value. SQL cross-checks receipt lineage. Original command receipt remains accepted/stable=false rather than being rewritten.

Stored terminal history does not cause a new provider read or new confirmation event. Unknown parents/commands, failure outcomes and stale/invented receipt lineage cannot enter this confirmation path. It does not renew approvals, restore authority, finalize unknowns, authorize rollback or clear issued/unknown credential liabilities. Other held generations still require their separately qualified credential-closure evidence. Terminal failure handling remains a separate exact reviewed flow; full recovery coverage is not claimed.

26focused reservation/delegation checks/root strict types PASS.75actual isolated SQL cases PASS at /private/tmp/axiom-platform-pg-2a1vw6q4 (stopped). Existing installed readback→current-human HTTP journey now confirms the original parent after former-reviewer revocation and records exactly one stable event; repeated history adds none. New actual SQL regression revokes qualification after parent/event write and proves both native stability and parent confirmation roll back, preserving original accepted command/issued liability. Red fixture7b7s7cfy remains preserved/stopped. See ECS-STABILITY-PG-RECEIPT.json. Source/profile/native receipts remain synthetic; no live provider, production schema, deployment or spending. Runtime/default/legacy/full P01 acceptance remains open.


### Original-requester delegation client, panel and lost-response recovery — local only

Independent review and original requester delegation are now separate prepared client/panel stages. The requester loads the exact approved target/run, confirms one explicit delegation and receives only nonsecret delegated/not-requested metadata; no workflow dispatch, credential, private proof or provider execution control exists. Reviewer/current-session checks remain server-derived. Client verifies exact action/manifest/people and refuses substituted run metadata, unapproved/expired source and lost replies without retry. Shared escaped source details keep the two stages consistent. The unregistered workflow gives the requester its own next step rather than the generic execution control.

Actual current source preview now joins the stored delegation row, validates its parent/manifest/requester/reviewer relationship and reports not_delegated or delegated. A delegated record cannot appear as fresh delegation eligibility after reload. This is current qualified preview metadata, not replacement historical execution authority; unavailable/expired source still requires the separate history reader. New state is presentation/recovery only, never permission to claim or issue credentials.

Client/panel missing-feature REDs and actual SQL missing-delegation-state RED (74pass/1fail) preceded implementation.35focused client/panel/preparation/workflow checks PASS across scoped runs. Latest root types PASS after the final lost-reply SQL test strengthening; desktop types/frontend build PASS before that test-only change.15internal demo checks PASS.75actual isolated SQL cases PASS at /private/tmp/axiom-platform-pg-sp2l1w0k (stopped): real original-requester client→HTTP/HMAC/current SQL delegation, genuine reviewer refusal, simulated response lost AFTER commit, fresh read recovers delegated state/no resubmit, then exact signed workload consumes the original delegation through intercepted STS/ECS once. Earlier tzbx2r3e success and8if0q4q7 RED are preserved/stopped. See ECS-DELEGATION-WORKFLOW-RECEIPT.json. No shipping mount/native visual acceptance, live qualification, actual credential/provider action, schema apply, deployment or spending. Full default/legacy/P01 work remains open.


### November12 integrated operational checkpoint — P01 remains open

Full ordinary suite18,355pass/0fail/989pending and production compilation/types304pages PASS on unchanged runtime c0180a37. Separate75actual SQL journeys use synthetic qualification/provider evidence. See [current compact scope and next steps](../recovery/2026-11-12/platform-governance-scope/CURRENT.md) and [integrated validation](../recovery/2026-11-12/platform-governance-scope/INTEGRATED-VALIDATION.md). Complete family/default/registered workflow, pending image/template/deployment owner decisions, fresh whole-source review/one green PR and all existing production/native/live/master acceptance remain open. Nothing was deployed or enabled.


### Operational history final-reader freshness — local only

A synthetic regression reproduced a history response after reader access changed during the last awaited database-time read. `inspect` now repeats the current-reader check after that await, before returning original history. This changes no stored action, credential, approval, provider effect or execution authority. The regression first failed (16 other delegation tests passed), then all26 focused delegation/request/HTTP tests and root strict types passed. No SQL adapter/schema changed; no owned database or provider was accessed. The prior integrated full-suite/build receipt remains scoped to c0180a37 and is not relabeled as validation of this repair. Whole-batch final validation/review and complete workflow/default/live gates remain open.


### Prepared source-independent ECS history client — local only

A strict browser-safe history contract and separate desktop `inspect` client now consume the existing read-only operational command without preview/review/delegation or provider access. It accepts expired historical records, validates exact action/manifest and command-receipt digests plus native generation/lease lineage, rejects secret-bearing fields/claimed execution authority, and discards account changes during asynchronous hashing. Command acceptance remains stable=false even when the parent records later confirmation. It does not expose a fresh native stability proof; immutable proof history and the customer panel/mount remain next work. Shared result-shape definitions moved to a pure module; server hash/semantic checks remain.

Missing-client RED3fail/6pass preceded implementation.36focused client/delegation/HTTP tests and root/desktop strict types PASS. An added test initially supplied the receipt digest to the strict result constructor; that test setup was corrected without changing the constructor. No SQL adapter/schema or live/native acceptance changed. Prior75SQL/full-suite/build receipts remain scoped to earlier source; final whole-batch validation/review is still required. No push, deployment, provider action or spending.


### Prepared operational recovery panel — local only

The optional operational history client now joins the unregistered platform workflow for consumed ECS attempts. Its dedicated panel loads only on explicit request, shows recorded parent/credential/target/run and original command references, distinguishes accepted command from later parent confirmation, and keeps unknown/no-result warnings visible. It clears old facts before reloading and discards account/action/client changes; it contains no review, delegation, observation, execution or resend control. Separate immutable native-stability proof history remains incomplete, explicitly labeled as not checked. No customer registration or installed-native visual acceptance is claimed.

Missing-panel RED preceded implementation.18mocked React panel/workflow checks PASS; strict root/desktop types and desktop frontend build PASS (existing chunk-size and mixed-import warnings remain). The added workflow test initially used a growth-specific load helper and the deferred test had an overly broad resolver type; both test setup issues were corrected, without weakening production checks. No SQL/provider/runtime/native action occurred. Prior integrated full suite/build receipts retain their earlier source scope; whole-batch validation/review and full P01 remain open.


### Immutable original native stability history — local only

Confirmed operational history now reads the unique saved workload.stable_observed event and the exact immutable native receipt it names, not today's mutable target generation. It validates saved parent-state/plan/command digests, action/manifest/native key/generation/deployment lineage and observation chronology. Actual observer, receipt IDs/digests and observed/recorded times are nonsecret metadata; the response explicitly grants no execution authority and checks no current health. The prepared history contract/client/panel accepts and displays this separate historical proof while preserving the original command receipt stable=false. Older optional-client records without proof retain their explicit not-checked label.

Missing-module RED preceded two pure validation tests.33focused tests passed before the final client proof fixture;16focused pure/client/panel checks and root strict types/desktop types/frontend build then passed. Actual isolated SQL initially reproduced history refusal (74pass/1fail): receipt access correctly required its native-key lock. The reader now acquires that original key's lock without reading mutable current target state;75actual SQL cases pass, including former-reviewer revocation and exact saved proof through human HTTP. Fixture /private/tmp/axiom-platform-pg-v4n3x6lq stopped. Three failed fixtures are preserved; one unchanged diagnostic invocation ran inadvertently after its preparation assertion failed, and is not accepted evidence. See STABILITY-HISTORY-PG-RECEIPT.json. No production/schema/provider/native launch/qualification or spending. Full workflow/default/legacy and whole-batch review/validation remain open.
