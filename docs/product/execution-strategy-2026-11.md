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
