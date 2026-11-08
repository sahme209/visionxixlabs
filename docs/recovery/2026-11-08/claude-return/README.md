# Claude → Codex return — November 8, 2026

## Where the work is

- Machine: Claude ran on a different Mac (user `sahme209`); the original Codex checkout path does not exist here.
- Clone: `~/visionxixlabs`, from GitHub `main` at `fe63452fc1eeea34b39c0a72e8e72e3a04420629`.
- Branch: `claude/axiom-ci-test-repairs-2026-11-08` — **committed locally, NOT pushed** (a push would trigger paid CI; no new CI authority exists). The commit hash is in the commit itself; run `git log -1` on this branch.
- Input: `Axiom-Claude-Handoff-2026-11-08.zip` (portable overlay, base `fe63452f`), unpacked to `~/axiom-handoff-2026-11-08`.

## What is verified

- ~~All 53 overlay files match `MANIFEST.json` sha256; every target was at its base hash or already identical — no manual merge needed.~~
- ~~All 36 files match `claude-handoff/unverified-source-files.json` after transfer.~~
- ~~The OneDrive RTF master plan contains no content missing from the overlay markdown (only link-markup differences); the overlay copy is the working master.~~
- ~~Static review of the 36 Codex repairs (diff-only): 0 `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` added; 0 `.skip/.only/.todo`; `as any` unchanged (11→11); `: any` reduced 35→18; `expect(` 130→131; `toThrow` 14→14.~~ This is a static scan, not a semantic or compiler review.

## What Claude edited (all UNVERIFIED — no compiler or test has run)

Targets the 27 errors in 15 files that were outside the 36-file batch:

| Cause (from handoff) | Files | Change |
|---|---|---|
| Invalid Testing Library `exact:true` | `app/control/integrations/__tests__/presentation.test.ts`, `app/docs/{audit-logs,execution-plans,surfaces}/__tests__/page.test.ts`, `app/security/__tests__/securityScope.test.ts` | Removed the option; string `name` already matches exactly. |
| Freshness fixtures infer `Mock` return | `lib/integrations/__tests__/connectedTeamsOutboundFreshness.test.ts`, `lib/integrations/slack/__tests__/slackOutboundFreshness.test.ts`, `lib/releaseops/__tests__/{jira,serviceNow}OutboundFreshness.test.ts` | Annotated `assertCurrent`/`beforeSubmission` mocks as `Promise<()=>void>` so replacement callbacks type-check. |
| ServiceNow fetch mocks infer `[]` args | `lib/releaseops/__tests__/serviceNowTicketTransport.test.ts` (lines 76, 82), `serviceNowPreflightInspection.test.ts` | Mock signature `(..._a: Parameters<typeof fetch>)`, matching the `fetchImpl?: typeof fetch` port. |
| Notification fixtures omit `evidenceRefs` | `lib/notifications/__tests__/webNotificationRoutes.test.ts` | Added `evidenceRefs: []` (required by `OutboundNotification`). |
| Archived evidence compiled from wrong location | `tsconfig.json` | Added `docs/recovery` to `exclude`. Only 2 tracked TS files live there (both `source-preview` evidence); no active test excluded. Vitest uses its own `include` list. |
| Governance eligibility (5 errors) | none | Expected to clear via Codex's `DeploymentPlan` annotation in `fixtures/reviewedDeployment.ts`; **not confirmed**. |

No assertion was removed or weakened; no suppression or `any` cast was added. No production source changed.

Also updated: `docs/product/current-execution-board.md` (Nov 8 item 2) and the master plan Nov 8 item 4 — subtasks struck through only where verified; all 21 parents remain open.

## Checks and results

- `npm ci`: **FAILED** — `getaddrinfo ENOTFOUND registry.npmjs.org` (machine-wide DNS, also outside the sandbox). `--offline` failed: cache incomplete (`zod-validation-error-4.0.2`). `node_modules` is not installed.
- Full `tsc --noEmit --incremental false`: **NOT RUN** (no dependencies).
- Targeted vitest: **NOT RUN**.
- Python CLI: `python3 -m unittest sdk.python.__tests__.test_vxl_cli` — **PASS, 30 tests** (no npm needed).
- Desktop types/build: **NOT RUN** (no dependencies).

## External effects

None. No push, CI run, Vercel/Neon call, deployment, database access, credential read, signing, native/ACL unit, or spend. The handoff's consumed preflight attempt was not repeated. Memory-only ACL unit: user approved running on Claude's Mac; 1 sandboxed compile + 1 run, both PASS and consumed — see `../native-acl-memory-platform/RESULT.md`. Different host/toolchain from Codex's.

## Remaining blockers (in order)

1. Install dependencies on a machine that can reach the npm registry (or configure an approved internal mirror), then run full types and the changed tests. Expect possible residual errors beyond the recorded 190.
2. Freeze one candidate and do the coherent production build.
3. Production preflight is still unresolved; it needs a reviewed diagnosis and fresh bounded authority. The `PipelineAICallReservation.admissionContract` / `quoteEvidence` schema gate is unchanged — do not deploy the backend past it.
4. A new push/CI run needs fresh spend authorization (the $2 allowance was for the one Nov 8 main update).
5. A2 memory-only ACL unit: PASS on Claude's Mac (in-memory only). Next A2 gates (six-role proofs, filesystem ACL, custody, install) need their own approvals.

## Uncommitted files

None on this branch after the commit; `node_modules` is absent.
