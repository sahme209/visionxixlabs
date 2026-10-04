# Deployment Rehearsal Feature Specification

**Requirement:** 9 — Deployment Rehearsal Investigation  
**Status:** Specification & Planning Phase  
**Priority:** Medium-high (improves release confidence)

---

## 2026-10-03 status update — read this before the rest of the document

Everything below this notice was written around a **live-cloud-account**
rehearsal design (a real sandbox AWS account, real provider API calls,
CloudTrail logs, per-run cost estimation). That is a materially different
and much larger thing than what the current product direction actually
wants: a **safe, plan-only, non-secret** pre-production check — dependency
checks, Terraform *plans* (never apply), policy validation, rollback-artifact
validation — with no live infrastructure execution and no claim of
production parity. Building the design below as written would require
real customer cloud credentials this project does not have, and would
cross a line ("arbitrary infrastructure execution against a cloud account")
the current direction explicitly avoids. Treat the "Implementation Phases,"
"Timeline Estimate," and "Sandbox Account Strategy" sections below as
**not current direction** — kept for historical record only.

**What already exists and satisfies the actual (narrower) requirement,
verified directly against source on 2026-10-03:**

- **Terraform plan (never apply) as the default boundary, for the Axiom
  governed workspace** — `lib/execution/terraformBoundary.ts`'s
  `evaluateTerraformBoundary()` defaults every provider to
  `planAvailable: true, applyAvailable: false` and only flips
  `applyAvailable` to `true` when four independent gates are *all* green
  (broker credentials present, an explicit apply feature flag, a ready
  audit sink, desktop signing readiness) — with an honest
  `whyApplyBlocked` message listing exactly which gates are missing.
  `applyFeatureFlagOn` is hardcoded `false` at both call sites
  (`app/dashboard/orchestration/page.tsx`,
  `app/api/orchestration/terraform-boundary/route.ts`) and
  `AXIOM_TF_APPLY_ENABLED` is never read from `process.env` anywhere in
  the codebase — this boundary is a pure, read-only status reporter; it
  does not itself run Terraform.

  **Correction (verified 2026-10-04): the paragraph above does NOT
  describe `/api/terraform/plan`, `/api/terraform/approve`, or
  `/api/terraform/apply`.** Those three routes
  (`app/api/terraform/plan|approve|apply/route.ts`) are a wholly
  separate, pre-existing system — `lib/terraform/runner.ts` — built for
  the older, leadId/starter-token-based public self-serve "Cloud
  Operator" product, not the Axiom organization/workspace model. It
  **does** shell out real `terraform init && validate && plan`
  (`/api/terraform/plan`) and, after an explicit human types the exact
  phrase `"CONFIRM APPLY"` (`/api/terraform/approve`, checked again
  server-side before executing in `terraformApply()`), **real**
  `terraform apply -auto-approve -no-color`
  (`lib/terraform/runner.ts` — `terraformApply()`) against whatever
  cloud account that lead connected. Its only gates are: a signed,
  time-limited starter token proving ownership of the lead record, and
  the CONFIRM APPLY phrase + a server-side re-check of
  `job.approvedAt`/`approvedBy` immediately before the real `apply` call
  runs. It has no relationship to `terraformBoundary.ts`,
  `applyFeatureFlagOn`, the audit-sink gate, or desktop signing
  readiness, and until this correction it had **no audit trail at all**
  beyond `console.error` on failure (now wired to `logAudit()` for both
  approve and apply, success and failure). This is a real, live,
  infrastructure-mutating capability that predates this document and the
  Axiom governance model described elsewhere in it — flagging it here so
  this spec stops implying it is covered by the same safety boundary as
  the governed workspace's rehearsal story.

  **Update (2026-10-04): this was escalated to a P0 and contained.**
  `terraformApply()` now hard-refuses to execute unless
  `TERRAFORM_LEGACY_APPLY_ENABLED=true` is explicitly set — unset by
  default, and not set in any environment today. `terraform plan`
  (read-only, no mutation) is untouched and still runs normally so the
  self-serve rehearsal/preview experience keeps working. The refusal is
  audited (`terraform.apply_blocked_kill_switch`) distinctly from a real
  execution failure. This is a containment, not a fix: the underlying gap
  (no tenant/role model, no environment/blast-radius safeguard, no
  rollback/recovery evidence, no relationship to terraformBoundary.ts)
  still needs a real migration of this legacy leadId-based system onto
  the canonical organization/role model before live apply should ever be
  re-enabled.
- **In-memory execution simulation, no real infrastructure touched** —
  `lib/simulation/executionSimulator.ts` ("Execution simulator (in-memory
  twin mutation, no apply)") and the release/security variants
  (`lib/releaseops/releaseSimulation.ts`, `lib/securityScanner/securitySimulation.ts`)
  are all listed `status: "passing"` with evidence paths in
  `lib/validation/platformValidationMatrix.ts` — the single internal
  source of truth this codebase already uses to avoid overclaiming "what
  works end-to-end right now."
- **Policy and boundary gate validation before any approval packet can
  be assembled** — `lib/agents/approverPacketAssembler.ts` "Refuses to
  build a packet unless every upstream gate (simulator + policy +
  boundary + council) has passed," with a closed `rejectReason` union
  and a packet summary that always reaffirms "Approval-only-no-execution."
- **The sandbox-spec builder is pure, not a live runner** —
  `lib/agents/simulatorSandboxSpec.ts` builds a typed description of what
  an external sandbox run *would* check (backend, assertions, timeout);
  its own doc comment says plainly "the actual sandbox runner is
  external." No live runner exists, and nothing in the product claims
  one does.
- **The public website already describes this precisely and
  conservatively** — `/capabilities`, `/faq`, and `/compare` all contain
  explicit, hand-written disclaimers: "it is not an isolated production
  rehearsal," "does not currently claim a general isolated
  production-rehearsal environment," "does not claim an isolated
  production-equivalent environment." This was independently verified
  against the live page content, not assumed — there is no truthfulness
  gap to fix here.

**What's genuinely still missing**, if a future session wants to build
toward a *named* "rehearsal" feature without live cloud credentials: a
single dashboard surface that composes the pieces above (plan + simulator
+ policy/boundary gate results) into one operator-facing view, the way
`DEPLOYMENT-REHEARSAL-SPEC.md`'s original UI/UX section imagined — but
built on `terraformBoundary.ts` + the existing simulators, not on a new
live-AWS-sandbox execution engine. That composition work was not started
in this pass; the underlying safe capability it would compose was found to
already exist and did not need new code.

---

## Problem Statement

Release teams need confidence that approved playbooks will execute successfully **before** running in production. Current state:
- Playbooks are approved based on review (Request → Readiness → Approval)
- Execution happens against live cloud providers (AWS, Azure, GCP)
- No "dry run" or rehearsal capability
- No validation that playbook steps match actual provider state

**Goal:** Implement a safe, isolated rehearsal mode that validates playbook correctness without touching production.

---

## Requirements

### Core Requirements

1. **Rehearsal Environment**
   - Create isolated sandbox cloud account or namespaced resources
   - Sandbox is **completely separate** from production
   - No cross-contamination possible
   - Clear labeling that rehearsal resources are temporary

2. **Rehearsal Execution**
   - Run playbook steps in rehearsal environment
   - Record all actions (API calls, state changes, errors)
   - Validate that each step succeeds
   - Compare actual behavior to expected behavior

3. **Validation Reporting**
   - Show which steps passed/failed
   - Show actual vs. expected outcomes
   - Show execution timeline (like real release)
   - Highlight provider API errors or permission issues

4. **Approval Gate**
   - Rehearsal must **pass** before real execution is allowed
   - Failing rehearsal blocks production execution
   - Must show clear blockers to operator
   - No "force deploy despite failed rehearsal" bypass

---

## Implementation Phases

### Phase 1: Single-Provider Rehearsal (AWS)

**Scope:**
- AWS-only rehearsal (simplest provider integration)
- Static infrastructure (no dynamic scaling tests)
- Limited action set (create, read, update, verify)

**Files to Create:**
- `lib/rehearsal/rehearsal-executor.ts` — Core rehearsal engine
- `app/api/dashboard/release-rehearsal/execute/route.ts` — Rehearsal endpoint
- `app/dashboard/releases/[id]/rehearsal/page.tsx` — Rehearsal UI

**Features:**
- Parse playbook steps
- Map to AWS API calls
- Execute in sandbox account
- Collect results
- Report pass/fail

**Estimated effort:** 40 hours

---

### Phase 2: Multi-Provider Support

**Add:**
- Azure rehearsal (similar to AWS)
- GCP rehearsal (similar pattern)
- Provider-agnostic orchestration

**Estimated effort:** 30 hours additional

---

### Phase 3: Advanced Validation

**Add:**
- Permission validation (can the service account actually perform steps?)
- Resource validation (do resources exist with expected attributes?)
- Policy validation (would the step violate deployment policies?)
- Cost estimation (how much would this cost in production?)

**Estimated effort:** 20 hours additional

---

## Design Decisions

### Safety First
- Rehearsal CANNOT affect production
- Rehearsal resources auto-delete after 24 hours
- No shared credentials between rehearsal and production
- Rehearsal failures block production (not a suggestion)

### Transparency
- Operator sees EXACTLY what will happen in production
- Execution timeline matches real release
- All provider API calls logged and visible
- No hidden steps or surprise behaviors

### Progressivity
- Start with read-only validation (Phase 3)
- Then add create operations (Phase 1)
- Then add multi-provider (Phase 2)
- Each phase independently valuable

---

## Data Model

```typescript
interface ReleaseRehearsal {
  id: string;
  releaseId: string;
  organizationId: string;
  
  // Execution state
  status: "not_started" | "in_progress" | "passed" | "failed" | "blocked";
  startedAt?: Date;
  completedAt?: Date;
  
  // Detailed results
  stepResults: Array<{
    stepNumber: number;
    stepType: string;
    stepDescription: string;
    status: "passed" | "failed" | "skipped";
    expectedOutcome: string;
    actualOutcome: string;
    apiCallsMade: Array<{
      provider: string;
      action: string;
      requestBody: any;
      responseStatus: number;
      error?: string;
    }>;
    executionTimeMs: number;
  }>;
  
  // Summary
  totalSteps: number;
  stepsPassedCount: number;
  stepsFailedCount: number;
  blockers: Array<{
    stepNumber: number;
    severity: "error" | "warning";
    message: string;
    suggestedFix: string;
  }>;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  sandboxAccountId: string; // e.g., AWS account, Azure subscription
}
```

---

## UI/UX

### Rehearsal Page (`/dashboard/releases/[id]/rehearsal`)

**Layout:**
- Status indicator at top (PASSED / FAILED / IN_PROGRESS)
- Timeline of execution showing each step
- For each step: Expected vs. Actual outcome
- Blockers section (if any failures)
- Option to run rehearsal again
- Link to production execution (available if passed)

**States:**
- `not_started`: "Run a rehearsal to validate" (button)
- `in_progress`: "Rehearsal running…" (progress indicator)
- `passed`: "Rehearsal passed. Ready for production." (green)
- `failed`: "Rehearsal failed. Fix issues and try again." (red)
- `blocked`: "Rehearsal blocked by policy violation" (red)

### Integration with Playbook
- Add "Rehearsal" tab to unified playbook page
- Show status in playbook overview
- Block execution button until rehearsal passes

---

## Success Criteria

- [x] Specification defined
- [ ] AWS rehearsal environment provisioned
- [ ] Phase 1 implementation complete
- [ ] Rehearsal shows realistic execution timeline
- [ ] Blockers are clear and actionable
- [ ] Rehearsal failures prevent production execution
- [ ] Operator has confidence in playbook correctness

---

## Implementation Notes

### Sandbox Account Strategy
- **Option A:** Static dedicated sandbox account (easier, less flexible)
- **Option B:** Dynamic sandbox per rehearsal (safer, more complex)
- **Recommendation:** Option A for MVP, migrate to Option B later

### Cost Implications
- Rehearsal should be cost-optimized (terminate quickly)
- Estimate AWS costs before rehearsal (show to operator)
- Charge rehearsal costs to pilot organization
- Document rehearsal costs in pricing model

### Security Implications
- Rehearsal credentials isolated from production
- Sandbox resources cannot communicate with production VPC
- CloudTrail logs separate from production
- Audit trail records rehearsal runs separately

---

## Timeline Estimate

| Phase | Work | Time | Cumulative |
|-------|------|------|-----------|
| 1 | AWS single-provider rehearsal | 40h | 40h |
| 2 | Multi-provider support | 30h | 70h |
| 3 | Advanced validation | 20h | 90h |
| **Total** | **Full deployment rehearsal** | **~90 hours** | **90h** |

---

## Risk Mitigation

**Risk:** Rehearsal sandbox affects production  
**Mitigation:** Isolated AWS account, no shared IAM roles, separate credentials

**Risk:** Rehearsal doesn't match production behavior  
**Mitigation:** Use identical playbook engine, log all API calls, compare with actual execution

**Risk:** Rehearsal takes too long (operator impatience)  
**Mitigation:** Aim for < 5 min rehearsal, show progress updates

**Risk:** Rehearsal costs are high  
**Mitigation:** Terminate resources immediately, use spot instances, cap sandbox resources

---

## Next Steps

1. ✅ Specification (this document)
2. ⏳ Design review with team
3. ⏳ Sandbox account provisioning
4. ⏳ Phase 1 implementation
5. ⏳ Integration with release playbook
6. ⏳ Testing with real playbooks
7. ⏳ Documentation and training

---

**Owner:** DevOps + AI Engineering team  
**Status:** Planning phase  
**Target:** Post-MVP enhancement
