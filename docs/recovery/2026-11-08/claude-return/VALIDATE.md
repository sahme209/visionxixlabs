# Codex validation for Claude's branch — UNVERIFIED until these pass

Claude could not install dependencies (npm registry blocked on its Mac), so **nothing below has been type-checked or tested**. Use your **existing** `node_modules`. Do not copy `node_modules` between machines/architectures.

## 1. Get the branch (no push was made; no CI triggered)

Bundle: `Axiom-Claude-Branch-2026-11-08.bundle` (in the OneDrive Documents folder). Verify its sha256 against `BUNDLE.sha256` next to it, then in your checkout (preserve your dirty tree first — stash or use a worktree):

```bash
git bundle verify /path/to/Axiom-Claude-Branch-2026-11-08.bundle
git fetch /path/to/Axiom-Claude-Branch-2026-11-08.bundle claude/axiom-ci-test-repairs-2026-11-08:refs/heads/claude/axiom-ci-test-repairs-2026-11-08
git worktree add ../axiom-claude-validate claude/axiom-ci-test-repairs-2026-11-08
```

Base is `fe63452f`. Branch commits: `329bbcaa` (overlay + CI repairs), `4b00f741` (ACL result), later docs-only commits. Your 36 dirty files are byte-identical to the overlay in `329bbcaa` (hash-verified), so in the worktree they are already applied.

## 2. Full types (must be 0 errors)

```bash
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false
```

The new worktree has no dependencies. On the same machine, link your existing install (do not copy, do not reinstall):

```bash
ln -s "$PWD/node_modules" ../axiom-claude-validate/node_modules   # run from your existing checkout
cd ../axiom-claude-validate
```

## 3. Changed unit tests (42 files)

```bash
node scripts/run-vitest.mjs \
  lib/axiom/agentRuntime/__tests__/agentActionDeploymentExecution.test.ts \
  lib/axiom/agentRuntime/__tests__/proposalReview.test.ts \
  lib/desktop/__tests__/agentActionExecutionHttp.test.ts \
  lib/desktop/__tests__/governanceEvidenceView.test.ts \
  lib/desktop/__tests__/governanceIntelligenceClient.test.ts \
  lib/desktop/__tests__/outlookDraftDisclosure.test.ts \
  lib/desktop/__tests__/releaseProviderMergeApprovalClient.test.ts \
  lib/desktop/__tests__/serviceNowWrittenObservationComposition.test.ts \
  lib/desktop/__tests__/ticketGovernanceClient.test.ts \
  lib/desktop/__tests__/ticketGovernancePanel.test.ts \
  lib/desktop/__tests__/workspaceChrome.test.ts \
  lib/governance/intelligence/__tests__/baselineService.test.ts \
  lib/governance/intelligence/__tests__/collectHttp.test.ts \
  lib/governance/intelligence/__tests__/deploymentRequestAdmission.test.ts \
  lib/governance/intelligence/__tests__/discovery.test.ts \
  lib/governance/intelligence/__tests__/executionPolicyHttp.test.ts \
  lib/governance/intelligence/__tests__/githubDiscovery.test.ts \
  lib/governance/intelligence/__tests__/governedProviderMerge.test.ts \
  lib/governance/intelligence/__tests__/governedReleaseDeployment.test.ts \
  lib/governance/intelligence/__tests__/kernel.test.ts \
  lib/governance/intelligence/__tests__/linearChangeOutboundDrain.test.ts \
  lib/governance/intelligence/__tests__/linearCreateOutboundDrain.test.ts \
  lib/governance/intelligence/__tests__/mergeRequestAdmission.test.ts \
  lib/governance/intelligence/__tests__/mergeRequestAdmissionV2.test.ts \
  lib/governance/intelligence/__tests__/nativeGitCredentialLeaseStore.test.ts \
  lib/governance/intelligence/__tests__/reviewHttp.test.ts \
  lib/governance/intelligence/__tests__/scopeAwareAdmission.test.ts \
  lib/governance/intelligence/__tests__/slackOutboundDrain.test.ts \
  lib/governance/intelligence/__tests__/uncoveredProviderMerge.test.ts \
  lib/tauri/__tests__/releaseProviderMergeTransport.test.ts \
  app/control/integrations/__tests__/presentation.test.ts \
  app/docs/audit-logs/__tests__/page.test.ts \
  app/docs/execution-plans/__tests__/page.test.ts \
  app/docs/surfaces/__tests__/page.test.ts \
  app/security/__tests__/securityScope.test.ts \
  lib/integrations/__tests__/connectedTeamsOutboundFreshness.test.ts \
  lib/integrations/slack/__tests__/slackOutboundFreshness.test.ts \
  lib/notifications/__tests__/webNotificationRoutes.test.ts \
  lib/releaseops/__tests__/jiraOutboundFreshness.test.ts \
  lib/releaseops/__tests__/serviceNowOutboundFreshness.test.ts \
  lib/releaseops/__tests__/serviceNowPreflightInspection.test.ts \
  lib/releaseops/__tests__/serviceNowTicketTransport.test.ts
```

## 4. Changed PG tests (5 files) — owned isolated fixture DB only

Run only with your existing owned isolated PG fixture authorization/setup. **Never** against production or a default branch.

```bash
node scripts/run-vitest.mjs \
  lib/axiom/agentRuntime/__tests__/agentActionExecutionCoordinator.pg.test.ts \
  lib/axiom/agentRuntime/__tests__/agentActionExecutionStore.pg.test.ts \
  lib/desktop/__tests__/associatedTicketJourney.pg.test.ts \
  lib/governance/intelligence/__tests__/mergeRequestAdmission.pg.test.ts \
  lib/workforce/pipelines/__tests__/codingRequestQuote.pg.test.ts
```

## 5. Full suite, desktop, Python (CLAUDE.md pre-push gate)

```bash
npx vitest run --reporter=dot
cd desktop && npx tsc --noEmit && npm run build && cd ..
python3 -m unittest sdk.python.__tests__.test_vxl_cli   # Claude: PASS, 30 tests
```

## Non-test changes to review

- `tsconfig.json`: `docs/recovery` added to `exclude` (2 archived evidence TS files only).
- Fixture files: lib/governance/intelligence/__tests__/fixtures/reviewedDeployment.ts.

## Still gated after this passes

No deploy until: types + tests pass, one frozen production build passes, and the production DB compatibility check (`admissionContract`, `quoteEvidence`, recovery, cutover) passes under fresh authority. No push/CI without spend approval.
