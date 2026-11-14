# CLAUDE.md — VisionXIXLabs working agreement

## November14 — real Linux compilation/linking pass; final symbol evidence remains blocked

The one approved compatibility run at `7c35aec14a424caab5c4a52cb0d163a5583ad0fa` completed and its authority is CONSUMED. Actual restricted C/Rust fixtures, tiny offline Cargo, full daemon-feature Rust compilation and whole Rust+C/no-undefined linkage PASS. The existing strict symbol checker rejects its first required Rust path (`missing_actual_rust_path`). Actual symbol rows were not retained; formatting is a source-supported hypothesis, not an established cause. ELF/output checks after the old gate were not reached. No accepted artifact or completed Governance qualification exists. All seven ordinary exact-head CI checks PASS; PR331 stays OPEN/UNMERGED, main/production unchanged.

Evidence: `docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-IPC-OBSERVED-RESULT.json` and `BUILD-IPC-PR331-CHECKS.json`. A LOCAL correction now captures same-artifact raw/demangled names, hashes, ELF and final source checks before the byte-identical strict gate; an independently bounded primary receipt prevents bulk metadata losing evidence again. All39 focused pure tests PASS. Frozen35-input packet SHA256 `3ecb86f637d86aa8610e9544895b7a6cbe073a8319c77d6994bb73fc8aa0014c`. Fresh explicit approval is required before ONE same-profile compiler observation; it is NOT yet authorized or pushed. Original failed results remain unchanged.

Full Governance remains INCOMPLETE/DISABLED. After artifact acceptance, actual Linux worker/private bootstrap and custody, protected policy/time/lifetime/fleet qualification, genuine independent-review and real end-to-end provider/closure journeys, and production acceptance remain. Local/simulated tests do not substitute for these. All master-plan, owner decisions, cost/security/database/deployment restrictions remain. Older snapshots below are historical.


## Living-docs rule (Phase 405)

**No feature is considered complete unless its documentation + demo entry is updated.**

When you change ANY of the following, update the corresponding artifact in the SAME commit:

| You changed | You must also update |
|---|---|
| A `/dashboard/*` route | `<ModuleIntro>` props on that page (title, explanation, helps-you-do, connect-first, AI engineers, approval, `lastReviewed`) |
| A `/api/v1/*` endpoint | The matching SDK methods (TS, Swift, Python, Go) + `sdk/README.md` |
| A `WebhookEventKind` | The producer call site + `sdk/README.md` event list |
| A connector | `connectFirst` text on every module that mentions it |
| An AI engineer | `aiEngineers` array on every module that uses it + `/dashboard/workforce` |
| An automation / workflow | The matching scenario in `lib/demo/demoScenarios.ts` |
| A pricing/plan limit | The Pricing & Usage demo scenario + `lib/billing/planRegistry.ts` |
| A monitoring/security/database surface | The matching demo scenario + `<ModuleIntro>` approval note |
| The sidebar (`DashboardSidebar.tsx`) | The Setup Guide step deep-links if any moved routes |
| The desktop app | The Desktop App Pairing demo scenario |
| Docs guides / public help knowledge | Keep sidebar, heading index, generated support corpus and guide-count checks synchronized (36 guides). Source-ground public claims in current screens and handlers; preserve required support-eval accuracy. |
| Compiler tooling | Keep strict native TypeScript checks explicit; retain the pinned JS compiler API for AST/Next/fixture consumers until separately reviewed. No automatic historical packet renewal. |
| Tailwind styling | CSS-first themes in `app/globals.css` and `desktop/src/styles.css`; retain explicit source globs and the intentional unlayered utilities cascade. Verify compiled shared-diff layout and browser dark/light styling. |
| **Internal growth automation** | KEEP internal-only (`audience: "internal_only"` in the scenario) |

### How to update demo scenarios

`lib/demo/demoScenarios.ts` is the single source of truth for product walkthroughs. To add or modify a scenario:

1. Edit `DEMO_SCENARIOS` in that file.
2. Bump `lastReviewed` to today's ISO date.
3. Run `npx vitest run lib/demo/__tests__/demoScenarios.test.ts` — the contract tests enforce: every scenario has ≥3 steps, unique step ids, valid approval closed-union members, and the `internal_growth_automation` scenario stays internal-only.

### Workspace-kind rule

**Demo data must NEVER appear in a real workspace.**

Every code path that returns mock/example data must be guarded by either:

- `if (isSandboxWorkspace(orgId))` at the entry point, OR
- `assertNotDemoLeak(orgId, "<surface name>")` at the boundary (throws `DemoLeakError` if it fires on a real workspace).

Workspace kinds:

- `ws_sandbox_*` → sandbox (public `/demo` route)
- `ws_internal_*` → internal (eval runner, admin)
- anything else → real (paying customer; NEVER show demo data)

See `lib/workspace/workspaceKind.ts`.

## Architecture principles

- **Pure kernels** for every decision (closed-union outcomes; no I/O).
- **IO boundary** = one narrow file that composes pure kernels with Prisma/fetch.
- **Closed-union TypeScript** is the primary safety mechanism — typos in scope strings, event kinds, audit actions, etc. are compile errors, not runtime denial bugs.
- **Best-effort wrap** every audit + webhook + usage write in `try { ... } catch { /* best-effort */ }` so observability outages never block business events.

## Validation before push

```bash
# Web
npm run typecheck
npx vitest run --reporter=dot

# Desktop
cd desktop && npm run typecheck && npm run build

# Python CLI
python3 -m unittest sdk.python.__tests__.test_vxl_cli
```

All must pass before opening a PR or pushing to main.
