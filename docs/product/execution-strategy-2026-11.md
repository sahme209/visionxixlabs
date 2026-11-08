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

## Open decisions (owner: user)
Each reconcile write step (at execution time); a separate Preview DB; UID501 diagnostic; directory-shape decision; paid signed release run and publication; commercial model details and billing vendor; browser access for B1; any C-workstream authorization; the competitive-edge proposals below.

## Competitive-edge proposals (not yet in scope; need approval)
1. A "verifiable claims" page: each website claim links to its test or evidence.
2. An interactive governance sandbox on synthetic data (approve, reject, rollback).
3. A public trust center with an evidence-backed security posture once A7 lands.

## Watch list
- `lib/governance/qualification/__tests__/privateFixtureJoined.test.ts`: failed on PR #204 (2026-11-08) with `fixed_fixture_scenario_unavailable` at `afterSettled`, within the 60 s bound, while passing on PR #203's runs with identical Governance code. Treated as **possibly flaky**: one re-run of the failed job was requested. If it fails again, investigate the scenario race (A2 fixture), not the migration change.
