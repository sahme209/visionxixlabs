# Execution strategy and decision log (Claude, from 2026-11-08)

The single place for **how** the master plan is being executed and **what has been decided**, so work is never redone or re-reasoned. The master plan (`axiom-master-action-plan.md`) stays authoritative. The complete requirement checklist is `master-plan-requirements-index.md` (21 parents plus N0–N4, 312 sub-requirements, all 141 headings mapped).

## Operating rules (user, 2026-11-08)
- Don't miss a single word of the master plan. Keep the plan, board and this log current.
- No GitHub or Vercel spend beyond what's authorized. The repo is public, so standard CI runners are free. **Up to 3 Vercel production builds** are authorized, the third reserved for right before tokens run out, all behind the gates.
- Use tokens wisely. Batch pushes so CI runs less often.
- Aim for a category-leading ($2B) product. Propose competitive edges separately, for approval.
- Everything shipped must be configured properly and actually work. No staged or fake functionality.

## Sequence (two parallel tracks)
**Track A (truth):** security → database → Governance → native journeys → release.
**Track B (story):** visuals → demos → docs → website. B consumes A's real footage and verified claims.

| Phase | Window | Items |
|---|---|---|
| 0 Stabilize | now | N0 verify rotations, CSP tightening, protect Neon `main`. N2 PR #204, then the reconcile sequence, read-only Agent seed and quote-field migration. N1 production build 1 of 3. A separate Preview DB. npm access locally |
| 1A Governance | Nov 9–16 | A2 six-role/filesystem ACL, UID501 (needs approval), directory shape, custody, same-artifact consumer, coverage, enrollment, cutover, live acceptance. N3. A3 ServiceNow CHG0030002 (genuine human reviewers; never decide for Fatima). A4 native walkthroughs. A7 threat model and AI cost |
| 1B Visuals | Nov 9–16 | B2/B6 Home 3D (PR #203) real-GPU check, audit fixes, then one 3D model per page in v4 (Product → Integrations → Security → Pricing → Download → Enterprise → Status). B1 research completion. Animation tool evaluations with license review. CI/CD and Conduit DNA for app screens |
| 2 Integrate | Nov 17–20 | B3 authentic recorded demos (desktop recorded on the user's Mac). B4 full docs with stable IDs and real screenshots. A1 v0.1.22 signed/notarized (paid run and publication decision needed). A6 Outlook plus GitLab design |
| 3 Accept | Nov 21–23 | B6 full qualification, then the publish decision (production builds 2–3). B5 support AI on verified docs. Honest final status report |
| Later | after core Governance | A8 connectors. A9 decisions D1–D4, then adapters, then on-prem. A5 stays deferred. C1–C6 only when authorized, phases 0→3. Monetization: economics audit, then 5 design partners, then the final model |

Deadline risk: the plan rates full scope by Nov 23 as high-risk. Risk is reported before the final week; nothing is faked to meet the date.

## Decision log
| Date | Decision | Source |
|---|---|---|
| 2026-11-08 | Visuals first within Track B | user |
| 2026-11-08 | 3D visual language **v4 locked**: futuristic, clean, high-tech glass and light | user; `docs/design/3d-visual-language-v4.md` |
| 2026-11-08 | **One 3D model per major page; Docs = full documentation with real recorded demos** | user |
| 2026-11-08 | Design DNA from Cursor, Claude, ChatGPT, Harness and Grok, adapted and never copied | user |
| 2026-11-08 | Runtime 3D stack: vanilla three.js (0 deps); drei rejected; R3F deferred | review |
| 2026-11-08 | Repo stays public; leaked Stripe/Resend keys and the Neon password reported rotated | user |
| 2026-11-08 | Vercel Preview shares the production DB, so **no preview deploys** until Preview has its own DB | user-confirmed |
| 2026-11-08 | DB convergence strategy adopted: mark the 11 present migrations applied, roll back the failed agent migration, re-run only the non-granting revision | user; `RECONCILE-PLAN.md` |
| 2026-11-08 | Agent identities for the 2 organizations: **enabled, read-only 9 tools**, as an explicit override of the Oct 23 hold | user |
| 2026-11-08 | **Pricing direction confirmed** (plan L272): Axiom free to explore; **only AI is paid, as optional transparent prepaid usage**; enterprise by scoped evaluation; prices and refund rules shown before any charge; not a token reseller. Exact markup/BYOK/vendor still open (L276). The current per-seat plans ($29/$79) are not the direction | user plus plan |
| 2026-11-08 | Stripe stays donations-only (Founding Supporters) until an explicit payment decision; AI-credit/subscription code stays test-mode | user plus plan L280 |
| 2026-11-08 | User approved proceeding as long as everything is configured properly and works | user |
| 2026-11-08 | **Every part of the website gets the best-fit 3D or 2D explanation**: it must make sense and be clean, clear, powerful, premium and futuristic, but **not flashy**, with DNA from Cursor/Claude/ChatGPT/Harness/Grok; 3D only where it explains better than 2D | user |
| 2026-11-08 | **Typography for every model and page**: a robotic/technical but easy-to-read font that never strains the eyes — a clean geometric sans for text (e.g. Inter / Geist), a monospace only for short labels and codes; comfortable size, generous line height, soft high-contrast (no pure white on black, no thin weights, no all-caps paragraphs) | user |
| 2026-11-08 | **Every element in each model has a visible title**; the whole experience stays calm, relaxed and easy to read — slow gentle motion, low glow, plenty of space, one accent colour | user |
| 2026-11-08 | Product page concept shown (five-layer control plane: Interfaces, Identity and policy, Governance core, Intelligence, Execution and evidence); awaiting approval; will apply the typography and title rules above | claude |
| 2026-11-08 | PR #205 CI failed only on the known intermittent `privateFixtureJoined` Governance test (`fixed_fixture_scenario_unavailable`); 17,545 other tests and typecheck passed; re-run via next push; flake stays on the watch list for a real fix | claude |
| 2026-11-08 | Product page concept approved and built: `ControlPlaneModel` (five titled layers, three titled parts each, slow 9 s pulse, low bloom, Inter text, 2D fallback, reduced motion, software-GPU refusal, frame guard); data in `lib/marketing/controlPlaneModel.ts`; WebGL checks shared in `components/marketing/webglSupport.ts`. PR #205 merged (`8cca4b69`) | user + claude |
| 2026-11-08 | DB check 6: 29/30 indexes exist under truncated/older names; only `Lead_source_idx` missing; extra `AuditEvent.status`/`Lead.phone` harmless (cleanup list). Prepared one all-or-nothing `CATCH-UP-AND-RECONCILE.sql` (ledger = `migrate resolve` equivalent, quote columns + new migration `20261108120000`, `Lead_source_idx`); PR #207; not executed, needs user go-ahead | claude |
| 2026-11-08 | **Production DB catch-up EXECUTED** by the user in Neon (go-ahead "run it"); verified: 0 unfinished migrations, latest `20261108120000`, 13 ledger rows, both quote columns, `Lead_source_idx`, Agent identities unchanged (1). DB gate for production build 1 of 3 is clear once #207 merges | user + claude |
| 2026-11-08 | **Production build 1 of 3 deployed** by the user from `main` @ `a21404f` after all checks were green (the flaky Governance test passed on re-run). Smoke checks passed: `/`, `/product` (new control-plane model), `/plans` (prepaid copy), `/docs`, `/auth/signin`, `/download`, `/integrations`, `/security` all 200; `/pricing` redirects to `/plans`; fresh cache. 2 production builds remain (the last one right before tokens run out). Next: fix the `privateFixtureJoined` flake (it has blocked merges 3 times), then the agreed sequence | user + claude |
| 2026-11-08 | Extra DB columns: no change. `AuditEvent.status` is harmless (wrong-table legacy). `Lead.phone` may hold past lead contact data, so dropping it needs a user decision (export first). Neon foundations steps (protect `main`, daily snapshots, schema-only `preview` branch + Preview-only `DATABASE_URL`) prepared in `NEON-FOUNDATIONS.md` for the user to do in the consoles | claude |
| 2026-11-08 | Neon: `main` protected ✅; daily snapshots 14 days ✅; schema-only `preview` branch created but **not wired**. The Neon–Vercel integration auto-creates (likely full-data) branches per preview deploy, and its setting wasn't found; user chose to move on. Preview deploys stay off; open items: integration setting and deleting the old auto preview branches | user |
| 2026-11-08 | **Page explanations switch from 3D to calm 2D "data moving through pipes"** (user: 3D looked flashy, cheap and unreadable; approved the pipes concept and asked for more explanation, cleaner, a bit of colour). Shared `PipeFlow` kit: stages with titled, explained steps; a labelled packet passed between stages; one muted tone per stage; 14–18 px text; Pause; reduced motion; no GPU. Product page is the reference; the 3D page kit was removed; the homepage keeps its 3D showpiece. PR #208 merged; desktop `real_wire_bounds_total_bytes_and_each_ipc_chunk` timing flake (deadline elapsed on shared macOS runner) added to the watch list | user + claude |
| 2026-11-08 | **Per-level AI cost ranges** on Get started (`/plans`), from `effortLevelCostRangeCents` in `aiRateCard.ts` (Sonnet 5.5, one 1.5x): Inspect (≤2 steps) $0.01–$0.31; Engineer (≤4) $0.01–$0.61; DeepOps (≤6) $0.01–$0.91. Labelled estimates; the exact hold is shown before each action. A test pins the step limits to the agent runtime | claude |
| 2026-11-08 | AI price per level: **one 1.5x for every effort mode** (Inspect/Engineer/DeepOps); price rises naturally with steps and model; show expected cost range per level | user (accepted recommendation) |
| 2026-11-08 | **8 pricing defaults accepted** (audit §5): (1) 10 counted deployments per month per org for everyone, plus per-tenant design-partner overrides; (2) one versioned 1.5x rate card with exact cost per action; (3) $10 minimum top-up, no credit expiry for now; (4) unused balance refundable within 30 days, failed actions auto-released; (5) Stripe one-time Checkout behind the existing live flags (Axiom owns tax compliance); (6) BYOK for enterprise evaluations only, at first; (7) free time-boxed 30–60 day enterprise evaluations with a capped AI credit grant; (8) Sonnet 5.5 paid lane, retired model IDs removed | user; `pricing-economics-audit-2026-11-08.md` |
| 2026-11-08 | **"Get started" pricing concept approved**: Axiom free to explore; prepaid AI usage as the only paid part (credit meter, cost shown first, never over prepaid); enterprise scoped evaluation; all rates/limits/refunds/disclosures before any charge. No live payments; per-seat plans retired from the page; markup stays open | user |
| 2026-11-08 | User away ~5–6 h with standing approval to keep going; merge each PR only when CI is green. Held for the user: deploys (builds 2–3), production DB writes, payments, the Neon preview-integration setting, the Agent seed, and removing secret fallbacks (needs a Vercel env check first) | user |
| 2026-11-08 | Merged: #210 (per-level AI cost ranges; table captions fix), #211 (Security and Integrations pipe flows plus a shared data contract test; Azure view test race fixed), #212 (f24 reports its inner cause), #213 (consolidated threat model, A7.13), #214 (Download page flow) | claude |
| 2026-11-08 | Flake diagnosis: `privateFixtureJoined` now reports `f24<f21>`: a durable release-merge record's state/attempt/version differs from a case's expectation, intermittently. #217 adds the case and observed values to find the race. Second intermittent test found and fixed: `azureGuidedConnectionView` awaited text, then queried a button synchronously | claude |
| 2026-11-08 | Threat model top gaps (A7.13; not an independent assessment, A7.14 open): hand-added tenant filters (the shared gate is barely used, no RLS); secret fallbacks fail open (desktop key → NEXTAUTH_SECRET, vault key → STARTER_TOKEN_SECRET, both verified); 30-day JWTs with no server revocation; no admin MFA; API keys can have no expiry; the exposure scope beyond Stripe and Resend is unverified. Fixes need a user env check or decision first | claude |
| 2026-11-08 | Merged: #215 (approval docs flow), #216 ("How prepaid AI works" on Get started), #217 (f21 case, state and timing probe), #218 (plan entries; three Azure view test races fixed), #219 (permissions docs flow), #220 (truthful tenant-isolation comment) | claude |
| 2026-11-08 | **Security: cross-workspace access fixed in `/api/axiom/*`** (static tenant-scoping audit, `docs/product/security/tenant-scoping-audit-2026-11-08.md`). #221 (merged): preferences (incl. approval policy), operations and chat (conversation ownership) now recheck accepted membership; preference changes need admin. #222: tasks POST could queue apply/rollback against another workspace's run and account, now admin and same-workspace only; tasks GET, diff, explain, retry, onboard and run are checked too. Shared helper `lib/axiom/workspaceAuthority.ts`. Not exploited or confirmed live; production gets these with the next build | claude |
| 2026-11-08 | **Flake root cause (likely):** `f24<f21:execute_*:refused:...:ms~17000>`: the merge was refused before the write, consistent with the transport's real 20 s deadline elapsing on loaded runners. The test's in-memory DB mock hashed every primitive comparison; #223 (merged) compares primitives with `===` (same result). The production deadline is unchanged. Watch: if it recurs, the probe shows the new timing | claude |
| 2026-11-08 | Side notes from the audit (not changed): legacy starter token format may never expire (`lib/starterToken.ts`); legacy starter flow scopes to `organizationId: userId` (personal scope, self-contained). Both on the cleanup list | claude |
| 2026-11-08 | A7: legacy no-expiry starter tokens rejected as expired; cloud snapshot/validate credential ownership verified safe; tenant audit marked resolved | Claude, PR fix/starter-token-legacy-expiry |
| 2026-11-08 | A8: Prefect read-only inventory client (first new Batches provider). Observation only, public-HTTPS base validation, bounded and filter-verified pages. Wiring and live acceptance still open | Claude; PR feat/prefect-readonly-client |

\n| 2026-11-08 | B2: balanced layout. Pipe flows become a compact rail plus a sticky detail panel; one width, padding and section rhythm across marketing pages | user; PR design/balanced-layout |\n\n
| 2026-11-08 | B2: premium balance pass. Centred home hero, shared PageHero, one 1200px content width, steady rhythm; checked with new full-page CI screenshots | user; PR #232 |
| 2026-11-08 | A8: Argo Workflows read-only client, scoped to one namespace, GET only. All three new Batches providers now have read-only clients; next is shared connection storage and wiring | Claude; PR feat/argo-workflows-readonly-client |
| 2026-11-08 | CI: Test split into parallel jobs (typecheck, 3 Vitest shards, build) behind the same required check; wall time ~9.5 → ~6 min | user; PR #229 |
| 2026-11-08 | A8: Dagster read-only inventory client (fixed GraphQL queries only, no caller-supplied GraphQL, no mutations). Wiring and live acceptance open | Claude; PR feat/dagster-readonly-client |
| 2026-11-08 | A8: Batches wiring. Shared connection route and loader plus a read-only observation executor for Prefect, Dagster and Argo, reusing TenantIntegrationConnection (no migration). Agent allowlist registration and desktop UI held for review | Claude; PR feat/batch-providers-wiring |
| 2026-11-09 | **A11 tamper-evident audit** (seal chain over AuditEvent windows, verify detects edited/deleted/inserted events and broken links; additive AuditSeal table), **A12 policy replay** (draft rules replayed through the production resolver over 30 days of approval history; category rules skipped and named, never widened), **A13 change impact preview** (path-based areas, blast radius, rollback outlook, reviewer checks). One page: /dashboard/trust-tools | Claude; PR feat/audit-seal-chain |
| 2026-11-09 | **A10 Agent governance gateway** (direction: everything toward AGI agents). Any MCP agent (Cursor, Claude Code, Codex) asks Axiom before acting: pure policy kernel (allow / require approval / deny), `/api/v1/mcp` plus REST `/api/v1/governance/*`, governance API-key scopes, human decision by an admin who did not mint the key, digest-bound 24h approvals, outcome reporting, `/dashboard/agent-gateway`, SDK methods in TS/Python/Go/Swift. One additive migration, applied only with the owner's go-ahead (see BUILD-3-DB-STEP.md) | user direction; Claude; PR feat/agent-governance-gateway |
| 2026-11-09 | Competitive roadmap (proposed): A11 tamper-evident audit chain; A12 policy replay over 30 days of history; A13 change impact preview | Claude proposal |
| 2026-11-08 | A8: Batches observation tools registered as low-risk, read-only tools in the Agent (Automation profile, Batches diagnostics skill) plus a desktop connect form. Live acceptance is the only open item | Claude; PR feat/batches-agent-and-ui |
| 2026-11-09 | Agent features made discoverable: sidebar entries for Agent gateway and Trust tools (Automation group), plus a 'Govern any AI agent' section on /product with honest limits | Claude; PR feat/agents-discoverability |
| 2026-11-09 | **A14 agent scorecards**: per-API-key evidence over 90 days (approved, rejected, denied, reported success, unreported outcomes) with a plain trust level (new, building, reliable, needs review). Never changes policy. No migration | Claude; PR feat/agent-scorecards |
| 2026-11-09 | `vxl ask` and `vxl outcome`: CI and scripts gate a deploy on the agent gateway (exit 0 only when allowed or approved; waits with polling). 6 new CLI tests | Claude; PR feat/vxl-gateway-cli |
| 2026-11-09 | **Ask Axiom support agent** (user: the website chat becomes the customer support agent bot; DNA from ChatGPT, Claude, Grok, Cursor, Harness; security first). Phase 1 shipped here: grounded answers from a versioned public knowledge base (FAQ, docs headings, reviewed facts), always cited, no AI model call (no cost, nothing invented), refuses pasted secrets and never stores them, routes workspace-specific and action requests to the signed-in app. The legacy chat (old services and VisaNova copy, intentionally disabled for anonymous use) is replaced in the widget. Retired per-user pricing removed from the FAQ | user; Claude; PR feat/ask-axiom-support-agent |

## Ask Axiom support agent roadmap (user request 2026-11-09)

Goal: one support agent that can help with everything about the website and the app, and later act through governed tools.

1. **Grounded answers (done, phase 1).** Public, versioned knowledge with citations. No model, no cost, no hallucination. The bar is security first.
2. **AI-written answers over retrieved passages (gated).** Only for signed-in workspaces that opted in to AI, paid from prepaid credits with a quote shown first. The model must cite the retrieved passages; answers without a citation are refused. Prompt-injection defence: retrieved text is data, never instructions. Needs the B5 runner approval and a cloud-AI data review.
3. **Account-aware help (gated).** Read-only tools for the signed-in user's own workspace (connection health, deployment status, approvals waiting), scoped to their membership.
4. **Governed actions (gated).** Open a ticket, request access, start a diagnostic. Every action goes through the agent governance gateway (A10) with human approval for anything consequential.
5. **Evaluation and improvement.** A fixed question set with expected sources runs in CI; unanswered questions are reviewed weekly (no customer data in the eval set).
6. **Knowledge growth.** Add release notes, changelog and every docs page body (not just headings) with review dates; the living-docs rule applies to support answers too.
| 2026-11-09 | Webhook events for agent governance and audit integrity: agent_gateway.request_pending, .request_decided, .outcome_recorded and audit.integrity_failed, with producers wired (best-effort) and the README event list updated | Claude; PR feat/gateway-webhooks |

## Open decisions (owner: user)
Each reconcile write step (at execution time); a separate Preview DB; UID501 diagnostic; directory-shape decision; paid signed release run and publication; commercial model details and billing vendor; browser access for B1; any C-workstream authorization; the competitive-edge proposals below.

## Competitive-edge proposals (not yet in scope; need approval)
1. A "verifiable claims" page: each website claim links to its test or evidence.
2. An interactive governance sandbox on synthetic data (approve, reject, rollback).
3. A public trust center with an evidence-backed security posture once A7 lands.

## Merged (2026-11-08, no deploy)
- PR #203, the homepage 3D model (v4), restyle, render tooling and planning docs → `main` `68e74afe`.
- PR #204, the converged agent migration plus the deploy-preflight gate → `main` `87ea0882`.

## Watch list
- `lib/governance/qualification/__tests__/privateFixtureJoined.test.ts`: failed on PR #204 (2026-11-08) with `fixed_fixture_scenario_unavailable` at `afterSettled`, within the 60 s bound, while passing on PR #203's runs with identical Governance code. **Confirmed intermittent:** the single re-run passed. It needs its own A2 fixture investigation (a race in the composed scenario); it isn't caused by PR #204.
