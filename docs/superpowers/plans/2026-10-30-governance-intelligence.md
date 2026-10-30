# Governance Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover read-only organizational evidence, propose an exact human-reviewed baseline, and enforce its typed rules deterministically in explicitly enrolled scopes.

**Architecture:** Extend existing lib/governance models/evaluator and existing approvals/audit workflows. Add immutable evidence/baseline artifacts and a strict admission wrapper; retain all existing provider/executor guards. Local implementation remains separate from production activation.

**Tech Stack:** TypeScript, Zod, Vitest, existing Prisma/PostgreSQL durable stores, React/Tauri, current GitHub/AWS adapters.

**Spec:** docs/superpowers/specs/2026-10-30-governance-intelligence-design.md (user-approved local implementation October30).

## Global Constraints
- No live customer reads, migrations, new grants, paid AI calls or deployment.
- Read-only allowlisted discovery; unknown/partial data is never proof of absence.
- Approved rules only narrow provider/workspace permissions; no model-generated authority.
- Exact immutable revision and genuine authorized human decisions; atomic active pointer; no self approval.
- All mutations in enrolled scopes require covered admission; uncovered/unavailable routes deny.
- Implement natively in this session; user requested no routine implementation checkpoints.

## Review Focus
- Tenant crossover through identical artifact bytes: every hash envelope and store lookup includes organization.
- Prompt injection and malicious document references: text is data; no URL fetch/tool execution.
- Missing evidence or unknown action/condition: deterministic deny in enrolled scopes.
- Concurrent activation, revocation and stale approval: compare-and-swap plus preclaim/prewrite checks.
- Partial pagination/provider denial: mark incomplete; no absence finding or compliance claim.

### Task 1: Evidence, baseline and deterministic admission kernel
Files: create lib/governance/intelligence/contracts.ts, compiler.ts, admission.ts and __tests__/kernel.test.ts. Reuse lib/governance/policyModel.ts and policyEngine.ts through a strictly validated subset.
Interfaces: parseEvidenceSnapshot(unknown); compileBaseline(input): immutable digest-bound compiled result; evaluateGovernanceAdmission(request, activeRevision, evidence, coverage): allowed/denied/requires_approval with typed reason codes and matched rule IDs. No I/O or activation from compilation.
- [ ] Write tests for organization-bound hashes, malformed scopes, missing facts, unknown rules/actions, deny precedence, real approval evidence required, no-match refusal and uninvolved unenrolled scopes.
- [ ] Run focused Vitest and observe missing-module failure.
- [ ] Implement closed actions/scopes and canonical digest binding; never use generic engine.allowed as authority.
- [ ] Run focused tests/types; commit only kernel and tests.

### Task 2: Bounded evidence collection and documented requirements
Files: create lib/governance/intelligence/discovery.ts, documentRequirements.ts and corresponding tests.
Interfaces: discoverEvidence(scope, selection, readPorts, signal): EvidenceSnapshot; parseUploadedPolicy({organizationId,name,utf8Bytes}): source evidence + unresolved/supported requirements. Ports are current verified connection readers; GitHub GET and AWS explicit read command allowlists only.
- [ ] Test malicious references, oversized uploads, unsupported MIME, cancellation, pagination bounds, denied/partial pages and tenant changes before provider reads.
- [ ] Implement bounded ports and deterministic known-control extraction with exact byte/line evidence. Ambiguous text remains unresolved.
- [ ] Verify no SDK mutation or arbitrary network request is reachable; test and commit.

### Task 3: Immutable revision, approval and activation composition
Files: create lib/governance/intelligence/revisionStore.ts, approvalComposition.ts, __tests__/revisionStore.test.ts and isolated PG journey. Reuse existing durable workflow/history/approval mechanisms; inspect precise storage fit before choosing an additive local schema proposal.
Interfaces: proposeBaseline(scope,candidate); approveBaseline(scope,id,version,digest); activateBaseline(scope,id,expectedActiveDigest); revokeBaseline(scope,id,version); readActiveBaseline(scope,selection). Exact actor capability checks through existing authorizers, audit events through existing store.
- [ ] Test tenant-bound reads, immutable history, self approval, stale/edited digest, duplicate decisions, concurrent activation and revocation.
- [ ] Implement atomic active revision pointer and typed audit receipts; no PolicyProposal upsert can activate it.
- [ ] Run isolated actual PostgreSQL journeys with mocked external facts; no production database or migration.
- [ ] Commit verified store/composition and explicit storage limitations.

### Task 4: Execution coverage and current-authority integration
Files: create lib/governance/intelligence/coverage.ts and admissionGuard.ts; modify only reviewed existing executor admission seams discovered in this task; corresponding integration tests.
Interfaces: assertGovernanceAdmission(scope,exactPlan,phase:'before_claim'|'before_write') returns receipt or throws denial. Every coverage entry identifies fixed action/resource classifier and both enforcement seams.
- [ ] Test unknown routes/actions, missing coverage, unavailable active revision, authority revocation and active revision change between claim/write.
- [ ] Wire Agent/repository/Bot/deployment/integration surfaces incrementally; preserve independent approvals/one attempt and current access.
- [ ] Deny enrollment without complete registered coverage; disclose unenrolled legacy behavior.
- [ ] Commit only with per-surface evidence receipts; never claim universal coverage from one kernel test.

### Task 5: Governance workflow and drift
Files: existing app/control/governance and native policy views; new lib/governance/intelligence/drift.ts and HTTP/client contracts in existing authenticated patterns.
Interfaces: compareBaselineEvidence(approvedRevision,snapshots): verified drift|unknown|no verified change with source citations; existing inbox exposes proposal diff/approval/active revision/decision history.
- [ ] Test stale/partial sources, conflicts, unsupported extraction and remediation without provider effects.
- [ ] Build native/web flow using existing navigation; exact review digest and evidence sources visible, approval never automatic.
- [ ] Verify mocked HTTP/client/native journeys, types/builds, independent final review and exact local source bundle.
- [ ] Document remaining schema/activation/provider/human gates; no production enablement.

Plan self-review: all spec sections map to tasks1–5. MVP uses bounded UTF-8 text/Markdown uploads, optional model assistance remains off, scheduling deferred. No implementation-method approval requested because user explicitly selected autonomous local progress without routine checkpoints.
