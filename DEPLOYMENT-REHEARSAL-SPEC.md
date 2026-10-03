# Deployment Rehearsal Feature Specification

**Requirement:** 9 — Deployment Rehearsal Investigation  
**Status:** Specification & Planning Phase  
**Priority:** Medium-high (improves release confidence)

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
