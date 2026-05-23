# CLAUDE.md — VisionXIXLabs working agreement

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
npx tsc --noEmit
npx vitest run --reporter=dot

# Desktop
cd desktop && npx tsc --noEmit && npm run build

# Python CLI
python3 -m unittest sdk.python.__tests__.test_vxl_cli
```

All must pass before opening a PR or pushing to main.
