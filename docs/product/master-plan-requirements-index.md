# Master plan requirements index

Index of every requirement in [axiom-master-action-plan.md](axiom-master-action-plan.md) (1,128 lines, 141 headings), checked against [current-execution-board.md](current-execution-board.md) (821 lines). Built 2026-11-08 from a full read of both files. **This index is a navigation and checklist aid only.** The master plan's text is binding. Where this index and the plan differ, the plan wins.

Line numbers `Lnnn` point to the master plan. `Bnnn` points to the execution board. Status markers:

- ✅ done: only where the plan strikes the item through, or says it is verified, complete or passed. This always means the bounded milestone only, never the whole parent.
- 🟡 partial / in progress
- ⬜ not started, or the acceptance evidence does not exist yet
- ⛔ blocked (the blocker is named)

Key fact (L7, L30, L50 and others): **all 21 parents (A1–A9, B1–B6, C1–C6) remain open.** None is complete.

---

## 1. Parents table

| ID | Title | One-line goal | Status exactly as plan states | Gate / approval needed |
|---|---|---|---|---|
| A1 | Release reconciliation and newest reviewed shipment | Reconcile v0.1.22 and ship a signed, notarized, human-approved installer (L123, L224) | "In Progress" (L123) | A specifically authorized paid signed/notarized run; a genuine protected human publication decision. "No new paid run or Vercel exception is inferred" (L123) |
| A2 | Real Governance enforcement | Trusted current-authority admission, coverage, enrollment and native workflow (L103, L225) | "In Progress" (L103). Production coverage empty, activation refuses (L138) | Real qualification of custody, compiled consumer and fleet. "Separately authorized live acceptance before production enablement" (L225) |
| A3 | ServiceNow lifecycle | Reconcile and close CHG0030002 without resending (L105, L226) | "In Progress" (L105) | Human gate: genuine independent reviewers. One specifically authorized closure (L105) |
| A4 | Whole-app clarity and usability | Guided, accessible native journey across all surfaces (L107, L227) | "In Progress" (L107) | Actual native walkthroughs. Local screenshots are not acceptance (L107) |
| A5 | Store/Windows customer installation | Store certification and clean Windows install/update (L131, L228) | "In Progress, explicitly deferred" (L131) | Deferred by user instruction (L228). No Windows host, paid VM or signing purchase is assumed (L131) |
| A6 | Outlook and safe GitLab | Shipped Outlook discoverability plus a safe GitLab connector and sign-in (L127, L229) | "In Progress" (L127) | A separately reviewed GitLab design. Live acceptance (L181) |
| A7 | Enterprise security and AI efficiency | Threat model, independent assessment, measured AI cost (L109, L230) | "In Progress" (L109) | Independent assessment. No absolute security or savings claims (L109) |
| A8 | Integrations, plugins and Batches expansion | Demand-driven connectors from the retained backlog (L129, L231) | "In Progress, most new providers unimplemented" (L129) | Separately authorized live acceptance for each connector (L129) |
| A9 | Orchestrator independence and enterprise on-prem | Airflow/Temporal/custom adapters plus air-gapped deployment (L125, L234–246) | "In Progress, foundations only" (L125). "architecture foundations in progress / runtime migration unimplemented" (L246) | Foundations first. Migration only after core Governance. No cloud purchase, trial or grant (L125, L238) |
| B1 | Six-reference research | Visible walkthrough of Cursor, ChatGPT, Claude, Codex, Harness.io and Grok (L111, L256–262) | "In Progress, parallel" (L111) | Supported browser access (B384). No account creation without approval (L262) |
| B2 | Original premium website | Original IA, visual system and visualizations (L113, L264–410) | "In Progress, parallel" (L113) | Tool and license approvals. Concepts need user approval (L13) |
| B3 | Authentic product media | Real recorded demos with captions and source binding (L119, L412–416) | "In Progress" (L119) | Genuine human decisions for protected actions (L414) |
| B4 | Complete visual documentation | Every screen and control documented with stable IDs (L115, L418–422) | "In Progress, parallel" (L115) | Editorial and shipped-version validation (L115) |
| B5 | Support-AI knowledge | Versioned knowledge, retrieval and evaluation foundation (L117, L424–428) | "In Progress, parallel" (L117) | The corrected runner awaits specific approval (B387). Cloud AI needs a separate review (L426) |
| B6 | Website qualification and authorized delivery | Full browser qualification, then authorized publishing (L121, L430–435) | "In Progress" (L121) | "specific remaining deployment authorization" (L435) |
| C1 | Private founder command center and access model | Founder-only admin console (L441–445) | "Planned / not authorized for implementation" (L216, B415) | Separate authorization. Founder approval for staff roles (L445) |
| C2 | Unified support intake, documentation and AI resolution | Ticket pipeline with cited AI help (L447–451) | Planned / not authorized (L216, B416) | Separate authorization. Cloud models need data and cost review (L451) |
| C3 | Incident response and future governed production assistance | Incident center. Gated production help later (L453–455) | Planned / not authorized (L216, B417) | C3/A2 gates (L477) |
| C4 | Financial and company operations cockpit | Founder-only finance visibility (L457–459) | Planned / not authorized (L216, B418) | Separate explicit authorization for any money action (L459) |
| C5 | AI operations, metrics and continuous improvement | Metrics and a recommendations inbox (L461–465) | Planned / not authorized (L216, B419) | Human accept/defer/reject (L465) |
| C6 | Architecture, phased delivery and acceptance | Modular architecture and phases 0–3 (L467–481) | Planned / not authorized (L216, B420) | Separate authorization. Follows core Governance (L439) |

**Other named work items (not among the 21 parents; from the Nov 8 handoff L3–26):**

| ID | Title | Goal | Status as stated | Gate |
|---|---|---|---|---|
| N0 | SECURITY — public repo secret exposure | Handle the Stripe secret, Stripe webhook and Resend keys exposed in `252d1cf2` (L5) | "top priority". The user reports all three keys rotated, "not independently verified". The repo stays public by user choice (L5) | User's choice. No values recorded |
| N1 | Safe release (CI repair, PR #202) | A green CI and a safe merge without deploying (L12–22) | "In Progress — safe release" (L12). PR #202 "merge approved … not merged yet" (L14) | Required checks. The DB check before any deploy (L14). The next CI run needs the user's OK (L18) |
| N2 | Database compatibility | Prove the production schema, recovery and cutover before a whole-backend deploy (L24) | "In Progress — database compatibility" (L24) | One approved Vercel metadata call, which needs a Vercel connection (L24). READ-ONLY-CHECK.sql (L14) |
| N3 | Memory-only real ACL unit (A2 sub-unit) | Qualify the real ACL in memory (L25) | ~~PASS~~, struck through (L25). Remainder open | Separate gates for six-role, filesystem ACL and custody (L25) |
| N4 | Handoff / return | Keep the Claude handoff and the Codex return copy (L26) | Active (L26) | — |
| X | Standing product requirements (cross-cutting) | Execution contract, acceptance definitions, views (L198–218) | Binding throughout (L198–218) | — |

---

## 2. Sub-requirements by parent

### A1 — Release reconciliation
1. ✅ Immutable v0.1.21 publication and four-platform download acceptance (L123). Preserve v0.1.21 (L224).
2. ✅ Verified private source recovery checkpoint 4d2bc7c6 (L123).
3. ✅ Latest source backed up on private GitHub `main` fe63452f by fast-forward. This is "source preservation, not a successful CI/release" (L9, B434).
4. ✅ Narrow website/security Vercel batch is live and verified, dpl_5h2X…, source 7ea48aa8 (L224, L497–499). "this does not publish the installer" (L224).
5. ⬜ Reconcile the v0.1.22 partial artifacts and the settled spending. Do not treat zero timing-API durations as an invoice (L123, L176, L224, L509).
6. 🟡 Keep the Windows/Linux successes and fix the Mac Swift error. The local correction passes the Intel 10.13 and ARM 11 typechecks; no signed installer exists yet (L123, L224, L509).
7. ⬜ One specifically authorized successful signed/notarized cross-platform run within budget (L123, L224).
8. ⬜ Authentic signing/notarization receipts and exact draft verification (L123, L224).
9. ⬜ A "genuine protected human publication decision", described as a "personal protected publication approval" (L123, L224).
10. ⬜ Exact public download version and hash checks (L123, L224).
11. ⬜ No new paid CI is currently authorized (L123, L176, B390).

### A2 — Real Governance enforcement
1. ✅ Shared native empty-ACL correction plus seven callers, with stubbed RED/GREEN evidence. "Do not repeat these passing tests" (L10).
2. ✅ Static RUN5 package, image verification, outer seal and static mutation review. "Do not rebuild/re-sign/remount old artifacts" (L11).
3. ✅ Memory-only real ACL unit PASS: one compile and one run, synthetic only (L25, B448).
4. ⬜ Six-role proofs, filesystem ACL, custody, install, fleet and full Governance (L10, L25).
5. ⬜ UID501 counts-only diagnostic: "remains unapproved" (L25). The board says it awaits a fresh decision (B14).
6. 🟡 Persistent local preparation recovery design. The plan says it "awaits user approval" (L38). The board records it as later approved and implemented (B312), and records the in-memory experiment as succeeded and consumed (B308). The plan text has not been upgraded; treat this as ambiguous between L38 and B308–312.
7. 🟡 Actual in-memory policy test: "approval is pending and it has not run" (L133, L923). The board records one consumed successful attempt (B308). Ambiguous because the plan's historical text was not updated.
8. ✅ One-shot policy-builder source and CSSM copier prepared and reviewed. The builder was "NEVER RUN" (L103).
9. ✅ Ordinary production build and private-initializer construction verified with synthetic inputs (L103, L903).
10. 🟡 Native delivery preparation is "partial": a constant-zero custodian gate and an unmounted business channel (L103).
11. ✅ Private release mint, commercial reader and merge coordinator composition, e740 build. The private entry is unmounted (L103).
12. ✅ Private Prisma/vault, GitHub App and HMAC/session APIs implemented. These are "not exclusive resource custody" (L103, L142).
13. ✅ Canonical production-loader/compiler conflict corrected. The full website production build passed (L103).
14. ✅ Prebuild native overlay and recorded-copy binding preparation (L103).
15. ✅ Broker/bootstrap preparation and deadline repairs. The binaries were not run (L103).
16. ✅ Bounded outbound compositions, one protected-resource denial matrix, and one native launch component exchange (L103, L144–145).
17. ✅ Verified local milestone table, about 21 rows: private APIs, Coding PR, protected resource, XPC component, resource inventory, observation-only canonical source, 066d package, merge reservation, deployment coordinator, ECS restart, branch/PR, single-file, multi-file, Teams, Linear create and change, Slack, Outlook, associated and legacy Jira, ServiceNow outbound. Each row keeps its stated "boundary still missing" (L140–162).
18. ⬜ Real pre-import executing identity and the same-artifact compiled consumer (L103).
19. ⬜ Complete current-authority, source, revocation, expiry and mutation/credential coverage (L103, L225).
20. ⬜ Fleet, legacy and provider-effect drain/quiescence (L103, L674, L700).
21. ⬜ Native enrollment, review, activation and drift workflow, plus transactional baseline enrollment (L103, L225).
22. ⬜ Actual private provisioning and deployment-wide resource cutover (L103).
23. ⛔ Compiled-consumer dependency-substitution case. It is unverified because the test-generation agent was "blocked by automatic safety review". The requirement is retained (L103).
24. ⬜ Positive and negative real-store end-to-end journeys. Revocation, source and baseline changes must be rejected. "no uncovered mutation bypass". Independent code review (L225).
25. ⬜ Separately authorized live acceptance before production enablement. A2 "Remains incomplete and disabled until then" (L225).
26. ⬜ Native no-write probe: "Required protection failed". A revised controlled-launch topology is required, with no retry and no weaker subset claim (L164).
27. 🟡 Capability-closure design reviewed and local code approved. New restriction runs, mounts and identity activation remain separate (L164, L166).
28. 🟡 Native classifier: a false acceptance was found and conservatively corrected. This "does not provide a usable runtime". The pre-runtime origin candidate is a separate decision (L166).
29. ⬜ "Actual clean handoff and same-artifact qualification—not more executor wrappers—remain the critical path" (L166).
30. ✅ Saved policy-head metadata and fixed-target native replacement implemented and verified locally. The default-OFF 503 remains (L54).
31. ⬜ Legacy/untracked bearer and mixed-runtime transition proof. "empty/new ledger never qualifies old tokens" (L656).
32. ⬜ Precredential reservation and final transport intent across ALL applicable writers, plus provider-effect verifiers (L692, L700).
33. ⬜ Complete current-runtime manifest and aggregate lifetime blockers (L700).
34. 🟡 Remaining shared-writer callers: Agent approval execution, Airflow automation, dashboard restart, direct environment dispatch (L542). Direct dispatch is locally bound (L546). Airflow triggers are locally guarded (L672). The full set is not closed.
35. ⬜ Review the 237 explicit potential writes. "do not use source presence as a coverage receipt" (L524).
36. 🟡 Agent review/execution separation, Tasks 2–5 (L550–574). All local adapters are done (L566). The branch, PR and restart sources are qualified (L578, L594, L620).
37. ⬜ AWS workflow-source qualification and stability before dispatch. "Do not forge a release plan" (L596, L602).
38. 🟡 Release deployment.dispatch caller: optional baseline-bound approval storage passes. The production verifier, HTTP/native review and admission remain (L620).
39. 🟡 Execution-limit native workflow: proposal authoring, DEV entry and restart recovery are local (L516–518, L740–752). Full enrollment and live decisions remain open (L742).
40. ⬜ SAMEPROCESS kernel enforcement before compiled issuer imports. "No private ABI was guessed" (L726).
41. ⬜ Deployment baseline Step 4/5 execution admission and genuine baseline review (L636).
42. 🟡 Classification of remaining mutation, notification, management and platform items. The F17/M03 repairs are done; the broader classification is "NOT complete" (L700).
43. ⬜ Outstanding repository-wide bearers are an unresolved activation gate (L646).
44. ⬜ "do not deploy this batch until runtime qualification and review" (L168).

### A3 — ServiceNow lifecycle
1. ✅ Exact note presence established and old history preserved (L105, L178).
2. ✅ Jira's separate link/closure acceptance is retained (L105, L248).
3. ⬜ Fresh, genuine, independently reviewed observation of the already-written unknown note (L105, L226).
4. ⬜ Saved reconciliation and observed-link proof (L105, L226).
5. ⬜ Native Normal/New approval lifecycle evidence (L105, L226).
6. ⬜ Reviewed terminal policy (L105, L226).
7. ⬜ One specifically authorized closure with confirmed provider state and readback, with history preserved (L105, L226).
8. ✅ Associated ServiceNow link/closure durable reservation and once-only PATCH intent, local only (L162).
9. ⬜ "Finish A3 and guided acceptance before recording claims of full delivery lifecycle" (L485).

### A4 — Whole-app clarity and usability
1. ✅ Nested chat rename and floating-menu IME repair. Native IME acceptance is still open (L107).
2. ✅ Saved-chat title search IME repair (L107).
3. ✅ Agent Enter submission respects the disabled/recovery state (L107).
4. ✅ Native documentation wording corrected. This is text only, not rebuilt (L107).
5. ✅ One exact governed TextEdit edit accepted (L107).
6. ✅ Release intake bound to its originating account/workspace: 8 failures fixed (L50).
7. ✅ Signup flow mutual exclusion (L1048). ✅ Ticket action cards (L1072). ✅ Bot IME (L1092). ✅ Slack pagination draft (L1104). ✅ Desktop composition fixes (L1108). ✅ Release observation batches (L1112). ✅ Intake pending draft (L1124). All are local only.
8. ✅ Supported-runtime whole-project run green at source 3aff0109 (L634). This followed the 29-failing-suite triage (L622).
9. ⬜ Current-source native walkthroughs across Home, Agent, Bot, Releases, repositories, Batches, Apps & skills and Settings (L107, L227).
10. ⬜ Keyboard/accessibility checks and clear light/dark modes (L107, L227).
11. ⬜ Readiness, next owner, outcome, recovery and session behavior (L107, L202).
12. ⬜ "Make one next step obvious; keep technical detail available without clutter" (L227).
13. ⬜ Show meaningful local updates without disrupting saved paired sessions (L107, L200, L850).
14. ⬜ Operational-clarity implications of the CI/CD and Conduit references (L334).
15. ⬜ Original onboarding/UX improvements fed back from B1 first-user research (L262).
16. ⬜ Desktop–cockpit integration parity: clarify catalog purposes and reconcile status readers (B205).

### A5 — Store/Windows (deferred)
1. 🟡 Company identity and unsigned MSIX preparation exist. "unsigned preparation is not acceptance" (L131).
2. ⬜ Store listing, screenshots and age rating (L131, L228).
3. ⬜ Actual Store submission, certification and signing (L131, L228).
4. ⬜ Clean Windows install, sign-in, restart, session and update tests (L131, L228).
5. ⬜ Resolve the website MSI/SmartScreen warning (L131, L180, L228).
6. ⬜ Done "after the main workflow work". Stays deferred until requested or available (L131, L485).

### A6 — Outlook and safe GitLab
1. 🟡 Historical Outlook read-only acceptance and local discoverability are retained. This is "not proof of current connection access" (L127).
2. ✅ Outlook fixed mail-send/calendar reservation and once-only intent, local (L159).
3. ⬜ Shipped/current native Outlook discoverability, sessions and reads (L127, L229).
4. ⬜ An independently designed GitLab connector (L127, L229).
5. ⬜ Distinct safe GitLab sign-in, account linking, consent and repository/CI operations (L127, L229).
6. ⬜ Cockpit Outlook/ServiceNow discovery entries: the local repair is done (B205). Authenticated acceptance is open.

### A7 — Enterprise security and AI efficiency
1. ✅ Extraction metadata readers enforce 128KiB (L109).
2. ✅ Strict observed-endpoint candidate parser. It issues no trusted quotes (L109).
3. ✅ Cron compliance-check diagnostic reflection repaired (L109).
4. ✅ Agent worker exception reflection repaired (L109).
5. ✅ Six handler-level diagnostic bypasses repaired (L109).
6. ✅ Shared internal-error DTO reflection repaired (L109).
7. ✅ Bootstrap threat-model supplement reviewed (L109).
8. ✅ Runtime trust boundaries documented. This is "not an independent security assessment" (L109).
9. ✅ Invitation role/seat safety repair (L109, L707, L717).
10. ✅ Coding run-budget ledger, local (L54). The production schema was applied once (L58).
11. ✅ Admin telemetry separates pending cost from zero (L62).
12. ✅ Four official quote documentation reads (L66). ✅ Installed adapter verified offline (L70). ✅ Local quote mechanism (L82). ✅ Quote-schema rehearsal (L86). ✅ Fee-documentation reads (L1068).
13. ⬜ Complete threat model with tenant, session, secret and tool coverage (L109, L230).
14. ⬜ Independent security assessment, penetration testing and remediation (L109, L230).
15. ⬜ Supply-chain/update integrity and backup/recovery exercises (L109, L230).
16. ⬜ Cloud/local-AI data boundaries and context minimization (L109, L230).
17. ⬜ Measured cost per equivalent successful task, including quality and retries (L109, L230).
18. ⬜ Useful smaller quotes. The default 1000-cent hold versus the 500-cent cap is incompatible (L54, L1044).
19. ⬜ Real pricing, estimator and billable qualification. Canonical quote eligibility is unavailable (L82, L274).
20. ⬜ Proposed fee-accounting contract: "remains unapproved" (L1068).
21. ⬜ Invitation old-token recreation, lifetime/revocation and enrollment/barrier policy (L707).
22. ⬜ Metering, admission and entitlement design for the AI-usage model, without changing production billing (L280).
23. ⬜ Health inference funding repair: a pending decision (B477, B719). Funded-helper migration: pending approval (B477, B747).

### A8 — Integrations, plugins and Batches
1. ✅ The complete requested backlog is retained in remaining-work.md (L129, L252).
2. ⬜ For each selected provider: demand/API/plan validation (L129).
3. ⬜ Least-privilege contract and real supported operations (L129, L231).
4. ⬜ Revocation/recovery, docs and isolated tests (L129, L231).
5. ⬜ Separately authorized live acceptance per connector. "A backlog/catalog logo is not a connector" (L129).
6. ⬜ Batches order: Prefect→Dagster→Argo, then evaluate Temporal, Step Functions, AWS Batch, dbt Cloud, Databricks, ADF (L129, L252).
7. ⬜ "Broader connectors follow stable core workflows" (L485).

### A9 — Orchestrator independence and on-prem
1. ✅ Eleven-seam source dependency inventory (L125, L246).
2. ✅ Six-file Airflow capability/migration mapping. "cancel remains unsupported" (L125).
3. 🟡 Versioned orchestrator contract design and dependency inventory documents. "no adapter migration … implemented" (L684).
4. 🟡 Proposed deployment-origin authority contract. Decisions D1–D4 remain open (B391, B807).
5. ⬜ Orchestrator abstraction layer for Airflow, Temporal and custom engines: execution, status, cancel, retry, events and recovery. Explicit capability detection; unsupported features are reported, never simulated. Preserve Airflow. Governance stays engine-independent. Engine retries never replay consumed operations (L240).
6. ⬜ Fully self-hosted/air-gapped operation: engines, policies, approvals, audit and databases on-prem. Customer-managed encryption, local SSO, optional local AI. Reproducible install, upgrade, backup/restore, monitoring and DR. No mandatory cloud, telemetry or hosted licensing (L241).
7. ⬜ Acceptance: existing Airflow workflows still work. Airflow and Temporal pass the same contract tests. A documented custom adapter exists. No Governance bypass. A real internet-disabled governed deployment. Automated and end-to-end security/audit/rollback/recovery tests. "Simulated adapters … insufficient" (L242).
8. ⬜ Record the architecture decisions before migration, covering 13 named topics (L244).
9. ⬜ Full-process egress coverage. Track every dependency's source, owner, migration, tests and recovery (L246).
10. ⬜ Adapter migration and on-prem deployment follow verified core enforcement (L238, L660).

### B1 — Six-reference research
1. 🟡 Cursor partial: about 22 canonical pages with recorded interactions (L111, L738, L744, L774).
2. 🟡 Claude, Harness, ChatGPT, Grok and Codex have bounded visible walkthroughs. "All six audits remain partial" (L111, L628).
3. ⬜ For each reference: navigation, docs, demos, deeper controls, responsive/keyboard, blocked destinations and original Axiom decisions (L111, L185).
4. ⬜ Inventory every relevant public page and unique interaction, following each button to its destination (L258).
5. ⬜ Checklist of visited and blocked pages (L258).
6. ⬜ Apple as the secondary visual/interaction reference (L258).
7. ⬜ Deliverables: comparison matrix, annotated observations, original IA with page and interaction decisions (L260).
8. ⬜ First-user journey research (sign-up, onboarding, authenticated product) for all six including Grokbot. "required, not yet verified". Unavailable paths are labeled "not observed" (L262, B403).
9. ⬜ Study imagery, hero, motion, typography and visual storytelling for premium quality (L284).
10. ⛔ Visible browser walkthrough: the Work browser is disabled, "no alternate-browser bypass" (B384, B499). Earlier `browser.user unavailable` (L642).

### B2 — Original premium website
1. ✅ Bounded milestones at L113: footer contrast, keyboard bypass, design-tool/motion assessment, three misleading claims corrected, integration operation labels, Bot AI data-flow figure, be82 and ae5 builds, demo illustration labels, tour announcement, website architecture approved, ed0 batch, a25 mobile Close, Product task-led, Download/help batch, first workflow visual.
2. ✅ Task-explicit Product hero (L90). ✅ Website IA first batch (L855–870). ✅ Shortcut/IME repair (L936). ✅ Deployment constellation and Evidence Assembly local and browser observations (B6, B41–43).
3. ✅ Design tool source review, read-only: Teardown, Hairline, Taste, Web Interface Guidelines, Awesome Design. "Nothing installed; concepts need user approval. User set order: visuals first" (L13).
4. ⬜ Complete Product, Integrations, Security, Docs, Demo, Download and support-entry architecture (L113).
5. ⬜ Authentic scoped availability and exact CTAs. Every CTA has a clear destination (L113, L266).
6. ⬜ Original premium, responsive and accessible treatment, with visible local acceptance (L113).
7. ⬜ The first screen communicates Axiom's governance value: who can do what, review, verified results and recovery (L266).
8. 🟡 Deliverable: approved page map, content hierarchy and visual system. The IA is approved (L113). The full visual system is open (L268).
9. ⬜ Distinguish implemented, preview and planned capabilities across the site (L266).
**Early adoption / AI usage / monetization (design only, L270–280):**
10. ⬜ Low-friction first adoption and "five genuine design-partner evaluations" (L272).
11. ⬜ Investigate free-to-explore, optional transparent prepaid AI usage and enterprise evaluations. Not a token reseller (L272).
12. ⬜ Show exact prices, limits, refunds and disclosures before any charge. No dark patterns (L272).
13. ⬜ Mandatory source and economics audit: SDK/Gateway/provider/BYOK routes, ledger, tenants, rate cards, copy (L274).
14. ⬜ Evaluate the business models (1.5x, 2x, pass-through, BYOK, hybrid) with full cost modeling. "2x is a test hypothesis only" (L276).
15. ⬜ Collect willingness-to-pay feedback from design partners (L276).
16. ⬜ Safe implementation design: versioned rate card, immutable ledger, idempotency, quote-before-execution, hard limits deny-default, balances/export, policies for failure, retry and refund, reconciliation tests (L278).
17. ⬜ Draft "Start with Axiom" / "AI usage" / "Enterprise evaluation" messaging (L280).
18. ⬜ Track the decision matrix, cost scenarios and risks in the board (L280, B407).
**Premium visual assets (L284–286):**
19. ⬜ Original production-quality illustrations, workflow visualizations, subtle motion, interactive diagrams and authentic screenshots (L284).
20. 🟡 Replace duplicated Product workflow cards with one accessible step-rail/record explainer (L286).
**CI/CD Reel and Conduit references (L288–334):**
21. ⬜ Turn both Reels into original Axiom DNA without copying assets, layout or branding (L290).
22. ⬜ CI/CD narrative, scene 1: intake and source, plus the governance/external-system boundary (L303).
23. ⬜ Scene 2: checks and artifact. Click/focus reveals purpose, owner, evidence and result. Do not portray Axiom running the build (L304).
24. ⬜ Scene 3: staging and policy. Failed, stale or unknown evidence visibly blocks (L305).
25. ⬜ Scene 4: independent approval. Delivery vs deployment terminology. Never import "NO GATE" (L306).
26. ⬜ Scene 5: controlled execution. Gradual rollout only where implemented. No invented live progress (L307).
27. ⬜ Scene 6: verify, audit and recover, with failed-check, refused/pending and unknown-outcome branches (L308).
28. ⬜ Compare accessible 2D/HTML with Hairline/Teardown. Use 3D only when clearer. Do not reproduce the mechanical pipe (L310).
29. ⬜ Conduit, stable shell and hierarchy: overview → run/stage → detail, in Axiom tokens (L322).
30. ⬜ Overview and pipeline: every metric has a definition, time window and freshness. No invented numbers (L323).
31. ⬜ Runs and drill-down with accessible Back/Close (L324).
32. ⬜ Sources and quality mapped to real evidence. A card never implies a connection exists (L325).
33. ⬜ Purposeful detail panel and motion: redacted code only when relevant; keyboard, touch, reduced-motion and static alternatives (L326).
34. ⬜ Output: workflow storyboard and source map with adapt/reject decisions (L330).
35. ⬜ Output: representative original design (overview, detail, source/quality, failure/unknown) plus a 2D alternative (L331).
36. ⬜ Output: acceptance and handoff definition with a test list (L332).
37. ⬜ Record the storyboard and adopt/adapt/reject rationale before implementation (L334).
**Design and UI quality workflow (L336–350):**
38. ⬜ A consistent original design system: typography, color, spacing, components, imagery, motion, responsive, a11y (L338).
39. 🟡 Evaluate Taste Skill, Web Design Guidelines, Awesome Design, Image-to-Code and Playwright. A read-only review exists (L13). Image-to-Code and Playwright are not covered by that review (L340).
40. ⬜ Prioritize WDG and Playwright for reviews and regression (L342).
41. ⬜ Pilot Taste Skill on one page before broader adoption (L344).
42. ⬜ Inspect and pin third-party skills before adoption (L346).
**Hairline (L352–356):**
43. 🟡 Review the upstream repo, pinned commit, scripts, dependencies, license and provenance. The read-only review is done (L13). Six pinned files were read, executable helpers are unreviewed, and the recommendation is adapt-and-defer (B821).
44. ⬜ Pilot one bounded original visualization in an isolated preview, with real-browser verification (L356).
45. ⬜ Record the adopt/adapt/reject decision with reproducible evidence (L356).
**Teardown (L358–366):**
46. 🟡 Inspect the pinned repo, license (MIT unverified), dependencies and Codex compatibility. The read-only review is done (L13). The Claude-Code-to-Codex compatibility assessment is not confirmed (L360).
47. ⬜ One small isolated original 3D proof of concept compared with a 2D alternative (L362).
48. ⬜ PoC acceptance tests: desktop/mobile, keyboard/touch, screen reader, reduced motion, no-WebGL fallback, low-power, budgets, no external assets. Record pass/fail in the plan (L364).
49. ⬜ The "strong visual-design directive": preferentially evaluate Hairline/Teardown for every meaningful visualization, and document when unsuitable (L366).
**Mandatory visualization standard (L368–376):**
50. ⬜ Every major page has a purposeful interactive visualization (L370).
51. ⬜ An A-to-Z lifecycle explanation: intake → AI analysis → policy/security → approvals → orchestration → execution → validation → audit → rollback (L372).
52. ⬜ Dedicated pages for integrations, networking/data flows, trust boundaries, governance, security, AI interactions, tokens, limits and costs (L372).
53. ⬜ Visuals verified against the codebase, labeled working/simulated/planned, accessible, mobile, reduced-motion, real-browser tested (L374).
54. ⬜ Acceptance rule: each page answers the five questions (what, how, which systems, secured/governed, failure) (L376).
**One 3D model per major page (L378–397):**
55. 🟡 Home `/`, the flagship governed flow. PR #203 at `ad572798` has CI green for types, Vitest, build and website acceptance. "3D scene itself is not yet browser-verified and the performance budget is not measured". It needs real-browser capture (L384, L395).
56. ⬜ Product `/product`, the control-plane model (L385).
57. ⬜ Integrations `/integrations`, the connection topology (L386).
58. ⬜ Security / Cloud security, trust boundaries (L387).
59. ⬜ Pricing, AI usage metering, "only what billing actually implements" (L388).
60. ⬜ Download, pairing and the update/signing chain (L389).
61. ⬜ Enterprise readiness, governance at organization scale (L390).
62. ⬜ Status, health and incident flow, "real data only" (L391).
63. ⬜ Confirm the mapping "page by page" (L380).
64. ⬜ Each model: 2D/static fallback, keyboard, touch, screen reader, reduced motion and no-WebGL support (L380).
65. ✅ 3D visual language v4 locked by the user (L395).
66. ⬜ Source review before adding any realism-stack dependency. Spline and Theatre.js are rejected (L397).
**Restrained premium animation (L399–410):**
67. ⬜ Every effect supports understanding. The dashboard stays calm (L401).
68. ⬜ React Bits: pilot selected components after a license review including Commons Clause (L403).
69. ⬜ GSAP: evaluate only where CSS is insufficient. License review (L404).
70. ⬜ Lenis: native scroll by default. A limited trial only if it demonstrably helps (L405).
71. 🟡 GetLayers: evaluate, then pilot one isolated section. Four official text pages have been reviewed (B385, B498). No MCP, account or purchase (L406).
72. ⬜ Prompt Motion: inspiration only. Original concepts. Review licenses (L407). Its page has not been inspected (B539).
73. ⬜ Accessibility/performance: reduced motion, focus, smoothness and budgets before accepting any effect (L408).

### B3 — Authentic product media
1. ✅ Clearly labeled local-source website screenshots. ✅ The 3bfae851 narrow-guide screenshot with byte/source/version binding (L119).
2. ⬜ Authentic current-source app and website recordings (L119, L414).
3. ⬜ Redaction and consent (L119, L414).
4. ⬜ Source/version binding of the captures (L119, L416).
5. ⬜ Chapters, captions, transcripts and posters (L119, L416).
6. ⬜ Safe playback and focus behavior (L119).
7. ⬜ Homepage demos plus walkthroughs: readiness/connect, governed release, independent review, verified outcome/recovery, Bot tasks, app actions (L414).
8. ⬜ Docs "real recorded demos": authentic captures with no staged success (L393).
9. ⬜ Distinguish scripted simulations, UI previews and verified outcomes (L119, L414).

### B4 — Complete visual documentation
1. ✅ Bounded source guides and bindings at L115: Settings 69, control inventory 757/2688, Agent child 19, Agent 46, cloud, Documentation, Jira, Home/Settings, Releases/Batches, Agent guide, scripted tour, Teams/Linear, Outlook, repository-editor items, catalog, execution limits 33, ServiceNow, Bot, Slack, Docs redirects, Execution plans.
2. ✅ Nov 3–4 [x] drafts and maps: native sign-in (L928), glossary (L951), Outlook (L958), browser pairing (L963), Teams/Linear/Slack (L968), sign-in/Home/Settings (L976–977), Releases/Batches (L984–985), Jira/ServiceNow (L992–993), Agent/repository (L1000–1002), cloud/catalog/Apps (L1009–1011), Apps/Documentation (L1018–1019), limits/teaching (L1026–1027), indexed-guide linkage 26 (L1032), signup/email (L1052), ticket supplement (L1080), Bot maps (L1096, L1100), Releases map (L1116), registered checks (L1120), intake fields 52 (L1128).
3. 🟡 Inventory candidates (2,602 earlier, later 757 files/2688) are all unreviewed (L504, L115).
4. ⬜ Every supported screen and control, including error, empty, disabled, expired and uncertain states (L115, L420).
5. ⬜ Stable help anchors and screen/control IDs. Customer deep links are not implemented (L115, L422).
6. ⬜ For each control: purpose, location, prerequisites, permissions, steps, result, limits, recovery (L420).
7. ⬜ Numbered screenshots and authentic images/demos (L115, L420).
8. ⬜ Document every website button and destination (L420).
9. ⬜ Organize by user goal: search, quickstarts, concepts, task guides, connector references, troubleshooting (L420).
10. ⬜ A coverage checklist so "every dot" is traceable (L420).
11. ⬜ Editorial and shipped-version validation. Owner and last-verified version/date (L115, L422).
12. ⬜ "no undocumented customer-facing control in the release checklist" (L422).

### B5 — Support-AI knowledge
1. ✅ Bot draft r1 bound to 16 source hashes. The validator refuses customer eligibility (L117).
2. ✅ Bounded offline pipeline and simulation evaluator: 52 cases (L117).
3. ✅ Offline Ajv validator, 18 tests, draft revision 2 (L624).
4. ⬜ Reviewed ingestion and the update workflow (L117, L428).
5. ⬜ Version matching and citation-backed retrieval (L117, L426).
6. ⬜ Safe uncertainty and escalation (L117, L426).
7. ⬜ Executed representative evaluations. Proposed cases are not executed (L117, L428).
8. ⬜ Private-content/role boundaries and prompt-injection/data controls (L117, L426).
9. ⛔ Expanded offline evaluation "failed, not accepted" (L1036). The corrected runner "awaits specific approval" (B387).
10. ⬜ Deliverables: knowledge schema, ingestion workflow, Q/A evaluation set, reviewed future support architecture (L428).
11. ⬜ A separate data-boundary/security review before any cloud AI (L426).

### B6 — Website qualification and delivery
1. ✅ Bounded milestones at L121: narrow docs sidebar at 817×847, 019fa045 build/preview, a25/d0/865 builds, the preview blocks mutations, desktop More-menu.
2. ✅ The 38 public destination checks (L432). ✅ Combined production release batch dpl_9M9w (L58). ✅ Nov 3–4 [x] builds and previews: 084 (L929), 002de651 (L944), 1b23 (L1056–1060), d9 (L1088).
3. ⬜ A final changed-source build after the fixes (L121).
4. ⬜ Complete real-browser link, keyboard, responsive, motion, contrast, performance, media and claim checks (L121, L435).
5. ⬜ Playwright repeatable checks plus reviewed desktop and mobile visual-regression baselines (L435).
6. ⬜ Automated a11y plus manual keyboard/focus/contrast. Record browser, viewport, version and performance. Separate automated, manual and assistive-technology results (L435).
7. ⬜ Fix the old favicon fallback/cache identity and show accurate per-platform installer sizes (L435). Note: the live favicon was verified for the narrow batch (L499). Whether the full fix is done is ambiguous.
8. ⬜ Independent final review (L121).
9. ⬜ Separately authorized publishing and exact live acceptance (live favicon, installer links, journeys) (L121, L435).
10. ⬜ Simulated checkout, cancellation and refund paths plus disclosures (L280).
11. ⬜ B6 acceptance for every visualization, 3D model and animation effect (L334, L364, L410).
12. ⛔ No preview deploys until Vercel Preview has its own database. Preview "shares the production `DATABASE_URL`" (L395).

### C1 — Founder command center
1. ⬜ A separate secure admin web/backend: accounts, subscriptions, tickets, releases, health, incidents, security, audit, docs, usage, AI ops (L443).
2. ⬜ Overview, drill-downs, queues, saved filters, search, alerts, history, owner/next action (L443).
3. ⬜ Not exposed through the customer app or website (L443).
4. ⬜ Founder-only access: deny-default, phishing-resistant MFA/passkeys, least privilege, session/device controls, reauthentication, encryption, audit, tested recovery (L445).
5. ⬜ No hard-coded identity. A break-glass process. Staff roles only after review plus founder approval (L445).

### C2 — Support intake and AI resolution
1. ⬜ Intake, identity/entitlement, ticket creation, classification, severity, duplicates, ownership, SLA, history, attachments, diagnostics (L449).
2. ⬜ Responses linked to version, permissions, docs and limits. A self-service help center. An optional local AI with citations (L449).
3. ⬜ Automatic resolution only for allowlisted reversible low-risk actions, with all the listed controls (L451).
4. ⬜ Mandatory escalation categories. Never silently close or invent fixes. Confirm/reopen paths (L451).
5. ⬜ Local AI keeps tenant isolation. Cloud models need data and cost review (L451).

### C3 — Incident response
1. ⬜ Incident center: severity, affected parties, evidence, timeline, owner, communications, mitigations, postmortems (L455).
2. ⬜ AI correlation, drafts and recommendations (L455).
3. ⬜ Production execution later, behind the full gate list. Unknown stays unknown. No unrestricted self-healing (L455).

### C4 — Finance cockpit
1. ⬜ Revenue, MRR/ARR, invoices, refunds, expenses, infra/AI costs, renewals, budgets, cash flow, unit economics (L459).
2. ⬜ Reconciled data marked actual, estimate, pending or missing, with provenance, freshness and currency (L459).
3. ⬜ Budgets, anomaly alerts, cost allocation, forecasts, exports (L459).
4. ⬜ AI cannot move money, refund, change prices, purchase, or access banking credentials (L459). C4 also retains founder financial reporting from the monetization research (L280).

### C5 — AI operations and improvement
1. ⬜ Support, reliability, adoption and AI quality/cost metrics, with definitions, sources, freshness and no vanity metrics (L463).
2. ⬜ A recommendations inbox with evidence, benefit, risk, effort and an accept/defer/reject decision; approved items become traceable work (L465).
3. ⬜ Model/prompt evaluation, red-team tests, feedback loops, rollback, kill switches (L465).

### C6 — Architecture and phases
1. ⬜ Modular admin API, permission data model, ticket/incident store, retrieval, AI orchestration, metrics and adapters. Reuse existing primitives (L469).
2. ⬜ Separate support, finance and production planes. Specify retention, privacy, export/deletion, backup/DR, custody and air-gap compatibility before implementation (L469).
3. ⬜ Phase 0, specification (L471).
4. ⬜ Phase 1, human-operated foundation (L473).
5. ⬜ Phase 2, AI-assisted support (L475).
6. ⬜ Phase 3, bounded automation (L477).
7. ⬜ Acceptance list: E2E journeys, negative isolation tests, knowledge matching, AI adversarial evaluation, reconciled finance, drills, accessible UI, audit, restore, reviewed security (L479).
8. ⬜ Coordination: B4/B5/A2/A7/A9/B6 supply the inputs. Stays future-scoped (L481).

### N0 — Public repo secret exposure
1. 🟡 Live-format Stripe secret key, Stripe webhook secret and Resend key rotated per the user, "not independently verified" (L5).
2. ⬜ No values are recorded. The repo stays public by user choice (L5). No further action item is stated.

### N1 — Safe release
1. ✅ Overlay plus 36 repair hashes verified. Static repair review clean (L12).
2. ✅ CI fully green on PR #202 at `e9cd5f80`: types, Vitest, auth-recovery, website build, Desktop, website acceptance, PG acceptance (L15). "NOT merged, NOT deployed".
3. 🟡 PR #202 merge approved by the user. "waiting on required checks — not merged yet" (L14).
4. ⛔ Deploy is blocked on the production DB compatibility check (L14, L15).
5. 🟡 The 4 Vitest failures needing user decisions at `d06f5105` (L16). **Ambiguous:** this line reads as earlier than the green run at L15. It is unclear whether those decisions were made or the tests were changed.
6. ⬜ Known gap kept visible: health-admission diagnostic `it.fails` (L15).
7. 🟡 PG fixture billing-period fix `c42c7250` (L16).
8. ⛔ `npm ci` on Claude's Mac fails (`ENOTFOUND registry.npmjs.org`). "Do NOT retry until the network or environment changes" (L22).
9. ⬜ Any further CI run needs the user's OK (L18) under the $3 cap (L21).
10. ⬜ Local branch `claude/axiom-ci-test-repairs-2026-11-08`, not pushed (L12).

### N2 — Database compatibility
1. ✅ Offline preflight diagnosis prepared (L24).
2. ✅ Counts-only one-call diagnostic written: 14 mocked cases plus 9 plus 3 pass, with zero provider calls (L24).
3. ⛔ One approved Vercel metadata call. It needs a Vercel connection usable from Claude's session, and none is connected. Not yet run (L24, B447).
4. ⬜ The user runs READ-ONLY-CHECK.sql (L14, B437).
5. ⬜ Prove the target, the two required columns (`admissionContract`, `quoteEvidence`), recovery and cutover (L15, L24, B37).
6. ⬜ Do not deploy the whole backend until compatibility is established (L24).

### X — Standing product requirements (cross-cutting)
1. ⬜ Backend and frontend in parallel. Integrate and verify the complete flow. Show intermediate changes and distinguish preview from production (L200).
2. ⬜ Every flow explains readiness, next action and owner, approvals, verified outcome and recovery (L202).
3. ⬜ A 10-part execution packet for every unit (L208).
4. 🟡 Separate generated views: capability matrix, dependency/decision register, execution brief, adoption inventory. The generator exists (B510). Its content acceptance is open.
5. ⬜ Competitive differentiation: one genuine customer journey from intake to recovery plus one refusal journey. A dated comparison with Harness, Spacelift, env0 and Terraform/HCP (L212).
6. ⬜ AI architecture acceptance: versioned tool contracts, identity, least privilege, consent, budgets, idempotency, redaction, provenance, override, plus offline evaluation sets (misuse, injection, cross-tenant, approval bypass, hallucinated success, rollback, cost regressions). "do not install or replace frameworks by default" (L214).
7. ⬜ Documentation quality: concise brief, append-only log, superseded claims labeled, links resolve, failed checks recorded as open gates (L218).

---

## 3. Standing rules and prohibitions

**Security and credentials**
- The Nov 8 secret exposure is top priority. Rotation is user-reported and unverified. No values may be recorded (L5).
- Preserve credentials, backups, paired app drafts, consumed ServiceNow history and genuine human decisions (L26, B459).
- Preserve tenant boundaries, spending limits, genuine approvals, uncertain outcomes and historical attempts (L202).
- Offline security must not bypass authentication, approval, encryption, update signatures or permissions (L246).
- Never append a provider to unsafe email-upsert identity logic or show a placeholder as connected (L127, L229).
- No military-grade, zero-leak, zero-vulnerability or unmeasured competitor-savings claims (L109, L230).

**Spending and network**
- Conservative estimates are not invoices (L12, L509, B447).
- No automatic CI rerun or new push (L12). The next run needs the user's OK (L18). $3 cap (L21).
- Do not retry `npm ci`. Do not copy node_modules between machines or architectures (L22).
- No new paid CI or Vercel exception is inferred (L123). No cloud purchase, trial, migration or grant under A9 (L125, L238).
- Billing vendors only after evaluation and explicit approval. No account connection, keys, payments, real charges or production switches (L278).
- GetLayers: no purchase, account, remote MCP or unreviewed code import (L406).
- Do not repeatedly rerun passing suites or spend on duplicate CI (L487, L526).

**Approval and human decisions**
- The plan is "not a blanket permission". A historical receipt, unchecked parent, proposal or old approval is not current authority (L206).
- "Never impersonate independent reviewers" (L487). For A3: never reuse expired approval, and never resend, reset, renew or create a descendant of the written unknown note (L105, L178, L226).
- No pending approval is inferred or repeatedly requested (L101, L923, L1060).
- Synthetic review actors are not genuine human decisions (L1064, B165).
- A model-generated recommendation is not a human approval (L672).
- PR #202 merge approval does not equal deploy. Vercel git deploys are off (L14).
- Workstream C requires separate authorization and must not displace the original priorities (L216, L439).

**Honesty and no overclaiming**
- Strike-through qualifies only the exact subtask. All 21 parents stay open (L7, L97).
- A passing mock or build is not a customer outcome (L208). Simulated adapters or a started container are insufficient (L242).
- Do not claim every page was inspected (L258). Unobserved authenticated paths are labeled "not observed" (L262).
- Never stage a successful execution. Label simulations (L393, L414).
- Never substitute marketing language for tested capabilities (L202). Avoid unsubstantiated uniqueness claims (L212).
- A catalog logo is not a connector (L129).
- No percentage or finish-time estimate. The 35% figure is historical (L133, B24).
- Do not rewrite historical receipts. Label superseded claims (L210, L218).
- Never claim a successful release from the push (B434). Do not claim multi-agent execution without a receipt (B535).
- Preserve test assertions. Do not suppress or exclude active tests to get green (L12).
- The November 23 deadline does not turn incomplete or simulated work into acceptance (L32).

**Licensing and copying**
- Do not copy, trace or reuse competitor images, illustrations, animations, layouts or branding (L284, L348).
- Hairline: no `npx skills add`, no skill-directory changes, no package without review and approval (L354).
- Teardown: verify the MIT license independently. Do not assume Codex compatibility or run install commands (L360). No copied 3D assets or external calls without approval (L364).
- React Bits: check for Commons Clause. GSAP: review the exact package license (L403–404). Prompt Motion: review provenance (L407).
- Source review before adding any realism-stack dependency (L397).
- Inspect, pin and approve third-party skills (L346).
- Full font license notices: now retrieved. Publication is not authorized by that retrieval (L814, L820).

**Do not redo or repeat**
- Earlier dated "next/pending" paragraphs are historical, "not instructions to repeat completed operations" (L7).
- Do not repeat the passing ACL tests (L10). Do not rebuild, re-sign or remount old artifacts (L11).
- Do not repeat consumed calls, and do not swap in a website-only release (L24).
- No consumed attempt may be replayed (L103, L164). The 909 packet cannot proceed from its historical bindings (L38).
- Do not repeat consumed provider actions (L248). Do not resend the unknown note (L178).
- The optional vendor checksum diagnostic is retired. Never run it on a late reply (L754, L760).
- Do not reimplement the confirmed limit workflow (L1076). Do not rebuild unchanged source (B344, B360).

**Fixed human decisions and deferrals**
- v0.1.21 is immutable (L123, L224).
- Windows/Store testing is deferred by user instruction (L131, L228, L485).
- Repo stays public by user choice (L5).
- Owner: Claude, "not handed back to Codex" (L21).
- User set the order: visuals first (L13).
- 3D visual language v4 is locked (L395).
- No preview deploys while Preview shares the production DB (L395).
- Fatima: **not mentioned in either file.** No rule can be indexed.

---

## 4. Open user decisions and approvals pending

1. The PR #202 merge is approved but waits on required checks (L14).
2. The user runs READ-ONLY-CHECK.sql for the production DB check (L14).
3. Decisions on the 4 Vitest failures: removed product section, pricing nav behind More, pre-coding reservation provider test, the intentionally RED health diagnostic (L16). Whether these are still open after L15 is ambiguous.
4. The user's OK for any further CI run (L18), the $3 cap, and a `gh` sign-in or a browser-opened PR (L21).
5. A Vercel connection for the approved one metadata call (L24).
6. The UID501 counts-only diagnostic is unapproved (L25, B14).
7. The directory-shape decision (B448, B18).
8. Approval of the design concepts from the tool review (L13). Hairline/Teardown pilots and installs (L354, L364).
9. Confirm the 3D model mapping page by page (L380).
10. Preview gets its own database before any preview deploy (L395).
11. The persistent preparation design (L38) and in-memory test approval (L133, L923). The plan says pending; the board records both as done (B308–312). Ambiguous.
12. The fee-accounting contract is unapproved (L1068). D3 retains the strict contract (B497).
13. The health metadata-only repair decision (B477, B719).
14. The funded-helper migration approval (B477, B747).
15. The legacy bot-chat 503 containment availability decision (B84).
16. The execution-graph containment authority review (B694).
17. The corrected support runner specific approval (B387).
18. The four A9 deployment-origin decisions, D1–D4 (B807).
19. The commercial model decision and the billing vendor approval (L276–280, B407).
20. The browser-access restoration for real walkthroughs (D5, B499).
21. A genuine protected publication decision for A1 (L123). A deployment authorization for B6 (L435).
22. Genuine independent ServiceNow observation and closure decisions (L105).
23. The pre-runtime origin candidate decision (L166).
24. The UID501 and real ACL six-role and filesystem stages (L25).
25. The broker/guard conditional decision in D8 (B502). Marked historical/consumed at B30 and B75, so this is ambiguous.

---

## 5. Dependencies and ordering constraints

1. Security exposure first (L5). Then finish safe-release validation, then the memory-only ACL qualification (B432).
2. The DB compatibility check comes before any deploy. The PR merge does not deploy (L14, L24).
3. No preview deploy until Preview has its own DB (L395).
4. Priority: Governance, custody, consumer and enforcement first. Then native ticket and customer journeys. Then integrated release, website and docs. Independent work runs in parallel (L34).
5. Start A1/A2 with B1/B2 in parallel. "do not let cosmetic work replace Governance enforcement" (L485, L518).
6. App workflow changes supply the B3/B4 media and docs (L485). A3/A4 acceptance supplies the B3 media (L192).
7. Finish A3 and guided acceptance before claiming the full delivery lifecycle (L485).
8. B5 builds on verified docs, then B6 (L485).
9. A5 comes after the main workflow work and stays deferred (L131, L485).
10. Broader connectors (A8) follow stable core workflows (L485).
11. A9: foundations first. Adapter migration and on-prem deployment after verified core Governance (L238, L660). Architecture decisions are recorded before migration (L244).
12. Workstream C: substantial work follows core Governance, verified docs and release commitments (L439). Phase 0 → 1 → 2 → 3 (L471–477). C2 depends on B4/B5. C3 on A2 (L477, L481).
13. Monetization: the source/economics audit comes before implementation (L274). Design-partner feedback comes before the final model (L276).
14. Visual references: record the storyboard and adopt/adapt/reject before implementation (L334). The Hairline/Teardown review comes before installation (L354, L360). Results are recorded before adoption or publication (L364).
15. The real-browser capture of the Home 3D model (real GPU) comes before acceptance (L395).
16. "define acceptance → implement/review → run proportionate verification → save source and evidence → update this plan" (L487).
17. A2: the real ACL qualification comes before any avoidable six-role artifact rebuild (B16, B18).
18. A2 critical path: clean handoff and same-artifact qualification come before more wrappers (L166). Custody and cutover implementation come before activation (L103).
19. User-set order: visuals first, within the B workstream (L13).
20. November 23 readiness target and November 24 target date (L30). Tentative gates: Nov 6–9 prerequisites, Nov 10–16 integration, Nov 17–20 acceptance, Nov 21–23 buffer. Report deadline risk "before the final week" (L32, B28). The assessment rates full-scope completion "high risk/low confidence" (B28).

---

## 6. Coverage self-check: all 141 headings

| Line | Heading | Covered in |
|---|---|---|
| 1 | Axiom master action plan | Title. All sections |
| 3 | November 8 — current handoff | §1 N0–N4. §2 A1, A2, B2, N0–N2. §3. §4 |
| 28 | November 5 delivery target | §5 item 20. §3 honesty |
| 36 | November4 current Governance qualification artifact status | §2 A2-6. §3 do-not-redo |
| 48 | November4 context isolation and source requalification | §2 A4-6, B4-2 |
| 52 | November 4 local document-source workflow milestone | §2 A2-30, A7-10 |
| 56 | November 4 combined production release milestone | §2 B6-2, A7-10 |
| 60 | November 4 last-credit local quality batch | §2 A7-11 |
| 64 | November 4 approved quote research and pipeline source coverage | §2 A7-12, B4 |
| 68 | November 4 installed-adapter evidence | §2 A7-12 |
| 72 | November 4 responsive navigation correction | §2 B6-2 (historical evidence) |
| 76 | November 4 recorded regression failures reconciled | §2 A4 (historical evidence) |
| 80 | November 4 approved local quote mechanism milestone | §2 A7-12, A7-19 |
| 84 | November 4 bounded quote-schema rehearsal | §2 A7-12, N2 |
| 88 | November 4 visible Product hierarchy and full local build | §2 B2-2 |
| 92 | Prioritized numbered checklist — November 3 | §1, §2 all A/B parents |
| 136 | A2 current bounded evidence | §2 A2-17, A2-26–29, A2-44 |
| 170 | Historical control panel — November 2 | §1, §2 (each parent's remaining acceptance) |
| 198 | Standing product requirements | §2 X |
| 204 | Codex execution contract and plan-quality gates | §2 X-3–7. §3 approval |
| 220 | Workstream A — application completion | §2 A1–A9 |
| 234 | A9. Orchestrator Independence | §2 A9 |
| 250 | Integration backlog retained | §2 A8 |
| 254 | Workstream B | §2 B1–B6 |
| 256 | B1. Visible reference-site walkthrough | §2 B1 |
| 264 | B2. Positioning and website architecture | §2 B2-4–9 |
| 270 | Early customer adoption, AI usage and monetization | §2 B2-10–18, A7-22, B6-10, C4-4 |
| 282 | Premium visual assets and original creative direction | §2 B2-19–20, B1-9 |
| 288 | CI/CD clarity and Conduit dashboard DNA | §2 B2-21–37 |
| 294 | Reference 1: CI/CD Reel | §2 B2-22–28 |
| 312 | Reference 2: Conduit Reel | §2 B2-29–33 |
| 328 | Concrete output Codex must prepare | §2 B2-34–37, A4-14 |
| 336 | Codex design and UI quality workflow | §2 B2-38–42 |
| 352 | Hairline design-skill evaluation | §2 B2-43–45. §3 licensing |
| 358 | Teardown interactive 3D evaluation | §2 B2-46–49 |
| 368 | Mandatory Website Visualization standard | §2 B2-50–54 |
| 378 | User directive: one 3D model per page; Docs | §2 B2-55–66, B3-8, B6-12 |
| 399 | Restrained premium animation | §2 B2-67–73 |
| 412 | B3. Record authentic demonstrations | §2 B3 |
| 418 | B4. Document every interaction | §2 B4 |
| 424 | B5. Support-AI knowledge foundation | §2 B5 |
| 430 | B6. Implement, test and publish | §2 B6 |
| 437 | Workstream C | §1 C1–C6. §5 item 12 |
| 441 | C1 | §2 C1 |
| 447 | C2 | §2 C2 |
| 453 | C3 | §2 C3 |
| 457 | C4 | §2 C4 |
| 461 | C5 | §2 C5 |
| 467 | C6 | §2 C6 |
| 483 | Execution order and coordination | §5 items 5–10, 16 |
| 489 | Honest current stopping point | §2 A1 (historical) |
| 493 | Resume evidence — November 1 | §2 A1-4, B1 |
| 501 | Local progress — execution authority and documentation coverage | §2 A2, B4-3 |
| 507 | Latest verified checkpoint — November1 execution-policy endpoint | §2 A1-6, A2, B1 |
| 514 | Native execution-limit workflow progress | §2 A2-34, A2-35, A2-39 |
| 530 | Local progress — final enrollment transition during admission | §2 A2 (historical) |
| 534 | Website reference progress — team pricing to task help | §2 B1-1 |
| 538 | Local progress — actual desktop write connection closure | §2 A2-34 |
| 544 | Local progress — deployment-specific current authority | §2 A2-34 |
| 548 | Approved Agent separation — partial local implementation | §2 A2-36 |
| 554 | Agent separation — parallel backend/frontend increment | §2 A2-36 |
| 564 | Latest parallel local increment — all Agent tool adapters | §2 A2-36 |
| 570 | Local requester API/controls composition | §2 A2-36 |
| 576 | Local branch proposal source binding | §2 A2-36 |
| 580 | Local branch customer composition and parallel website audit | §2 A2-36, B1-1 |
| 586 | Exact branch-flow build and second reference site | §2 A2-36, B1-2 |
| 592 | Local PR source review, checked creation and durable receipt | §2 A2-36, A2-37 |
| 598 | Saved execution outcomes in the next explicit Agent request | §2 A2-37 |
| 606 | November2 restart-source increment and pause | §2 A2-36. §5 |
| 612 | November2 resumed — source-qualified requester HTTP | §2 A2-36, B1 |
| 618 | November2 qualified source, test-environment repair and next real caller | §2 A2-38, A4-8, B5-3 |
| 626 | Added reference and runtime evidence | §2 B1-2 |
| 632 | Current verified whole-project milestone — source3aff0109 | §2 A4-8, A2-41 |
| 638 | November2 remaining-core coverage audit | §2 A2-19, B1-10 |
| 644 | November2 claim and alternate-path qualification | §2 A2-43 |
| 650 | November2 approved native credential-lifetime implementation | §2 A2-31 |
| 658 | Scope extension — orchestrator independence | §2 A9-10 |
| 662 | Current parallel work after A9 scope extension | §2 A2-34, B2-8 |
| 668 | Local merge / Airflow / workforce batch qualification | §2 A2-20, A2-34 |
| 676 | Documentation source freshness after the current runtime batch | §2 B4, B5 (historical) |
| 680 | November2 final-dispatch authority qualification | §2 A9-3, A2 |
| 686 | November2 approved enrollment-drain foundation | §2 A2-32 |
| 694 | November2 release credential V2 | §2 A2-33, A2-42 |
| 703 | November2 current dependency and invitation gates | §2 A7-21. §3 do-not-redo |
| 711 | November2 invitation/collector checkpoint | §2 A7-9 |
| 715 | November 2 continued verified local progress | §2 A7-9, B1-1, B4 |
| 724 | November 2 next core launch gate and approval-guide correction | §2 A2-40 |
| 730 | November 2 corrected native proposal and resumed visible research | §2 A2, B1-1 |
| 736 | November 2 continued Cursor walkthrough and native limit workflow | §2 B1-1, A2-39 |
| 746 | November 2 representative documentation interaction acceptance | §2 B1-1, A2-39. §3 do-not-redo |
| 756 | November 3 reviewed ordinary-build tooling alignment | §2 A2 (historical). §3 do-not-redo |
| 762 | November 3 first actual isolated generation — not accepted | §2 A2 (historical) |
| 768 | November 3 actual corrected generation outputs observed | §2 A2 (historical), B1-1 |
| 776 | November 3 isolated compilation and visible research increment | §2 A2 (historical), B1-1 |
| 787 | Same-font source actual compilation | §2 A2 (historical). §3 licensing |
| 818 | November 3 package preparation and font notices | §3 licensing. §2 A2 (historical) |
| 835 | November 3 verified private data package and local visual preview | §2 A4-13 |
| 853 | November 3 approved website implementation batch | §2 B2-2, B4 |
| 881 | November 3 current browser milestone and maintained checklist | §2 B6. §3 honesty |
| 901 | November 3 — bounded private bootstrap preparation verified | §2 A2-9 |
| 906 | November 3 — trusted-installer design refinement | §2 A2-22 |
| 911 | November 3 — internal repository support draft | §2 B4-2, B5 |
| 916 | November3 — current website preview and bounded core preparation | §2 B6-2, A2-8 |
| 921 | November3 — concrete in-memory qualification packet prepared | §2 A2-7. §4 item 11 |
| 926 | November3 — exact privacy build and native sign-in source guide | §2 B4-2, B6-2 |
| 934 | November4 — website shortcut and compatibility repair | §2 B2-2, A4 |
| 942 | November4 — combined production build and local preview | §2 B6-2 |
| 949 | November4 — glossary authority wording corrected | §2 B4-2 |
| 956 | November4 — Outlook support-knowledge source draft | §2 B4-2, B5 |
| 966 | November4 — app-action knowledge batch and current execution board | §2 B4-2. §2 X-4 |
| 974 | November4 — sign-in/pairing and workspace knowledge batch | §2 B4-2 |
| 982 | November4 — Releases and Batches knowledge batch | §2 B4-2 |
| 990 | November4 — Jira and ServiceNow internal knowledge batch | §2 B4-2, A3 |
| 998 | November4 — Agent workspace and repository knowledge batch | §2 B4-2 |
| 1007 | November4 — connection knowledge and desktop Apps source gap | §2 B4-2 |
| 1016 | November4 — desktop Apps and Documentation knowledge batch | §2 B4-2 |
| 1024 | November4 — prototype limits and website teaching knowledge batch | §2 B4-2 |
| 1034 | November4 — expanded offline support evaluation failed | §2 B5-9 |
| 1038 | November4 — bounded installer-availability claims corrected | §2 B6 (historical ✅) |
| 1042 | November4 — real coding run-budget gap confirmed | §2 A7-18 |
| 1046 | November4 — overlapping signup flows repaired locally | §2 A4-7 |
| 1050 | November4 — previously omitted browser signup/email-proof source unit | §2 B4-2 |
| 1054 | November4 — public guide navigation filter and exact website build | §2 B6-2 |
| 1058 | November4 — updated guarded website preview available | §2 B6-2. §4 |
| 1062 | November4 — local budget ledger approved; Governance source workflow | §2 A7-10, A2-30 |
| 1066 | November4 — four approved fee-documentation destinations inspected | §2 A7-12, A7-20 |
| 1070 | November4 — exact ticket action cards | §2 A4-7 |
| 1074 | November4 — Governance work-selection reconciliation | §3 do-not-redo |
| 1078 | November4 — ticket card source guidance supplement | §2 B4-2 |
| 1082 | November4 — website keyboard recovery and readable paused evidence | §2 B2/B6 (historical ✅) |
| 1086 | November4 — materialized dependency recovery and updated preview | §2 B6-2 |
| 1090 | November4 — Bot composition key preservation | §2 A4-7 |
| 1094 | November4 — finite Bot workspace control map | §2 B4-2 |
| 1098 | November4 — finite Bot composer and launcher map | §2 B4-2 |
| 1102 | November4 — Slack channel pagination draft preservation | §2 A4-7 |
| 1106 | November4 — grouped desktop composition fixes | §2 A4-7 |
| 1110 | November4 — bounded release observation batches | §2 A4-7 |
| 1114 | November4 — finite Releases workspace source map | §2 B4-2 |
| 1118 | November4 — consolidated registered source checks | §2 B4-2 |
| 1122 | November4 — release intake pending draft preservation | §2 A4-7 |
| 1126 | November4 — named intake source guidance and contract requalification | §2 B4-2. §1 C1–C6 note |

**Unmapped headings: none.** All 141 headings map to at least one section. Mostly-historical checkpoint sections map to the parent they evidence. They are not separate requirements.

**Ambiguities flagged:**
- L15 vs L16–20: the Nov 8 CI entries are stacked newest-first without explicit ordering. Whether the 4 Vitest decisions (L16) are still open is unclear.
- L38 and L133 still say "pending"; the board (B308–312) records completion.
- L435 favicon fix vs L499 live favicon verification.
- B502 broker/guard decision "pending" vs B30 and B75, where it is consumed.
- The "ServiceNow note" rule is mapped (L105). **"Fatima" appears in neither file.**

## November 11 supplemental research item (outside the 21 delivery parents)

- [ ] Future technology and deployment assessment: [full brief](future-technology-deployment-assessment.md), scheduled by explicit owner clarification for gaps without delaying current priorities. All eight technology areas, seven evaluation requirements and seven deliverable groups are preserved. Research/recommendations only; not implementation authority, a mandatory feature backlog or a parent-completion claim. See the master plan's “Gap-time research” subsection. Historical line coordinates above remain the November 8 snapshot.

## November 11 supplemental token-efficiency/tooling requirement

- [ ] Cross-cutting [token efficiency and useful repositories/tools](token-efficiency-and-tooling-assessment.md): evidence-backed selection, actual usage/cost baselines, unchanged quality/security/approval boundaries and no automatic adoption or claimed savings. Separate Axiom runtime usage from development-assistant usage. Linked in the master plan; existing delivery-parent counts and requirements remain intact.


## November 12 mandatory competitive product standard

Open cross-cutting acceptance requirement: [A new benchmark beyond Harness](axiom-master-action-plan.md#hard-rule-a-new-benchmark-beyond-harness). Apply it across the complete application/site/cockpit and prove claimed advantages with concrete customer-workflow evidence; feature parity and visual imitation alone do not satisfy it. This does not relax security, genuine approvals, honest availability or spending controls.


## November 12 — guided CI/CD setup for teams without DevOps staff

Open planned enhancement: [guided CI/CD setup](axiom-master-action-plan.md#guided-cicd-setup-for-teams-without-devops-staff--owner-addition-november-12). Reuse existing capabilities for a plain-language, button-driven repository-to-pipeline journey with optional governed AI help, inspectable branch/PR configuration, explicit permissions/costs/review, staging, separate production approval and clear outcomes/recovery. It is not marked implemented or live. Existing security, tenant, budget, genuine approval, provider/production and manual-deploy rules remain; continue the current Governance work first.
