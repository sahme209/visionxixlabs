# Axiom unified capability and launch gap matrix

Audit date: 2026-10-15. Source baseline: main `ea88095c` (PR #104 merged).
Authority: [Unified master mission](AXIOM_UNIFIED_MASTER_MISSION.md). Preserve
the original mission, product architecture, historical evidence, and decisions.
The unified mission assigns engineering, product, design, architecture,
governance, QA, and launch coordination to Codex; no separate Claude review is
required to continue. Founder approval gates remain unchanged.

## Evidence and completion accounting

The historical ~85% estimate is not an audited completion percentage. A new
overall percentage would be misleading until journey acceptance criteria and
weights are established. This is an initial source/test/deployment audit, not
a complete live integration or visual audit. Source presence is never sufficient
to mark an end-to-end capability complete. No launch-readiness claim is made.

Classification uses: implemented and live-validated; implemented and automatically
tested; partially implemented; UI-only or mocked; blocked by external credentials
or approvals; not implemented. A row may have implemented subcomponents but an
externally blocked overall journey. Unreviewed scope is explicitly identified
instead of being invented as complete or not implemented.

| Capability / journey | Classification | Current evidence | Concrete gap / next verification |
| --- | --- | --- | --- |
| Production web deployment | Implemented and live-validated, limited to page serving | #104 main deployment `dpl_5D5K3JPrHYEEbx4nbdLiNpKCHB5m` is READY; #103 direct deployment sign-in page was HTTP 200 | Custom domain alias still identifies #102; approved promotion and domain-specific verification are separate gates |
| Preview deployments | Blocked by external service configuration | Three historical previews and a same-commit retry fail before build with Resource provisioning failed; no build events | Vercel project/team diagnostics or support must expose specific provisioning cause; no speculative code workaround |
| Production password/Google/GitHub login | Blocked by external credentials or approvals | Callback logs show Prisma P2022 for missing User.emailVerifiedAt; providers endpoint registers all three | Actual schema/ledger, founder mapping, approved recovery, and real browser round trips; no success claim |
| Read-only recovery preflight | Implemented and automatically tested | #103 script; #104 protected manual workflow, read-only transaction, public-safe output; SELECT-only PostgreSQL fixture exercised | Founder must configure protected email and run manual main workflow; runtime has no production DATABASE_URL; private admin config remains unverified |
| Migration chain | Partially implemented | Email-verification SQL preserves fixture identities/roles and constraints; fresh replay reaches 99 files then fails on missing Organization in workspace-agent migration | Inspect real unfinished/applied ledger and partial schema before changing historical SQL or applying any pending financial migration |
| Browser workspace authority | Partially implemented; focused security repair automatically tested in PR #105 | Main ignores acceptedAt; paired desktop resolver checks acceptance. PR #105 requires acceptance on initial/recovery lookups; four regressions fail before and pass after; full 5,156-test candidate suite passes | Review/merge the independent PR, then verify released behavior; no production mutation or claim of complete tenant isolation |
| Paired desktop session and capability authorization | Implemented and automatically tested, journey externally blocked | resolveRequestDesktopSession, desktopToken, pairingChallenge and associated tests; PRs #88–#98 already merged in current ancestry | Continue route-by-route caller audit; install/pair/revoke/expire/wrong-tenant testing on exact packaged app |
| Commercial access and plans | Partially implemented; policy discrepancy | desktopCommercialAccessPolicy currently returns allowed=true; ADR-021 describes an active-plan wall; product vision describes no-charge invite-only pilot | Reconcile intended pilot and operational authority before changing gates; do not silently activate checkout, alter pricing, or lock out legitimate accounts |
| AI modes and effort | Implemented and automatically tested | decisionLoop resolves Inspect=2, Engineer=4, DeepOps=6; AgentChatView exposes existing modes and receipts | Real tenant/model/tool journey and cancellation/retry QA; preserve mode budgets and approval boundaries |
| AI Gateway attribution and 1.5x settled-cost billing | Implemented and automatically tested | reconcileGatewayUsage and settleAIUsageToStripe; reservation/settlement migrations and tests exist | Authoritative Gateway/Stripe test-mode reconciliation on approved isolated accounts; no unit-test claim of live financial validation |
| Stripe protections, credits, caps, replay | Implemented and automatically tested at reviewed boundaries | settlement rejects live keys; opt-in/test mode required; durable reservations and idempotency present | Full ledger and concurrent refund/replay audit plus approved Stripe test E2E; no live invoice/subscription/pricing changes |
| AWS/ECS | Partially implemented; live evidence limited | AWS adapters, connection validator, read-only validation workflow #99, ECS workflow serialization #82 | Preserve founder-reported real ECS deployment evidence without generalizing it; validate exact tenant target, OIDC, rollout/rollback and negative paths on authorized nonproduction account |
| Azure | Partially implemented | SDK-backed connection validator and preview scanner exist; azureAdapter applyAction/rollback are explicitly not implemented | Inventory-to-selection contract and authorized SDK tests; design governed execution before claiming Azure mutation support |
| GCP | Partially implemented | SDK-backed project validator and preview scanner exist; gcpAdapter applyAction/rollback are explicitly not implemented | Project selection, inventory contract, permissions/error handling and authorized live checks; no fabricated write success |
| Tenant GitHub integration | Implemented and automatically tested at reviewed boundaries | tenant token resolution, app installation records, repository evidence, branch/commit/PR tools and tests | One real test-org app install and selected-repository/revoke/expiry journey; preserve separate legacy admin subsystem |
| Terraform | Partially implemented | Existing runner, planning/review and governance paths; legacy apply default-deny documented in execution backlog | Trace each reachable apply path, approval/plan integrity, state lock and recovery; no production apply or simulated execution claim |
| Airflow 3 and dependency scheduling | Partially implemented; atomic-claim repair automatically tested in PR #107 | Existing client/schedule/tick/executor/durable models; PR #107 fixes concurrent attempt claims, rejection races, stale retries and pending-approval consumption; candidate passes 529 files / 5,157 tests | Durable post-dispatch uncertain-outcome reconciliation remains open; continue approval/revocation, dependency, timeout/cancel audit; real Airflow endpoint needed for live acceptance |
| Governed deployment lifecycle | Partially implemented | releaseops policy/approval/execution/validation/evidence modules, durable ledgers and workflow templates | Trace request→readiness→approval→schedule→execute→validate→rollback/closure on exact target; do not infer lifecycle coverage from individual kernels |
| Desktop click-first engineering journey | Partially implemented | AgentChatView has repository/environment context, effort modes, proposal review and usage receipt; native shell exists | Real packaged screenshots and keyboard/empty/loading/offline/retry/cancellation journey audit; preserve advanced controls and existing tokens |
| Desktop packaging/updates | Implemented and automatically tested at historical release boundaries | Version 0.1.20 frontend/release-alignment build passes locally; historical signed 0.1.11 evidence in claim map | Current native cargo unavailable here; macOS installer/signing/notarization/update/clean-host acceptance must be verified for exact release, not borrowed from older versions |
| Website/account/team/support/download | Partially implemented | Existing companion, auth/signup/verification, download manifest, billing portal, contact and privacy surfaces | Route-by-route journey and claims audit; password verification recovery UX, mobile/accessibility/performance checks; no redesign required |
| Audit, RBAC, tenant isolation and secrets | Partially implemented | secure audit store, current workspace context, desktop capabilities, credential vault and tests exist | Boundary-by-boundary negative tests including pending/revoked membership, logs, cross-workspace reads, SSRF and restore paths; product controls are not certification |
| Design system / visual QA / accessibility | Partially implemented; audit incomplete | Existing premium dark/orange design, shared components, native conventions and claim map | Token/component inventory, real screenshots, keyboard/focus/contrast and long-task interaction audit; no speculative visual rewrite |
| Architecture and durability | Partially implemented; audit incomplete | Existing Tauri/React/Next/Prisma split, pure kernels and narrow I/O conventions in CLAUDE.md/DECISIONS.md | Reconcile stale decisions with current code; inspect queue claims, plan versions, cancellation, uncertain outcomes and separation of duties before selecting new infrastructure |
| Product strategy / partner launch | Blocked by external validation; review incomplete | Founder-defined five design-partner goal and governed playbook positioning; no new customer evidence supplied | Prioritize reliable onboarding and one verified journey per partner; founder owns commitments, commercial terms and launch approval; no invented adoption or competitive superiority |

## Priority and value matrix

Cloud-local follow-up after the initial snapshot: paused-rule claims are fixed
in local commit `e20ec878`; the subsequent candidate holds uncertain provider
outcomes instead of replaying them, persists an intent/known receipt, rechecks
current approver membership/capability on retries, and exposes a clear desktop
review state with failure-safe busy handling. These changes are not merged,
deployed, or live-validated. Automated crash detection, provider-receipt lookup,
and a governed reconciliation/reset journey remain open. No production or
commercial readiness percentage is upgraded by this local code evidence.

Effort is a relative planning estimate, not a delivery promise. Readiness records
whether useful software work can proceed without external credentials.

| Priority | Next milestone | User value / differentiation | Effort | Risk | Readiness |
| --- | --- | --- | --- | --- | --- |
| P0 | Real auth recovery and approved domain routing | Every account/desktop journey depends on it | Small–medium once ledger known | High: identity/production schema | Blocked on protected preflight and approved recovery; keep proposed operations concrete |
| P1 | Accepted membership parity and remaining desktop auth audit | Prevents premature workspace authority | Small per boundary | High security consequence | Independent software work; focused regression fix first |
| P1 | Agent tool authorization / proposal integrity / spending review | Makes natural-language operations governable and costs understandable | Medium | High security/financial consequence | Code/tests independently actionable; no live mutations |
| P1 | Durable automation claim/retry/approval audit | Prevents duplicated or unauthorized scheduled actions | Medium | High operational consequence | Source/test audit actionable; external dispatch remains gated |
| P2 | Exact AWS/GitHub/Airflow vertical journey, then Azure/GCP gaps | Real cross-provider execution evidence | Medium–large | High during execution | Independent error/contract work available; live tests need approved accounts |
| P2 | Click-first onboarding and account→desktop journey | Reduces expertise required without hiding governance | Medium | Moderate | Incremental design/contract work; packaged/user acceptance externally gated |
| P3 | Visual/accessibility/architecture consolidation | Calm, understandable engineering workspace | Medium | Low–moderate if incremental | Reuse existing components; fix measured friction rather than redesign |
| P3 | Release and partner launch evidence | Commercial credibility and supportable promises | Medium | High if claims outrun evidence | Native/live/partner acceptance still external; never announce readiness prematurely |

## Decision and execution rules

- Source/test/live/deployed evidence remain separate; all new PRs receive their
  own CI status. Older source snapshots and matrix claims are not auto-promoted.
- Keep PRs small and independent. Do not recreate PRs #75–#104 or copy billing,
  Gateway, pairing, provider, or scheduler systems already present.
- Preserve the approved desktop/web separation and existing visual tokens;
  the unified mission broadens review ownership, not authorization for a rewrite.
- No new framework/database/orchestrator is selected by this audit. Use existing
  persistence and authorization models first; record justified decisions.
- Production routing, migrations, deployments, cloud mutations, live billing,
  merges, pricing and launch remain explicit founder-controlled actions.
- While production access is blocked, continue independent high-priority code,
  design, architecture and governance work. Do not repeatedly request the same
  missing information or claim unattended background work.
- Existing historical ledgers remain evidence: AXIOM_EXECUTION_BACKLOG.md,
  AXIOM_MASTER_MISSION_STATUS.md, DECISIONS.md, CLAIM_EVIDENCE_MAP.md, and
  AUTH_LOGIN_RECOVERY_2026-10-15.md. Resolve conflicts against current code and
  the founder's latest mission instead of deleting history.
